import fs from 'fs';
import path from 'path';
import https from 'https';
import { URL } from 'url';
import axios from 'axios';
import { Throttle } from '@kldzj/stream-throttle';

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
   * @param {Array<object>} files An array of file objects to download, potentially including a `relativePath` property for directory structure.
   * @param {string} targetDir The target directory for downloads.
   * @param {number} totalSize The total size of all files to be downloaded (including already downloaded parts).
   * @param {number} [initialDownloadedSize=0] The size of files already downloaded or skipped initially.
   * @param {boolean} [createSubfolder=false] Whether to create subfolders for each download.
   * @param {boolean} [maintainFolderStructure=false] Whether to maintain the site's folder structure.
   * @param {number} totalFilesOverall The total number of files initially considered for download.
   * @param {number} initialSkippedFileCount The number of files initially skipped.
   * @param {boolean} isThrottlingEnabled Whether to enable download throttling.
   * @param {number} throttleSpeed The download speed limit in MB/s.
   * @param {string} throttleUnit The unit for the download speed limit (KB/s or MB/s).
   * @returns {Promise<{skippedFiles: Array<string>}>} A promise that resolves with an object containing any skipped files.
   * @throws {Error} If the download is cancelled between files or mid-file.
   */
  async downloadFiles(win, baseUrl, files, targetDir, totalSize, initialDownloadedSize = 0, createSubfolder = false, maintainFolderStructure = false, totalFilesOverall, initialSkippedFileCount, isThrottlingEnabled = false, throttleSpeed = 10, throttleUnit = 'MB/s') {
    const session = axios.create({
      httpsAgent: this.httpAgent,
      timeout: 15000,
      headers: {
        'User-Agent': 'Wget/1.21.3 (linux-gnu)'
      }
    });

    let totalDownloaded = initialDownloadedSize;
    let totalBytesFailed = 0;
    const skippedFiles = [];
    let lastDownloadProgressUpdateTime = 0;

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const fileInfo = files[fileIndex];
      if (this.isCancelled()) {
        throw new Error("CANCELLED_BETWEEN_FILES");
      }

      if (fileInfo.skip) continue;

      const filename = fileInfo.name;
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

      let targetPath;
      if (maintainFolderStructure && fileInfo.href) {
        // Extract relative path by comparing href with baseUrl
        let relativePath = fileInfo.href;
        
        try {
          // Parse both URLs to get their pathname components
          const hrefUrl = new URL(fileInfo.href);
          const baseUrlObj = new URL(baseUrl);
          
          // Get the pathname from both (e.g., "/files/Total%20DOS%20Collection/Games/Applications/file.zip")
          let hrefPath = hrefUrl.pathname;
          let basePath = baseUrlObj.pathname;
          
          // Remove trailing slash from basePath to get the parent directory
          basePath = basePath.replace(/\/$/, '');
          
          // Extract the last segment of basePath (e.g., "Games")
          const basePathSegments = basePath.split('/').filter(s => s.length > 0);
          const selectedDirectory = basePathSegments[basePathSegments.length - 1];
          
          // Get the parent path (everything before the selected directory)
          const parentPath = basePath.substring(0, basePath.lastIndexOf('/' + selectedDirectory));
          
          // If hrefPath starts with parentPath, extract relative portion including selected directory
          if (parentPath && hrefPath.startsWith(parentPath + '/')) {
            relativePath = hrefPath.substring(parentPath.length + 1); // +1 to remove leading slash
          } else if (hrefPath.startsWith(basePath + '/')) {
            // Fallback: if parentPath logic fails, at least include the selected directory
            relativePath = selectedDirectory + '/' + hrefPath.substring(basePath.length + 1);
          } else {
            // Fallback: just use the filename
            relativePath = filename;
          }
          
          // Decode URL encoding
          relativePath = decodeURIComponent(relativePath);
          
        } catch (e) {
          // If URL parsing fails, treat href as a simple path
          // Try string-based removal of baseUrl
          if (relativePath.startsWith(baseUrl)) {
            relativePath = relativePath.substring(baseUrl.length);
          }
          relativePath = relativePath.replace(/^\/+/, '');
        }
        
        // Extract directory path from relative path (e.g., "Games/Applications/file.zip" -> "Games/Applications")
        const hrefDirPath = path.dirname(relativePath);
        if (hrefDirPath && hrefDirPath !== '.' && hrefDirPath !== '/') {
          // Normalize path separators for Windows
          const normalizedDirPath = hrefDirPath.replace(/\//g, path.sep);
          
          // Create the folder structure within the target directory
          const fullDirPath = path.join(finalTargetDir, normalizedDirPath);
          if (!fs.existsSync(fullDirPath)) {
            try {
              fs.mkdirSync(fullDirPath, { recursive: true });
            } catch (mkdirErr) {
              this.downloadConsole.logCreatingSubfolderError(fullDirPath, mkdirErr.message);
            }
          }
          targetPath = path.join(fullDirPath, filename);
        } else {
          targetPath = path.join(finalTargetDir, filename);
        }
      } else {
        targetPath = path.join(finalTargetDir, filename);
      }
      const fileUrl = fileInfo.href;
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

        let stream = response.data;
        if (isThrottlingEnabled) {
          let bytesPerSecond = throttleSpeed * 1024;
          if (throttleUnit === 'MB/s') {
            bytesPerSecond = throttleSpeed * 1024 * 1024;
          }
          const throttle = new Throttle({ rate: bytesPerSecond });
          stream = response.data.pipe(throttle);
        }

        await new Promise((resolve, reject) => {
          const cleanupAndReject = (errMessage) => {
            writer.close(() => {
              if (fs.existsSync(targetPath)) {
                this.downloadConsole.log(`Cleaning up partial file: ${filename}`);
                fs.unlink(targetPath, (unlinkErr) => {
                  if (unlinkErr) {
                    console.error(`Failed to delete partial file: ${targetPath}`, unlinkErr);
                  }
                  const err = new Error(errMessage);
                  err.partialFile = { path: targetPath, name: filename };
                  reject(err);
                });
              } else {
                const err = new Error(errMessage);
                err.partialFile = { path: targetPath, name: filename };
                reject(err);
              }
            });
          };

          stream.on('data', (chunk) => {
            if (this.isCancelled()) {
              response.request.abort();
              cleanupAndReject("CANCELLED_MID_FILE");
              return;
            }
            fileDownloaded += chunk.length;
            totalDownloaded += chunk.length;
            writer.write(chunk);

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
                total: totalSize - totalBytesFailed,
                skippedSize: initialDownloadedSize
              });
            }
          });

          stream.on('end', () => {
            writer.end();
          });

          writer.on('finish', () => {
            resolve();
          });
          writer.on('error', (err) => {
            reject(err);
          });
          stream.on('error', (err) => {
            if (this.isCancelled()) {
              cleanupAndReject("CANCELLED_MID_FILE");
            } else {
              reject(err);
            }
          });
        });

      } catch (e) {
        if (e.name === 'AbortError' || e.message.startsWith("CANCELLED_")) {
          throw e;
        }

        this.downloadConsole.logError(`Failed to download ${filename}. ${e.message}`);
        skippedFiles.push(filename);

        totalDownloaded -= fileDownloaded;
        totalBytesFailed += fileSize;

        win.webContents.send('download-overall-progress', {
          current: totalDownloaded,
          total: totalSize - totalBytesFailed,
          skippedSize: initialDownloadedSize
        });

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
