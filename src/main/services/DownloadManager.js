import DownloadInfoService from './DownloadInfoService.js';
import DownloadService from './DownloadService.js';
import { open } from 'yauzl-promise';
import fs from 'fs';
import path from 'path';
import { formatBytes, calculateEta } from '../utils.js';

/**
 * Manages the overall download and extraction process.
 * Orchestrates DownloadInfoService and DownloadService.
 */
class DownloadManager {
  /**
   * Creates an instance of DownloadManager.
   * @param {object} win The Electron BrowserWindow instance.
   * @param {object} downloadConsole An instance of DownloadConsole for logging.
   */
  constructor(win, downloadConsole) {
    this.win = win;
    this.downloadInfoService = new DownloadInfoService();
    this.downloadConsole = downloadConsole;
    this.downloadService = new DownloadService(downloadConsole);
    this.isCancelled = false;
  }

  /**
   * Cancels any ongoing download and information retrieval processes.
   */
  cancel() {
    this.isCancelled = true;
    this.downloadInfoService.cancel();
    this.downloadService.cancel();
  }

  /**
   * Resets the download manager's state, allowing for new download operations.
   */
  reset() {
    this.isCancelled = false;
    this.downloadInfoService.reset();
    this.downloadService.reset();
  }

  /**
   * Initiates the download process for a given set of files.
   * @param {string} baseUrl The base URL for the files to download.
   * @param {Array<object>} files An array of file objects to download.
   * @param {string} targetDir The target directory for the download.
   * @param {boolean} createSubfolder Whether to create subfolders for the download.
   * @param {boolean} extractAndDelete Whether to extract archives and delete them after download.
   * @param {boolean} extractPreviouslyDownloaded Whether to extract previously downloaded archives.
   * @param {number} maxConcurrentDownloads The maximum number of concurrent downloads (default: 3).
   * @returns {Promise<{success: boolean}>} A promise that resolves with a success status.
   */
  async startDownload(baseUrl, files, targetDir, createSubfolder, extractAndDelete, extractPreviouslyDownloaded, maxConcurrentDownloads = 3) {
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
    let scanResult;

    try {
      scanResult = await this.downloadInfoService.getDownloadInfo(this.win, baseUrl, files, targetDir, createSubfolder);

      if (this.isCancelled) {
        throw new Error("CANCELLED_DURING_SCAN");
      }

      filesToDownload = scanResult.filesToDownload;
      totalSize = scanResult.totalSize;
      skippedSize = scanResult.skippedSize;
      allSkippedFiles.push(...scanResult.skippedFiles.map(f => f.name));

      if (filesToDownload.length === 0) {
        if (scanResult.skippedBecauseExtractedCount === files.length) {
          summaryMessage = "All files already extracted!";
        } else if (scanResult.skippedBecauseDownloadedCount === files.length) {
          summaryMessage = "All files already downloaded!";
        } else {
          summaryMessage = "All matched files already exist locally. Nothing to download.";
        }
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
          initialSkippedFileCount,
          maxConcurrentDownloads
        );
        allSkippedFiles.push(...downloadResult.skippedFiles);
        downloadedFiles = filesToDownload.filter(f => !downloadResult.skippedFiles.includes(f.name));
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

    if (summaryMessage) {
      this.downloadConsole.log(summaryMessage);
    }

    let filesForExtraction = [...downloadedFiles];
    if (extractPreviouslyDownloaded && scanResult && scanResult.skippedFiles) {
      const previouslyDownloadedArchives = scanResult.skippedFiles.filter(file => {
        const gameName = path.parse(file.name).name;
        const subfolderPath = createSubfolder ? path.join(targetDir, gameName) : targetDir;
        const filePath = path.join(subfolderPath, file.name);
        return fs.existsSync(filePath) && !allSkippedFiles.includes(file.name);
      });
      filesForExtraction.push(...previouslyDownloadedArchives);
    }

    if (extractAndDelete && !wasCancelled && filesForExtraction.length > 0) {
      this.downloadConsole.logDownloadStartingExtraction();
      await this.extractFiles(filesForExtraction, targetDir, createSubfolder);
    }

    this.win.webContents.send('download-complete', {
      message: "",
      skippedFiles: allSkippedFiles,
      wasCancelled: wasCancelled,
      partialFile: partialFile
    });

    return { success: true };
  }

  /**
   * Extracts downloaded archive files.
   * @param {Array<object>} downloadedFiles An array of file objects that have been downloaded.
   * @param {string} targetDir The target directory for extraction.
   * @param {boolean} createSubfolder Whether to extract into subfolders based on archive name.
   * @returns {Promise<void>}
   */
  async extractFiles(downloadedFiles, targetDir, createSubfolder) {
    const extractionStartTime = performance.now();
    this.win.webContents.send('extraction-started');
    const archiveFiles = downloadedFiles.filter(f => f.name.toLowerCase().endsWith('.zip'));
    if (archiveFiles.length === 0) {
      this.downloadConsole.logNoArchivesToExtract();
      return;
    }

    this.downloadConsole.logFoundArchivesToExtract(archiveFiles.length);

    let totalUncompressedSizeOfAllArchives = 0;
    let overallExtractedBytes = 0;
    let overallExtractedEntryCount = 0;
    let lastExtractionProgressUpdateTime = 0;

    let totalEntriesOverall = 0;
    for (const file of archiveFiles) {
      const filePath = createSubfolder ? path.join(targetDir, path.parse(file.name).name, file.name) : path.join(targetDir, file.name);
      let zipfile;
      try {
        zipfile = await open(filePath);
        let entry = await zipfile.readEntry();
        while (entry) {
          totalEntriesOverall++;
          entry = await zipfile.readEntry();
        }
      } catch (e) {
        this.downloadConsole.logError(`Error counting entries for ${file.name}: ${e.message}`);
      } finally {
        if (zipfile) {
          await zipfile.close();
        }
      }
    }

    for (const file of archiveFiles) {
      const filePath = createSubfolder ? path.join(targetDir, path.parse(file.name).name, file.name) : path.join(targetDir, file.name);
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
        this.downloadConsole.logError(`Error calculating size for ${file.name}: ${e.message}`);
      } finally {
        if (zipfile) {
          await zipfile.close();
        }
      }
    }

    this.downloadConsole.logTotalUncompressedSize(formatBytes(totalUncompressedSizeOfAllArchives));


    for (let i = 0; i < archiveFiles.length; i++) {
      const file = archiveFiles[i];
      const archiveBaseName = path.parse(file.name).name;
      const extractPath = createSubfolder ? path.join(targetDir, archiveBaseName) : targetDir;
      const filePath = createSubfolder ? path.join(targetDir, path.parse(file.name).name, file.name) : path.join(targetDir, file.name);

      let zipfile;
      const extractedFiles = [];
      try {
        this.win.webContents.send('extraction-progress', {
          current: i,
          total: archiveFiles.length,
          filename: file.name,
          fileProgress: 0,
          fileTotal: 0,
          currentEntry: 0,
          totalEntries: 0,
          overallExtractedBytes: overallExtractedBytes,
          totalUncompressedSizeOfAllArchives: totalUncompressedSizeOfAllArchives,
          overallExtractedEntryCount: overallExtractedEntryCount,
          totalEntriesOverall: totalEntriesOverall,
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
          if (this.isCancelled) {
            this.downloadConsole.logExtractionCancelled();
            break;
          }
          extractedEntryCount++;
          overallExtractedEntryCount++;
          const currentEntryFileName = entry.fileName || entry.filename;
          if (!currentEntryFileName || typeof currentEntryFileName !== 'string') {
            entry = await zipfile.readEntry();
            continue;
          }

          let finalEntryFileName = currentEntryFileName;
          if (createSubfolder && finalEntryFileName.startsWith(archiveBaseName + '/')) {
            finalEntryFileName = finalEntryFileName.substring(archiveBaseName.length + 1);
          }

          const entryPath = path.join(extractPath, finalEntryFileName);
          if (/\/$/.test(finalEntryFileName) && entry.uncompressedSize === 0) {
            await fs.promises.mkdir(entryPath, { recursive: true });
            entry = await zipfile.readEntry();
            continue;
          }
          if (/\/$/.test(finalEntryFileName)) {
            await fs.promises.mkdir(entryPath, { recursive: true });
          } else {
            await fs.promises.mkdir(path.dirname(entryPath), { recursive: true });
            extractedFiles.push(entryPath);
            const readStream = await entry.openReadStream();
            const writeStream = fs.createWriteStream(entryPath);
            let bytesRead = 0;
            const totalBytes = entry.uncompressedSize;
            this.win.webContents.send('extraction-progress', {
              current: i,
              total: archiveFiles.length,
              filename: file.name,
              fileProgress: 0,
              fileTotal: totalBytes,
              currentEntry: extractedEntryCount,
              totalEntries: totalEntries,
              overallExtractedBytes: overallExtractedBytes,
              totalUncompressedSizeOfAllArchives: totalUncompressedSizeOfAllArchives,
              overallExtractedEntryCount: overallExtractedEntryCount,
              totalEntriesOverall: totalEntriesOverall,
              formattedOverallExtractedBytes: formatBytes(overallExtractedBytes),
              formattedTotalUncompressedSizeOfAllArchives: formatBytes(totalUncompressedSizeOfAllArchives),
              eta: calculateEta(overallExtractedBytes, totalUncompressedSizeOfAllArchives, extractionStartTime)
            });
            await new Promise((resolve, reject) => {
              let cancelledDuringWrite = false;
              readStream.on('data', (chunk) => {
                bytesRead += chunk.length;
                overallExtractedBytes += chunk.length;
                const now = performance.now();
                if (now - lastExtractionProgressUpdateTime > 100 || bytesRead === totalBytes) {
                  lastExtractionProgressUpdateTime = now;
                  this.win.webContents.send('extraction-progress', {
                    current: i,
                    total: archiveFiles.length,
                    filename: file.name,
                    fileProgress: bytesRead,
                    fileTotal: totalBytes,
                    currentEntry: extractedEntryCount,
                    totalEntries: totalEntries,
                    overallExtractedBytes: overallExtractedBytes,
                    totalUncompressedSizeOfAllArchives: totalUncompressedSizeOfAllArchives,
                    overallExtractedEntryCount: overallExtractedEntryCount,
                    totalEntriesOverall: totalEntriesOverall,
                    formattedOverallExtractedBytes: formatBytes(overallExtractedBytes),
                    formattedTotalUncompressedSizeOfAllArchives: formatBytes(totalUncompressedSizeOfAllArchives),
                    eta: calculateEta(overallExtractedBytes, totalUncompressedSizeOfAllArchives, extractionStartTime)
                  });
                }
                if (this.isCancelled && !cancelledDuringWrite) {
                  cancelledDuringWrite = true;
                  readStream.destroy(new Error('Extraction cancelled'));
                  writeStream.destroy(new Error('Extraction cancelled'));
                }
              });
              readStream.pipe(writeStream);
              writeStream.on('finish', () => {
                if (!this.isCancelled) {
                  this.win.webContents.send('extraction-progress', {
                    current: i,
                    total: archiveFiles.length,
                    filename: file.name,
                    fileProgress: totalBytes,
                    fileTotal: totalBytes,
                    currentEntry: extractedEntryCount,
                    totalEntries: totalEntries,
                    overallExtractedBytes: overallExtractedBytes,
                    totalUncompressedSizeOfAllArchives: totalUncompressedSizeOfAllArchives,
                    overallExtractedEntryCount: overallExtractedEntryCount,
                    totalEntriesOverall: totalEntriesOverall,
                    formattedOverallExtractedBytes: formatBytes(overallExtractedBytes),
                    formattedTotalUncompressedSizeOfAllArchives: formatBytes(totalUncompressedSizeOfAllArchives),
                    eta: calculateEta(overallExtractedBytes, totalUncompressedSizeOfAllArchives, extractionStartTime)
                  });
                }
                resolve();
              });
              writeStream.on('error', (err) => {
                if (!this.isCancelled || err.message !== 'Extraction cancelled') {
                  this.downloadConsole.logError('Write stream error during extraction: ' + err.message);
                }
                reject(err);
              });
              readStream.on('error', (err) => {
                if (!this.isCancelled || err.message !== 'Extraction cancelled') {
                  this.downloadConsole.logError('Read stream error during extraction: ' + err.message);
                }
                reject(err);
              });
            });
          }
          entry = await zipfile.readEntry();
        }
        if (!this.isCancelled) {
          await fs.promises.unlink(filePath);
        }
      } catch (e) {
        this.downloadConsole.logExtractionError(file.name, e.message);
      } finally {
        if (zipfile) {
          await zipfile.close();
        }
        if (this.isCancelled && extractedFiles.length > 0) {
          for (const extractedFile of extractedFiles) {
            try {
              if (fs.existsSync(extractedFile)) {
                await fs.promises.unlink(extractedFile);
              }
            } catch (cleanupErr) {
              this.downloadConsole.logError(`Failed to clean up ${extractedFile}: ${cleanupErr.message}`);
            }
          }
        }
      }
      if (this.isCancelled) {
        break;
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
      overallExtractedBytes: this.isCancelled ? overallExtractedBytes : totalUncompressedSizeOfAllArchives,
      totalUncompressedSizeOfAllArchives: totalUncompressedSizeOfAllArchives,
      overallExtractedEntryCount: this.isCancelled ? overallExtractedEntryCount : totalEntriesOverall,
      totalEntriesOverall: totalEntriesOverall,
      formattedOverallExtractedBytes: formatBytes(this.isCancelled ? overallExtractedBytes : totalUncompressedSizeOfAllArchives),
      formattedTotalUncompressedSizeOfAllArchives: formatBytes(totalUncompressedSizeOfAllArchives),
      eta: '--'
    });
    if (this.isCancelled) {
      this.downloadConsole.logExtractionCancelled();
      this.win.webContents.send('extraction-ended');
    } else {
      this.downloadConsole.logExtractionProcessComplete();
      this.win.webContents.send('extraction-ended');
    }
  }
}

export default DownloadManager;