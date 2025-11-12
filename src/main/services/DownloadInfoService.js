import fs from 'fs';
import path from 'path';
import https from 'https';
import { URL } from 'url';
import axios from 'axios';
import MyrientService from './MyrientService.js';

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
    this.myrientService = new MyrientService();
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
   * Recursively fetches all file links within a given directory URL and its subdirectories.
   * @param {string} directoryUrl The URL of the directory to scan.
   * @param {string} [currentRelativePath=''] The current relative path from the initial selected directory.
   * @returns {Promise<Array<object>>} A flattened array of file objects found within the directory and its subdirectories.
   * @private
   */
  async _recursivelyGetFilesInDirectory(directoryUrl, currentRelativePath = '') {
    let allFiles = [];
    const html = await this.myrientService.getPage(directoryUrl);
    const links = this.myrientService.parseLinks(html);

    for (const link of links) {
      if (this.isCancelled()) throw new Error("CANCELLED_SCAN");

      const fullUrl = new URL(link.href, directoryUrl).href;
      if (link.isDir) {
        allFiles = allFiles.concat(await this._recursivelyGetFilesInDirectory(fullUrl, path.join(currentRelativePath, link.name)));
      } else {
        allFiles.push({ name: link.name, href: fullUrl, type: 'file', relativePath: path.join(currentRelativePath, link.name) });
      }
    }
    return allFiles;
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
  async _isAlreadyExtracted(targetDir, filename, createSubfolder) {
    const gameName = path.parse(filename).name;
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
   * Gathers download information for a list of files and/or directories, including total size,
   * and identifies files that can be skipped due to prior download or extraction.
   * @param {object} win The Electron BrowserWindow instance for sending progress updates.
   * @param {string} baseUrl The base URL for the items.
   * @param {Array<object>} items An array of file and/or directory objects, each with at least `name_raw`, `href`, and `type`.
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
  async getDownloadInfo(win, baseUrl, items, targetDir, createSubfolder = false) {
    let totalSize = 0;
    let skippedSize = 0;
    const filesToDownload = [];
    const skippedFiles = [];
    let skippedBecauseExtractedCount = 0;
    let skippedBecauseDownloadedCount = 0;

    const allFilesToProcess = [];
    for (const item of items) {
      if (item.type === 'directory') {
        const directoryUrl = new URL(item.href, baseUrl).href;
        const filesInDir = await this._recursivelyGetFilesInDirectory(directoryUrl, item.name_raw);
        allFilesToProcess.push(...filesInDir);
      } else {
        allFilesToProcess.push({ name: item.name_raw, href: new URL(item.href, baseUrl).href, type: 'file', relativePath: item.name_raw });
      }
    }

    const session = axios.create({
      httpsAgent: this.httpAgent,
      timeout: 15000,
      headers: {
        'User-Agent': 'Wget/1.21.3 (linux-gnu)'
      },
      signal: this.abortController.signal
    });

    for (let i = 0; i < allFilesToProcess.length; i++) {
      if (this.isCancelled()) throw new Error("CANCELLED_SCAN");

      const fileInfo = allFilesToProcess[i];
      const filename = fileInfo.name;
      const fileUrl = fileInfo.href;

      if (await this._isAlreadyExtracted(targetDir, filename, createSubfolder)) {
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
        win.webContents.send('download-scan-progress', { current: i + 1, total: allFilesToProcess.length });
        continue;
      }

      let finalTargetDir = targetDir;
      if (createSubfolder) {
        finalTargetDir = path.join(targetDir, path.parse(filename).name);
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
      win.webContents.send('download-scan-progress', { current: i + 1, total: allFilesToProcess.length });
    }

    return { filesToDownload, totalSize, skippedSize, skippedFiles, skippedBecauseExtractedCount, skippedBecauseDownloadedCount };
  }
}

export default DownloadInfoService;
