import DownloadInfoService from './DownloadInfoService.js';
import DownloadService from './DownloadService.js';
import { open } from 'yauzl-promise';
import fs from 'fs';
import path from 'path';
import { formatBytes, calculateEta } from '../utils.js';

class DownloadManager {
  constructor(win, downloadConsole) {
    this.win = win;
    this.downloadInfoService = new DownloadInfoService();
    this.downloadConsole = downloadConsole;
    this.downloadService = new DownloadService(downloadConsole);
    this.isCancelled = false; // Add internal cancellation flag
  }

  cancel() {
    this.isCancelled = true; // Set internal flag
    this.downloadInfoService.cancel();
    this.downloadService.cancel();
  }

  reset() {
    this.isCancelled = false; // Reset internal flag
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
    let filesToDownload = []; // Declare and initialize here

    try {
      const scanResult = await this.downloadInfoService.getDownloadInfo(this.win, baseUrl, files, targetDir, createSubfolder);

      // Check for cancellation after the scan, in case it didn't throw
      if (this.isCancelled) {
        throw new Error("CANCELLED_DURING_SCAN");
      }

      filesToDownload = scanResult.filesToDownload; // Assign here
      totalSize = scanResult.totalSize;
      skippedSize = scanResult.skippedSize;
      allSkippedFiles.push(...scanResult.skippedFiles);

      if (filesToDownload.length === 0) {
        summaryMessage = "All matched files already exist locally. Nothing to download.";
      } else {
        const remainingSize = totalSize - skippedSize;
        this.downloadConsole.logTotalDownloadSize(formatBytes(remainingSize));
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
        allSkippedFiles.push(...downloadResult.skippedFiles);
        downloadedFiles = filesToDownload.filter(f => !downloadResult.skippedFiles.some(s => s.name === f.name));
      }

    } catch (e) {
      // Distinguish between controlled cancellations and other errors
      if (e.message.startsWith('CANCELLED_')) {
        console.log(`DownloadManager: Cancellation caught: ${e.message}`);
        summaryMessage = ""; // No error message needed for a clean cancel
      } else {
        console.error("DownloadManager: Generic error caught in startDownload:", e);
        summaryMessage = `Error: ${e.message || e}`;
      }
      wasCancelled = true;
      partialFile = e.partialFile || null;
    }

    // Check both the error-based flag AND the internal manager flag
    if (wasCancelled || this.isCancelled) {
      this.downloadConsole.logDownloadCancelled();
      summaryMessage = ""; // Ensure message is blank on cancel
      wasCancelled = true; // Ensure this is set for the 'download-complete' event
    } else if (downloadedFiles.length > 0 || filesToDownload.length === 0) {
      this.downloadConsole.logDownloadComplete();
    }

    if (extractAndDelete && !wasCancelled && downloadedFiles.length > 0) {
      this.downloadConsole.logDownloadStartingExtraction();
      await this.extractFiles(downloadedFiles, targetDir, createSubfolder);
    }

    this.win.webContents.send('download-complete', {
      message: summaryMessage,
      skippedFiles: allSkippedFiles,
      wasCancelled: wasCancelled, // This will now be correct
      partialFile: partialFile
    });

    return { success: true };
  }

  async extractFiles(downloadedFiles, targetDir, createSubfolder) {
    const extractionStartTime = performance.now();
    const archiveFiles = downloadedFiles.filter(f => f.name_raw.toLowerCase().endsWith('.zip'));
    if (archiveFiles.length === 0) {
      this.downloadConsole.logNoArchivesToExtract();
      return;
    }

    this.downloadConsole.logFoundArchivesToExtract(archiveFiles.length);

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
        this.downloadConsole.logError(`Error calculating size for ${file.name_raw}: ${e.message}`);
      } finally {
        if (zipfile) {
          await zipfile.close();
        }
      }
    }

    this.downloadConsole.logTotalUncompressedSize(formatBytes(totalUncompressedSizeOfAllArchives));

    // Second pass: Extract files and track progress
    for (let i = 0; i < archiveFiles.length; i++) {
      const file = archiveFiles[i];
      const subfolder = createSubfolder ? file.name_raw.replace(/\.[^/.]+$/, "") : '';
      const filePath = path.join(targetDir, subfolder, file.name_raw);
      const extractPath = path.join(targetDir, subfolder);

      let zipfile;
      try {
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
            this.downloadConsole.logSkippingInvalidEntry(entry);
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

      } catch (e) {
        this.downloadConsole.logExtractionError(file.name_raw, e.message);
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
    this.downloadConsole.logExtractionProcessComplete();
  }
}

export default DownloadManager;