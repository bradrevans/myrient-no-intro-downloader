const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const axios = require('axios');

class DownloadInfoService {
  constructor() {
    this.httpAgent = new https.Agent({ keepAlive: true });
    this.abortController = new AbortController();
  }

  cancel() {
    this.abortController.abort();
  }

  isCancelled() {
    return this.abortController.signal.aborted;
  }

  reset() {
    this.abortController = new AbortController();
  }

  checkIfExtractedFilesExist(targetDir, zipFilename) {
    try {
      // Simple check: look for any files in the target directory that might be from this zip
      const files = fs.readdirSync(targetDir);
      const baseName = path.parse(zipFilename).name;

      // Look for files that start with the same base name (common pattern for zip contents)
      return files.some(file => file.startsWith(baseName) && !file.endsWith('.zip'));
    } catch (e) {
      return false;
    }
  }

  async getDownloadInfo(win, baseUrl, files, targetDir, createSubfolder = false, unzipFiles = false) {
    let totalSize = 0;
    let skippedSize = 0;
    const filesToDownload = [];
    const skippedFiles = [];
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
      let finalTargetDir = targetDir;

      if (createSubfolder) {
        const gameName = path.parse(filename).name;
        finalTargetDir = path.join(targetDir, gameName);
      }

      const targetPath = path.join(finalTargetDir, filename);
      const fileUrl = new URL(fileInfo.href, baseUrl).href;

      try {
        const response = await session.head(fileUrl, { timeout: 15000 });
        const remoteSize = parseInt(response.headers['content-length'] || '0', 10);

        fileInfo.size = remoteSize;
        totalSize += remoteSize;

        if (unzipFiles && targetPath.endsWith('.zip')) {
          // For zip files when unzipping is enabled, check if extracted files exist
          const extractedFilesExist = this.checkIfExtractedFilesExist(finalTargetDir, filename);
          if (extractedFilesExist) {
            // Extracted files exist - skip this download
            fileInfo.skip = true;
            skippedSize += remoteSize;
          } else {
            // No extracted files found - need to download and unzip
            fileInfo.skip = false;
            filesToDownload.push(fileInfo);
          }
        } else {
          // Regular file handling - check if file exists with correct size
          if (fs.existsSync(targetPath)) {
            const localSize = fs.statSync(targetPath).size;
            if (remoteSize > 0 && localSize === remoteSize) {
              fileInfo.skip = true;
              skippedSize += remoteSize;
            } else {
              fileInfo.skip = false;
              filesToDownload.push(fileInfo);
            }
          } else {
            fileInfo.skip = false;
            filesToDownload.push(fileInfo);
          }
        }
      } catch (e) {
        const skipMsg = `SKIP: Could not get info for ${filename}. Error: ${e.message}`;
        win.webContents.send('download-log', skipMsg);
        skippedFiles.push(`${filename} (Scan failed)`);
        fileInfo.skip = true;
      }
      win.webContents.send('download-scan-progress', { current: i + 1, total: files.length });
    }

    return { filesToDownload, totalSize, skippedSize, skippedFiles };
  }
}

module.exports = DownloadInfoService;
