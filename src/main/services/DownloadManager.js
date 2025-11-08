import DownloadInfoService from './DownloadInfoService.js';
import DownloadService from './DownloadService.js';
import { open } from 'yauzl-promise';
import fs from 'fs';
import path from 'path';
import { formatBytes, calculateEta } from '../utils.js';

class DownloadManager {
  constructor(win) {
    this.win = win;
    this.downloadInfoService = new DownloadInfoService();
    this.downloadService = new DownloadService();
  }

  cancel() {
    this.downloadInfoService.cancel();
    this.downloadService.cancel();
  }

  reset() {
    this.downloadInfoService.reset();
    this.downloadService.reset();
  }

  async startDownload(baseUrl, files, targetDir, createSubfolder, extractAndDelete) {
    this.reset();

    const downloadStartTime = performance.now();
    let allSkippedFiles = [];
    let totalSize = 0;
    let skippedSize = 0;
    let summaryMessage = "";
    let wasCancelled = false;
    let partialFile = null;
    let downloadedFiles = [];

    try {
      const scanResult = await this.downloadInfoService.getDownloadInfo(this.win, baseUrl, files, targetDir, createSubfolder);

      const filesToDownload = scanResult.filesToDownload;
      totalSize = scanResult.totalSize;
      skippedSize = scanResult.skippedSize;
      allSkippedFiles.push(...scanResult.skippedFiles);

      if (filesToDownload.length === 0) {
        summaryMessage = "All matched files already exist locally. Nothing to download.";
      } else {
        const remainingSize = totalSize - skippedSize;
        this.win.webContents.send('download-log', `Total download size: ${formatBytes(remainingSize)}.`);
        this.win.webContents.send('download-overall-progress', { current: skippedSize, total: totalSize, skippedSize: skippedSize, eta: calculateEta(skippedSize, totalSize, downloadStartTime) });

        const totalFilesOverall = files.length; // Total files originally considered
        const initialSkippedFileCount = scanResult.skippedFiles.length; // Files skipped in the initial scan

        const downloadResult = await this.downloadService.downloadFiles(
          this.win,
          baseUrl,
          filesToDownload,
          targetDir,
          totalSize,
          skippedSize,
          createSubfolder,
          totalFilesOverall, // Pass total files overall
          initialSkippedFileCount // Pass initial skipped file count
        );
        summaryMessage = downloadResult.message;
        allSkippedFiles.push(...downloadResult.skippedFiles);
        downloadedFiles = filesToDownload.filter(f => !downloadResult.skippedFiles.some(s => s.name === f.name));
      }

    } catch (e) {
      if (e.message.startsWith("CANCELLED_")) {
        summaryMessage = "Download cancelled by user.";
        wasCancelled = true;
        if (e.message === "CANCELLED_MID_FILE") {
          partialFile = e.partialFile || null;
        }
      } else {
        summaryMessage = `Error: ${e.message}`;
        this.win.webContents.send('download-log', summaryMessage);
      }
    }

    if (extractAndDelete && !wasCancelled && downloadedFiles.length > 0) {
      this.win.webContents.send('download-log', 'Download complete. Starting extraction...');
      this.win.webContents.send('download-phase-complete'); // New event
      await this.extractFiles(downloadedFiles, targetDir, createSubfolder);
    }

    this.win.webContents.send('download-complete', {
      message: summaryMessage,
      skippedFiles: allSkippedFiles,
      wasCancelled: wasCancelled,
      partialFile: partialFile
    });

    return { success: true };
  }

  async extractFiles(downloadedFiles, targetDir, createSubfolder) {
    const extractionStartTime = performance.now();
    const archiveFiles = downloadedFiles.filter(f => f.name_raw.toLowerCase().endsWith('.zip'));
    if (archiveFiles.length === 0) {
      this.win.webContents.send('download-log', 'No .zip archives found to extract.');
      return;
    }

    this.win.webContents.send('download-log', `Found ${archiveFiles.length} archive${archiveFiles.length > 1 ? 's' : ''} to extract.`);

    let totalUncompressedSizeOfAllArchives = 0;
    let overallExtractedBytes = 0;
    let lastExtractionProgressUpdateTime = 0; // Added for throttling

    // First pass: Calculate total uncompressed size of all archives
    for (const file of archiveFiles) {
      const subfolder = createSubfolder ? file.name_raw.replace(/\.[^/.]+$/, "") : '';
      const filePath = path.join(targetDir, subfolder, file.name_raw);
      let zipfile;
      try {
        zipfile = await open(filePath);
        let entry = await zipfile.readEntry();
        while (entry) {
          if (entry.uncompressedSize > 0) { // Only count actual files
            totalUncompressedSizeOfAllArchives += entry.uncompressedSize;
          }
          entry = await zipfile.readEntry();
        }
      } catch (e) {
        this.win.webContents.send('download-log', `Error calculating size for ${file.name_raw}: ${e.message}`);
      } finally {
        if (zipfile) {
          await zipfile.close();
        }
      }
    }

    this.win.webContents.send('download-log', `Total uncompressed size for all archives: ${formatBytes(totalUncompressedSizeOfAllArchives)}.`);

    // Second pass: Extract files and track progress
    for (let i = 0; i < archiveFiles.length; i++) {
      const file = archiveFiles[i];
      const subfolder = createSubfolder ? file.name_raw.replace(/\.[^/.]+$/, "") : '';
      const filePath = path.join(targetDir, subfolder, file.name_raw);
      const extractPath = path.join(targetDir, subfolder);

      let zipfile;
      try {
        this.win.webContents.send('download-log', `Extracting ${file.name_raw}...`);
        this.win.webContents.send('extraction-progress', {
          current: i,
          total: archiveFiles.length,
          filename: file.name_raw,
          fileProgress: 0,
          fileTotal: 0,
          currentEntry: 0,
          totalEntries: 0,
          overallExtractedBytes: overallExtractedBytes,
          totalUncompressedSizeOfAllArchives: totalUncompressedSizeOfAllArchives,
          eta: calculateEta(overallExtractedBytes, totalUncompressedSizeOfAllArchives, extractionStartTime)
        });

        zipfile = await open(filePath);

        let totalEntries = 0;
        let entry = await zipfile.readEntry();
        while (entry) {
          totalEntries++;
          entry = await zipfile.readEntry();
        }
        await zipfile.close(); // Close after counting

        // Reopen the zipfile to reset the internal pointer for actual processing
        zipfile = await open(filePath);

        let extractedEntryCount = 0;
        entry = await zipfile.readEntry();
        while (entry) {
          extractedEntryCount++;
          const currentEntryFileName = entry.fileName || entry.filename; // Use entry.filename if entry.fileName is undefined
          if (!currentEntryFileName || typeof currentEntryFileName !== 'string') {
            this.win.webContents.send('download-log', `Skipping invalid entry: ${JSON.stringify(entry)}`);
            entry = await zipfile.readEntry();
            continue;
          }

          const entryPath = path.join(extractPath, currentEntryFileName);

          // Skip if it's a directory entry with 0 uncompressed size
          if (/\/$/.test(currentEntryFileName) && entry.uncompressedSize === 0) {
            await fs.promises.mkdir(entryPath, { recursive: true });
            entry = await zipfile.readEntry();
            continue;
          }

          // Create directories
          if (/\/$/.test(currentEntryFileName)) {
            await fs.promises.mkdir(entryPath, { recursive: true });
          } else {
            // Ensure parent directory exists for files
            await fs.promises.mkdir(path.dirname(entryPath), { recursive: true });

            const readStream = await entry.openReadStream();
            const writeStream = fs.createWriteStream(entryPath);

            let bytesRead = 0;
            const totalBytes = entry.uncompressedSize;

            // Send initial progress update for the entry
            this.win.webContents.send('extraction-progress', {
              current: i,
              total: archiveFiles.length,
              filename: file.name_raw,
              fileProgress: 0,
              fileTotal: totalBytes,
              currentEntry: extractedEntryCount,
              totalEntries: totalEntries,
              overallExtractedBytes: overallExtractedBytes,
              totalUncompressedSizeOfAllArchives: totalUncompressedSizeOfAllArchives,
              formattedOverallExtractedBytes: formatBytes(overallExtractedBytes),
              formattedTotalUncompressedSizeOfAllArchives: formatBytes(totalUncompressedSizeOfAllArchives),
              eta: calculateEta(overallExtractedBytes, totalUncompressedSizeOfAllArchives, extractionStartTime)
            });

            readStream.on('data', (chunk) => {
              bytesRead += chunk.length;
              overallExtractedBytes += chunk.length; // Update overall progress

              const now = performance.now();
              if (now - lastExtractionProgressUpdateTime > 100 || bytesRead === totalBytes) { // Throttle updates
                lastExtractionProgressUpdateTime = now;
                this.win.webContents.send('extraction-progress', {
                  current: i,
                  total: archiveFiles.length,
                  filename: file.name_raw,
                  fileProgress: bytesRead,
                  fileTotal: totalBytes,
                  currentEntry: extractedEntryCount,
                  totalEntries: totalEntries,
                  overallExtractedBytes: overallExtractedBytes,
                  totalUncompressedSizeOfAllArchives: totalUncompressedSizeOfAllArchives,
                  formattedOverallExtractedBytes: formatBytes(overallExtractedBytes),
                  formattedTotalUncompressedSizeOfAllArchives: formatBytes(totalUncompressedSizeOfAllArchives),
                  eta: calculateEta(overallExtractedBytes, totalUncompressedSizeOfAllArchives, extractionStartTime)
                });
              }
            });

            await new Promise((resolve, reject) => {
              readStream.pipe(writeStream);
              writeStream.on('finish', () => {
                // Ensure final progress update is sent for this entry
                this.win.webContents.send('extraction-progress', {
                  current: i,
                  total: archiveFiles.length,
                  filename: file.name_raw,
                  fileProgress: totalBytes,
                  fileTotal: totalBytes,
                  currentEntry: extractedEntryCount,
                  totalEntries: totalEntries,
                  overallExtractedBytes: overallExtractedBytes,
                  totalUncompressedSizeOfAllArchives: totalUncompressedSizeOfAllArchives,
                  formattedOverallExtractedBytes: formatBytes(overallExtractedBytes),
                  formattedTotalUncompressedSizeOfAllArchives: formatBytes(totalUncompressedSizeOfAllArchives),
                  eta: calculateEta(overallExtractedBytes, totalUncompressedSizeOfAllArchives, extractionStartTime)
                });
                resolve();
              });
              writeStream.on('error', reject);
              readStream.on('error', reject);
            });
          }
          entry = await zipfile.readEntry();
        }
        await fs.promises.unlink(filePath);
        this.win.webContents.send('download-log', `Successfully extracted and deleted ${file.name_raw}.`);

      } catch (e) {
        this.win.webContents.send('download-log', `Error extracting ${file.name_raw}: ${e.message}`);
      } finally {
        if (zipfile) {
          await zipfile.close();
        }
      }
    }
    this.win.webContents.send('extraction-progress', {
      current: archiveFiles.length,
      total: archiveFiles.length,
      filename: '',
      fileProgress: 0,
      fileTotal: 0,
      currentEntry: 0,
      totalEntries: 0,
      overallExtractedBytes: totalUncompressedSizeOfAllArchives, // Ensure overall progress is 100% at the end
      totalUncompressedSizeOfAllArchives: totalUncompressedSizeOfAllArchives,
      formattedOverallExtractedBytes: formatBytes(totalUncompressedSizeOfAllArchives),
      formattedTotalUncompressedSizeOfAllArchives: formatBytes(totalUncompressedSizeOfAllArchives),
      eta: '--'
    });
    this.win.webContents.send('download-log', 'Extraction process complete.');
  }
}

export default DownloadManager;
