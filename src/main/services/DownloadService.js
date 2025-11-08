const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const axios = require('axios');

class DownloadService {
  constructor() {
    this.downloadCancelled = false;
    this.httpAgent = new https.Agent({ keepAlive: true });
    this.abortController = new AbortController();
  }

  cancel() {
    this.downloadCancelled = true;
    this.abortController.abort();
  }

  isCancelled() {
    return this.downloadCancelled;
  }

  reset() {
    this.downloadCancelled = false;
    this.abortController = new AbortController();
  }

  async downloadFiles(win, baseUrl, files, targetDir, totalSize, initialDownloadedSize = 0, createSubfolder = false, unzipFiles = false) {
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

    for (const fileInfo of files) {
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
            win.webContents.send('download-log', `Error creating subfolder ${finalTargetDir}: ${mkdirErr.message}`);
          }
        }
      }

      const targetPath = path.join(finalTargetDir, filename);
      const fileUrl = new URL(fileInfo.href, baseUrl).href;
      const fileSize = fileInfo.size || 0;
      let fileDownloaded = 0;

      try {
        const response = await session.get(fileUrl, {
          responseType: 'stream',
          timeout: 30000,
          signal: this.abortController.signal
        });

        const writer = fs.createWriteStream(targetPath, {
          highWaterMark: 1024 * 1024
        });

        response.data.on('data', (chunk) => {
          if (this.isCancelled()) {
            response.request.abort();
            writer.close();
            const err = new Error("CANCELLED_MID_FILE");
            err.partialFile = { path: targetPath, name: filename };
            currentFileError = err;
            return;
          }
          fileDownloaded += chunk.length;
          totalDownloaded += chunk.length;
          win.webContents.send('download-file-progress', {
            name: filename,
            current: fileDownloaded,
            total: fileSize
          });
          win.webContents.send('download-overall-progress', {
            current: totalDownloaded,
            total: totalSize,
            skippedSize: initialDownloadedSize
          });
        });

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on('finish', () => {
            if (currentFileError) reject(currentFileError);
            else resolve();
          });
          writer.on('error', (err) => {
            reject(err);
          });
          response.data.on('error', (err) => {
            reject(err);
          });
        });

        // If unzip is enabled, unzip the file immediately after download
        if (unzipFiles && targetPath.endsWith('.zip')) {
          win.webContents.send('download-log', `DEBUG: Unzipping enabled for ${filename}, unzipFiles: ${unzipFiles}`);
          win.webContents.send('download-log', `Unzipping ${filename}...`);
          try {
            const UnzipService = require('./UnzipService.js');
            const unzipService = new UnzipService();
            await unzipService.unzipFile(win, targetPath, finalTargetDir);
          } catch (unzipErr) {
            win.webContents.send('download-log', `Warning: Failed to unzip ${filename}: ${unzipErr.message}`);
          }
        } else {
          win.webContents.send('download-log', `DEBUG: Unzip not triggered for ${filename}, unzipFiles: ${unzipFiles}, ends with .zip: ${targetPath.endsWith('.zip')}`);
        }

      } catch (e) {
        if (e.name === 'AbortError') {
          const err = new Error("CANCELLED_MID_FILE");
          err.partialFile = { path: targetPath, name: filename };
          throw err;
        }
        if (e.message.startsWith("CANCELLED_")) throw e;

        const errorMsg = `ERROR: Failed to download ${filename}. ${e.message}`;
        win.webContents.send('download-log', errorMsg);
        skippedFiles.push(`${filename} (Download failed)`);

        try {
          if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
        } catch (fsErr) {
        }
      }
    }

    return { message: "Download complete!", skippedFiles };
  }
}

module.exports = DownloadService;
