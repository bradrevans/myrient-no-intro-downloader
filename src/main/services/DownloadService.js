import fs from 'fs';
import path from 'path';
import https from 'https';
import { URL } from 'url';
import axios from 'axios';

/**
 * Service responsible for handling the actual downloading of files.
 */
class DownloadService {
  /**
   * Creates an instance of DownloadService.
   * @param {object} downloadConsole An instance of DownloadConsole for logging.
   */
  constructor(downloadConsole) {
    this.downloadCancelled = false;
    this.httpAgent = new https.Agent({ keepAlive: true });
    this.abortController = new AbortController();
    this.downloadConsole = downloadConsole;
  }

  /**
   * Cancels any ongoing download operations.
   */
  cancel() {
    this.downloadCancelled = true;
    this.abortController.abort();
  }

  /**
   * Checks if the current download operation has been cancelled.
   * @returns {boolean} True if cancelled, false otherwise.
   */
  isCancelled() {
    return this.downloadCancelled;
  }

  /**
   * Resets the download service's state, allowing for new download operations.
   */
  reset() {
    this.downloadCancelled = false;
    this.abortController = new AbortController();
  }

  /**
   * Downloads a list of files.
   * @param {object} win The Electron BrowserWindow instance for sending progress updates.
   * @param {string} baseUrl The base URL for the files.
   * @param {Array<object>} files An array of file objects to download.
   * @param {string} targetDir The target directory for downloads.
   * @param {number} totalSize The total size of all files to be downloaded (including already downloaded parts).
   * @param {number} [initialDownloadedSize=0] The size of files already downloaded or skipped initially.
   * @param {boolean} [createSubfolder=false] Whether to create subfolders for each download.
   * @param {number} totalFilesOverall The total number of files initially considered for download.
   * @param {number} initialSkippedFileCount The number of files initially skipped.
   * @returns {Promise<{skippedFiles: Array<string>}>} A promise that resolves with an object containing any skipped files.
   * @throws {Error} If the download is cancelled between files or mid-file.
   */
  async downloadFiles(win, baseUrl, files, targetDir, totalSize, initialDownloadedSize = 0, createSubfolder = false, totalFilesOverall, initialSkippedFileCount) {
    const session = axios.create({
      httpsAgent: this.httpAgent,
      timeout: 15000,
      headers: {
        'User-Agent': 'Wget/1.21.3 (linux-gnu)'
      }
    });

    let totalDownloaded = initialDownloadedSize;
    let currentFileError = null;
    const skippedFiles = [];
    let lastDownloadProgressUpdateTime = 0;

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const fileInfo = files[fileIndex];
      if (this.isCancelled()) {
        throw new Error("CANCELLED_BETWEEN_FILES");
      }

      if (fileInfo.skip) continue;

      const filename = fileInfo.name_raw;
      let finalTargetDir = targetDir;

      if (createSubfolder) {
        const gameName = path.parse(filename).name;
        finalTargetDir = path.join(targetDir, gameName);
        if (!fs.existsSync(finalTargetDir)) {
          try {
            fs.mkdirSync(finalTargetDir, { recursive: true });
          } catch (mkdirErr) {
            this.downloadConsole.logCreatingSubfolderError(finalTargetDir, mkdirErr.message);
          }
        }
      }

      const targetPath = path.join(finalTargetDir, filename);
      const fileUrl = new URL(fileInfo.href, baseUrl).href;
      const fileSize = fileInfo.size || 0;
      let fileDownloaded = fileInfo.downloadedBytes || 0;

      const headers = {
        'User-Agent': 'Wget/1.21.3 (linux-gnu)'
      };

      if (fileDownloaded > 0) {
        headers['Range'] = `bytes=${fileDownloaded}-`;
        this.downloadConsole.logResumingDownload(filename, fileDownloaded);
      }

      try {
        const response = await session.get(fileUrl, {
          responseType: 'stream',
          timeout: 30000,
          signal: this.abortController.signal,
          headers: headers
        });

        const writer = fs.createWriteStream(targetPath, {
          highWaterMark: 1024 * 1024,
          flags: fileDownloaded > 0 ? 'a' : 'w'
        });

        win.webContents.send('download-file-progress', {
          name: filename,
          current: fileDownloaded,
          total: fileSize,
          currentFileIndex: initialSkippedFileCount + fileIndex + 1,
          totalFilesToDownload: totalFilesOverall
        });

        response.data.on('data', (chunk) => {
          if (this.isCancelled()) {
            response.request.abort();
            writer.close();
            const err = new Error("CANCELLED_MID_FILE");
            err.partialFile = { path: targetPath, name: filename };
            reject(err);
            return;
          }
          fileDownloaded += chunk.length;
          totalDownloaded += chunk.length;

          const now = performance.now();
          if (now - lastDownloadProgressUpdateTime > 100 || fileDownloaded === fileSize) {
            lastDownloadProgressUpdateTime = now;
            win.webContents.send('download-file-progress', {
              name: filename,
              current: fileDownloaded,
              total: fileSize,
              currentFileIndex: initialSkippedFileCount + fileIndex + 1,
              totalFilesToDownload: totalFilesOverall
            });
            win.webContents.send('download-overall-progress', {
              current: totalDownloaded,
              total: totalSize,
              skippedSize: initialDownloadedSize
            });
          }
        });

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on('finish', () => {
            resolve();
          });
          writer.on('error', (err) => {
            reject(err);
          });
          response.data.on('error', (err) => {
            reject(err);
          });
        });

      } catch (e) {
        if (e.name === 'AbortError' || e.message.startsWith("CANCELLED_")) {
          const err = new Error("CANCELLED_MID_FILE");
          err.partialFile = { path: targetPath, name: filename };
          throw err;
        }

        this.downloadConsole.logError(`Failed to download ${filename}. ${e.message}`);
        skippedFiles.push(`${filename} (Download failed)`);

        try {
          if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
        } catch (fsErr) {
        }
      }
    }

    return { skippedFiles };
  }
}

export default DownloadService;
