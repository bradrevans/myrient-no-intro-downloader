const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
const axios = require('axios');
const log = require('electron-log');

let downloadCancelled = false;

const httpAgent = new https.Agent({ keepAlive: true });

function cancel() {
  log.info('Download cancellation requested.');
  downloadCancelled = true;
}

function isCancelled() {
  return downloadCancelled;
}

function reset() {
  downloadCancelled = false;
}

async function getDownloadInfo(win, baseUrl, files, targetDir) {
  let totalSize = 0;
  let skippedSize = 0;
  const filesToDownload = [];
  const skippedFiles = [];
  const session = axios.create({
    httpsAgent: httpAgent,
    timeout: 15000,
    headers: {
      'User-Agent': 'Wget/1.21.3 (linux-gnu)'
    }
  });

  for (let i = 0; i < files.length; i++) {
    if (isCancelled()) throw new Error("CANCELLED_SCAN");

    const fileInfo = files[i];
    const filename = fileInfo.name_raw;
    const targetPath = path.join(targetDir, filename);
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
      log.warn(skipMsg);
      win.webContents.send('download-log', skipMsg);
      skippedFiles.push(`${filename} (Scan failed)`);
      fileInfo.skip = true;
    }
    win.webContents.send('download-scan-progress', { current: i + 1, total: files.length });
  }

  return { filesToDownload, totalSize, skippedSize, skippedFiles };
}

async function downloadFiles(win, baseUrl, files, targetDir, totalSize, initialDownloadedSize = 0) {
  const session = axios.create({
    httpsAgent: httpAgent,
    timeout: 15000,
    headers: {
      'User-Agent': 'Wget/1.21.3 (linux-gnu)'
    }
  });

  let totalDownloaded = initialDownloadedSize;
  let currentFileError = null;
  const skippedFiles = [];

  for (const fileInfo of files) {
    if (isCancelled()) {
      throw new Error("CANCELLED_BETWEEN_FILES");
    }

    if (fileInfo.skip) continue;

    const filename = fileInfo.name_raw;
    const targetPath = path.join(targetDir, filename);
    const fileUrl = new URL(fileInfo.href, baseUrl).href;
    const fileSize = fileInfo.size || 0;
    let fileDownloaded = 0;

    try {
      const response = await session.get(fileUrl, {
        responseType: 'stream',
        timeout: 30000
      });

      const writer = fs.createWriteStream(targetPath, {
        highWaterMark: 1024 * 1024
      });

      response.data.on('data', (chunk) => {
        if (isCancelled()) {
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
          log.error(`File write error for ${filename}: ${err.message}`);
          reject(err);
        });
        response.data.on('error', (err) => {
          log.error(`Download stream error for ${filename}: ${err.message}`);
          reject(err);
        });
      });

    } catch (e) {
      if (e.message.startsWith("CANCELLED_")) throw e;

      const errorMsg = `ERROR: Failed to download ${filename}. ${e.message}`;
      log.error(errorMsg);
      win.webContents.send('download-log', errorMsg);
      skippedFiles.push(`${filename} (Download failed)`);

      try {
        if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      } catch (fsErr) {
        log.error(`Failed to delete partial file ${targetPath}: ${fsErr.message}`);
      }
    }
  }

  return { message: "Download complete!", skippedFiles };
}

module.exports = {
  getDownloadInfo,
  downloadFiles,
  cancel,
  reset
};