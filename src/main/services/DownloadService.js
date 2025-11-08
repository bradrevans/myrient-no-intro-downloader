import fs from 'fs';
import path from 'path';
import https from 'https';
import { URL } from 'url';
import axios from 'axios';

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
    let lastDownloadProgressUpdateTime = 0; // Added for throttling

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
            win.webContents.send('download-log', `Error creating subfolder ${finalTargetDir}: ${mkdirErr.message}`);
          }
        }
      }

      const targetPath = path.join(finalTargetDir, filename);
      const fileUrl = new URL(fileInfo.href, baseUrl).href;
      const fileSize = fileInfo.size || 0;
      let fileDownloaded = fileInfo.downloadedBytes || 0; // Initialize with already downloaded bytes

      const headers = {
        'User-Agent': 'Wget/1.21.3 (linux-gnu)'
      };

      if (fileDownloaded > 0) {
        headers['Range'] = `bytes=${fileDownloaded}-`;
        win.webContents.send('download-log', `Resuming download for ${filename} from ${fileDownloaded} bytes.`);
      }

      try {
        const response = await session.get(fileUrl, {
          responseType: 'stream',
          timeout: 30000,
          signal: this.abortController.signal,
          headers: headers // Use the modified headers
        });

        const writer = fs.createWriteStream(targetPath, {
          highWaterMark: 1024 * 1024,
          flags: fileDownloaded > 0 ? 'a' : 'w' // Append if resuming, otherwise write
        });

        // Send initial progress update for the file
        win.webContents.send('download-file-progress', {
          name: filename,
          current: fileDownloaded, // Start current progress from downloadedBytes
          total: fileSize,
          currentFileIndex: initialSkippedFileCount + fileIndex + 1, // Account for initially skipped files
          totalFilesToDownload: totalFilesOverall // Use the overall total file count
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

          const now = performance.now();
          if (now - lastDownloadProgressUpdateTime > 100 || fileDownloaded === fileSize) { // Throttle updates
            lastDownloadProgressUpdateTime = now;
            win.webContents.send('download-file-progress', {
              name: filename,
              current: fileDownloaded,
              total: fileSize,
              currentFileIndex: initialSkippedFileCount + fileIndex + 1, // Account for initially skipped files
              totalFilesToDownload: totalFilesOverall // Use the overall total file count
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
            // Ensure final progress update is sent
            win.webContents.send('download-file-progress', {
              name: filename,
              current: fileSize,
              total: fileSize,
              currentFileIndex: initialSkippedFileCount + fileIndex + 1, // Account for initially skipped files
              totalFilesToDownload: totalFilesOverall // Use the overall total file count
            });
            win.webContents.send('download-overall-progress', {
              current: totalDownloaded,
              total: totalSize,
              skippedSize: initialDownloadedSize
            });

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

export default DownloadService;
