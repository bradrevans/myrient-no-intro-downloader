import DownloadInfoService from './DownloadInfoService.js';
import DownloadService from './DownloadService.js';
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';

class DownloadManager {
  constructor(win) {
    this.win = win;
    this.downloadInfoService = new DownloadInfoService();
    this.downloadService = new DownloadService();
  }

  cancel() {
    this.downloadInfoService.cancel();
    this.downloadService.cancel();
  }

  reset() {
    this.downloadInfoService.reset();
    this.downloadService.reset();
  }

  async startDownload(baseUrl, files, targetDir, createSubfolder, extractAndDelete) {
    this.reset();

    let allSkippedFiles = [];
    let totalSize = 0;
    let skippedSize = 0;
    let summaryMessage = "";
    let wasCancelled = false;
    let partialFile = null;
    let downloadedFiles = [];

    try {
      const scanResult = await this.downloadInfoService.getDownloadInfo(this.win, baseUrl, files, targetDir, createSubfolder);

      const filesToDownload = scanResult.filesToDownload;
      totalSize = scanResult.totalSize;
      skippedSize = scanResult.skippedSize;
      allSkippedFiles.push(...scanResult.skippedFiles);

      if (filesToDownload.length === 0) {
        summaryMessage = "All matched files already exist locally. Nothing to download.";
      } else {
        this.win.webContents.send('download-log', `Total download size: ${(totalSize / (1024 ** 3)).toFixed(2)} GB (${filesToDownload.length} files)`);
        this.win.webContents.send('download-overall-progress', { current: skippedSize, total: totalSize, skippedSize: skippedSize });

        const downloadResult = await this.downloadService.downloadFiles(this.win, baseUrl, filesToDownload, targetDir, totalSize, skippedSize, createSubfolder);
        summaryMessage = downloadResult.message;
        allSkippedFiles.push(...downloadResult.skippedFiles);
        downloadedFiles = filesToDownload.filter(f => !downloadResult.skippedFiles.some(s => s.name === f.name));
      }

    } catch (e) {
      if (e.message.startsWith("CANCELLED_")) {
        summaryMessage = "Download cancelled by user.";
        wasCancelled = true;
        if (e.message === "CANCELLED_MID_FILE") {
          partialFile = e.partialFile || null;
        }
      } else {
        summaryMessage = `Error: ${e.message}`;
        this.win.webContents.send('download-log', summaryMessage);
      }
    }

    if (extractAndDelete && !wasCancelled && downloadedFiles.length > 0) {
      this.win.webContents.send('download-log', 'Download complete. Starting extraction...');
      await this.extractFiles(downloadedFiles, targetDir, createSubfolder);
    }

    this.win.webContents.send('download-complete', {
      message: summaryMessage,
      skippedFiles: allSkippedFiles,
      wasCancelled: wasCancelled,
      partialFile: partialFile
    });

    return { success: true };
  }

  async extractFiles(downloadedFiles, targetDir, createSubfolder) {
    const archiveFiles = downloadedFiles.filter(f => f.name_raw.toLowerCase().endsWith('.zip'));
    if (archiveFiles.length === 0) {
      this.win.webContents.send('download-log', 'No .zip archives found to extract.');
      return;
    }

    this.win.webContents.send('download-log', `Found ${archiveFiles.length} .zip archives to extract.`);

    for (let i = 0; i < archiveFiles.length; i++) {
      const file = archiveFiles[i];
      const subfolder = createSubfolder ? file.name_raw.replace(/\.[^/.]+$/, "") : '';
      const filePath = path.join(targetDir, subfolder, file.name_raw);

      try {
        this.win.webContents.send('download-log', `Extracting ${file.name_raw}...`);
        this.win.webContents.send('extraction-progress', { current: i, total: archiveFiles.length, filename: file.name_raw });

        const zip = new AdmZip(filePath);
        zip.extractAllTo(path.join(targetDir, subfolder), true);

        fs.unlinkSync(filePath);

      } catch (e) {
        this.win.webContents.send('download-log', `Error extracting ${file.name_raw}: ${e.message}`);
      }
    }
    this.win.webContents.send('extraction-progress', { current: archiveFiles.length, total: archiveFiles.length, filename: '' });
    this.win.webContents.send('download-log', 'Extraction process complete.');
  }
}

export default DownloadManager;
