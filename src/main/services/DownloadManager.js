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
    this.isCancelled = false;
  }

  cancel() {
    this.isCancelled = true;
    this.downloadInfoService.cancel();
    this.downloadService.cancel();
  }

  reset() {
    this.isCancelled = false;
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
    let filesToDownload = [];

    try {
      const scanResult = await this.downloadInfoService.getDownloadInfo(this.win, baseUrl, files, targetDir, createSubfolder);

      if (this.isCancelled) {
        throw new Error("CANCELLED_DURING_SCAN");
      }

      filesToDownload = scanResult.filesToDownload;
      totalSize = scanResult.totalSize;
      skippedSize = scanResult.skippedSize;
      allSkippedFiles.push(...scanResult.skippedFiles);

      if (filesToDownload.length === 0) {
        summaryMessage = "All matched files already exist locally. Nothing to download.";
      } else {
        const remainingSize = totalSize - skippedSize;
        this.downloadConsole.logTotalDownloadSize(formatBytes(remainingSize));
        this.win.webContents.send('download-overall-progress', { current: skippedSize, total: totalSize, skippedSize: skippedSize, eta: calculateEta(skippedSize, totalSize, downloadStartTime) });

        const totalFilesOverall = files.length;
        const initialSkippedFileCount = scanResult.skippedFiles.length;

        const downloadResult = await this.downloadService.downloadFiles(
          this.win,
          baseUrl,
          filesToDownload,
          targetDir,
          totalSize,
          skippedSize,
          createSubfolder,
          totalFilesOverall,
          initialSkippedFileCount
        );
        allSkippedFiles.push(...downloadResult.skippedFiles);
        downloadedFiles = filesToDownload.filter(f => !downloadResult.skippedFiles.some(s => s.name === f.name));
      }

    } catch (e) {
      if (e.message.startsWith('CANCELLED_')) {
        summaryMessage = "";
      } else {
        console.error("DownloadManager: Generic error caught in startDownload:", e);
        summaryMessage = `Error: ${e.message || e}`;
      }
      wasCancelled = true;
      partialFile = e.partialFile || null;
    }

    if (wasCancelled || this.isCancelled) {
      this.downloadConsole.logDownloadCancelled();
      summaryMessage = "";
      wasCancelled = true;
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
      wasCancelled: wasCancelled,
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
    let lastExtractionProgressUpdateTime = 0;

    for (const file of archiveFiles) {
      const subfolder = createSubfolder ? file.name_raw.replace(/\.[^/.]+$/, "") : '';
      const filePath = path.join(targetDir, subfolder, file.name_raw);
      let zipfile;
      try {
        zipfile = await open(filePath);
        let entry = await zipfile.readEntry();
        while (entry) {
          if (entry.uncompressedSize > 0) {
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
        await zipfile.close();

        zipfile = await open(filePath);

        let extractedEntryCount = 0;
        entry = await zipfile.readEntry();
        while (entry) {
          extractedEntryCount++;
          const currentEntryFileName = entry.fileName || entry.filename;
          if (!currentEntryFileName || typeof currentEntryFileName !== 'string') {
            this.downloadConsole.logSkippingInvalidEntry(entry);
            entry = await zipfile.readEntry();
            continue;
          }

          const entryPath = path.join(extractPath, currentEntryFileName);

          if (/\/$/.test(currentEntryFileName) && entry.uncompressedSize === 0) {
            await fs.promises.mkdir(entryPath, { recursive: true });
            entry = await zipfile.readEntry();
            continue;
          }

          if (/\/$/.test(currentEntryFileName)) {
            await fs.promises.mkdir(entryPath, { recursive: true });
          } else {
            await fs.promises.mkdir(path.dirname(entryPath), { recursive: true });

            const readStream = await entry.openReadStream();
            const writeStream = fs.createWriteStream(entryPath);

            let bytesRead = 0;
            const totalBytes = entry.uncompressedSize;

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
              overallExtractedBytes += chunk.length;

              const now = performance.now();
              if (now - lastExtractionProgressUpdateTime > 100 || bytesRead === totalBytes) {
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
      overallExtractedBytes: totalUncompressedSizeOfAllArchives,
      totalUncompressedSizeOfAllArchives: totalUncompressedSizeOfAllArchives,
      formattedOverallExtractedBytes: formatBytes(totalUncompressedSizeOfAllArchives),
      formattedTotalUncompressedSizeOfAllArchives: formatBytes(totalUncompressedSizeOfAllArchives),
      eta: '--'
    });
    this.downloadConsole.logExtractionProcessComplete();
  }
}

export default DownloadManager;