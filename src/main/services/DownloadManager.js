const DownloadInfoService = require('./DownloadInfoService.js');
const DownloadService = require('./DownloadService.js');

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

  async startDownload(baseUrl, files, targetDir, createSubfolder, unzipFiles = false) {
    this.reset();

    let allSkippedFiles = [];
    let totalSize = 0;
    let skippedSize = 0;
    let summaryMessage = "";
    let wasCancelled = false;
    let partialFile = null;

    try {
      const scanResult = await this.downloadInfoService.getDownloadInfo(this.win, baseUrl, files, targetDir, createSubfolder, unzipFiles);

      const filesToDownload = scanResult.filesToDownload;
      totalSize = scanResult.totalSize;
      skippedSize = scanResult.skippedSize;
      allSkippedFiles.push(...scanResult.skippedFiles);

      if (filesToDownload.length === 0) {
        summaryMessage = "All matched files already exist locally. Nothing to download.";
      } else {
        this.win.webContents.send('download-log', `Total download size: ${(totalSize / (1024 ** 3)).toFixed(2)} GB (${filesToDownload.length} files)`);
        this.win.webContents.send('download-overall-progress', { current: skippedSize, total: totalSize, skippedSize: skippedSize });

        const downloadResult = await this.downloadService.downloadFiles(this.win, baseUrl, filesToDownload, targetDir, totalSize, skippedSize, createSubfolder, unzipFiles);
        summaryMessage = downloadResult.message;
        allSkippedFiles.push(...downloadResult.skippedFiles);
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

    this.win.webContents.send('download-complete', {
      message: summaryMessage,
      skippedFiles: allSkippedFiles,
      wasCancelled: wasCancelled,
      partialFile: partialFile
    });

    return { success: true };
  }
}

module.exports = DownloadManager;
