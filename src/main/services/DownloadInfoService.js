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

  async getDownloadInfo(win, baseUrl, files, targetDir, createSubfolder = false) {
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

export default DownloadInfoService;
