import fs from 'fs';
import path from 'path';
import https from 'https';
import { URL } from 'url';
import axios from 'axios';

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
