import fs from 'fs';
import path from 'path';
import https from 'https';
import { URL } from 'url';
import axios from 'axios';

/**
 * Service responsible for gathering information about files to be downloaded.
 * This includes checking file sizes, and determining if files have been previously downloaded or extracted.
 */
class DownloadInfoService {
  /**
   * Creates an instance of DownloadInfoService.
   */
  constructor() {
    this.httpAgent = new https.Agent({ keepAlive: true });
    this.abortController = new AbortController();
  }

  /**
   * Cancels any ongoing download information retrieval processes.
   */
  cancel() {
    this.abortController.abort();
  }

  /**
   * Checks if the download information retrieval process has been cancelled.
   * @returns {boolean} True if cancelled, false otherwise.
   */
  isCancelled() {
    return this.abortController.signal.aborted;
  }

  /**
   * Resets the AbortController, allowing for new operations to be started.
   */
  reset() {
    this.abortController = new AbortController();
  }

  /**
   * Checks if a game has already been extracted to the target directory.
   * @param {string} targetDir The base directory where files are extracted.
   * @param {string} gameName The name of the game (usually derived from the filename).
   * @param {string} filename The original filename (e.g., "game.zip").
   * @param {boolean} createSubfolder Whether subfolders are created for each game.
   * @returns {Promise<boolean>} True if the game appears to be already extracted, false otherwise.
   * @private
   */
  async _isAlreadyExtracted(targetDir, gameName, filename, createSubfolder) {
    if (createSubfolder) {
      const subfolderPath = path.join(targetDir, gameName);
      try {
        if (fs.existsSync(subfolderPath) && fs.lstatSync(subfolderPath).isDirectory()) {
          const subfolderFiles = await fs.promises.readdir(subfolderPath);
          if (subfolderFiles.length > 0 && subfolderFiles.some(f => f.toLowerCase() !== filename.toLowerCase())) {
            return true;
          }
        }
      } catch (e) {
      }
    } else {
      try {
        const filesInDir = await fs.promises.readdir(targetDir);
        if (filesInDir.some(f => path.parse(f).name === gameName && path.extname(f).toLowerCase() !== '.zip')) {
          return true;
        }
      }
      catch (e) {
      }
    }
    return false;
  }

  /**
   * Gathers download information for a list of files, including total size,
   * and identifies files that can be skipped due to prior download or extraction.
   * @param {object} win The Electron BrowserWindow instance for sending progress updates.
   * @param {string} baseUrl The base URL for the files.
   * @param {Array<object>} files An array of file objects, each with at least `name_raw` and `href`.
   * @param {string} targetDir The target directory for downloads.
   * @param {boolean} [createSubfolder=false] Whether to create subfolders for each download.
   * @returns {Promise<object>} An object containing:
   *   - `filesToDownload`: Array of file objects that need to be downloaded.
   *   - `totalSize`: Total size of all files (including skipped ones).
   *   - `skippedSize`: Total size of skipped files.
   *   - `skippedFiles`: Array of file objects that were skipped.
   *   - `skippedBecauseExtractedCount`: Number of files skipped because they were already extracted.
   *   - `skippedBecauseDownloadedCount`: Number of files skipped because they were already downloaded.
   * @throws {Error} If the scan is cancelled.
   */
  async getDownloadInfo(win, baseUrl, files, targetDir, createSubfolder = false) {
    let totalSize = 0;
    let skippedSize = 0;
    const filesToDownload = [];
    const skippedFiles = [];
    let skippedBecauseExtractedCount = 0;
    let skippedBecauseDownloadedCount = 0;

    const session = axios.create({
      httpsAgent: this.httpAgent,
      timeout: 15000,
      headers: {
        'User-Agent': 'Wget/1.21.3 (linux-gnu)'
      },
      signal: this.abortController.signal
    });

    for (let i = 0; i < files.length; i++) {
      if (this.isCancelled()) throw new Error("CANCELLED_SCAN");

      const fileInfo = files[i];
      const filename = fileInfo.name_raw;
      const gameName = path.parse(filename).name;
      const fileUrl = new URL(fileInfo.href, baseUrl).href;

      if (await this._isAlreadyExtracted(targetDir, gameName, filename, createSubfolder)) {
        fileInfo.skip = true;
        skippedBecauseExtractedCount++;
        try {
          const response = await session.head(fileUrl, { timeout: 15000 });
          const remoteSize = parseInt(response.headers['content-length'] || '0', 10);
          fileInfo.size = remoteSize;
          totalSize += remoteSize;
          skippedSize += remoteSize;
        } catch (e) {
        }
        skippedFiles.push(fileInfo);
        win.webContents.send('download-scan-progress', { current: i + 1, total: files.length });
        continue;
      }

      let finalTargetDir = targetDir;
      if (createSubfolder) {
        finalTargetDir = path.join(targetDir, gameName);
      }
      const targetPath = path.join(finalTargetDir, filename);

      try {
        const response = await session.head(fileUrl, { timeout: 15000 });
        const remoteSize = parseInt(response.headers['content-length'] || '0', 10);

        fileInfo.size = remoteSize;
        totalSize += remoteSize;

        if (fs.existsSync(targetPath)) {
          const localSize = fs.statSync(targetPath).size;
          if (remoteSize > 0 && localSize === remoteSize) {
            fileInfo.skip = true;
            skippedBecauseDownloadedCount++;
            skippedSize += remoteSize;
            skippedFiles.push(fileInfo);
          } else if (remoteSize > 0 && localSize < remoteSize) {
            fileInfo.skip = false;
            fileInfo.downloadedBytes = localSize;
            skippedSize += localSize;
            filesToDownload.push(fileInfo);
          } else {
            fileInfo.skip = false;
            filesToDownload.push(fileInfo);
          }
        } else {
          fileInfo.skip = false;
          filesToDownload.push(fileInfo);
        }
      } catch (e) {
        skippedFiles.push(`${filename} (Scan failed)`);
        fileInfo.skip = true;
      }
      win.webContents.send('download-scan-progress', { current: i + 1, total: files.length });
    }

    return { filesToDownload, totalSize, skippedSize, skippedFiles, skippedBecauseExtractedCount, skippedBecauseDownloadedCount };
  }
}

export default DownloadInfoService;
