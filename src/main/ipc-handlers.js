const { ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { URL } = require('url');
const axios = require('axios');
const log = require('electron-log');
const myrient = require('./services/myrient.js');
const filterService = require('./services/filter.js');
const fileParser = require('./services/file-parser.js');
const downloadManager = require('./services/download-manager.js');

function setupIpcHandlers(win) {
  ipcMain.handle('get-main-archives', async () => {
    try {
      const data = await myrient.getMainArchives("https://myrient.erista.me/files/");
      return { data };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('get-directory-list', async (event, archiveUrl) => {
    try {
      const data = await myrient.getDirectoryList(archiveUrl);
      return data;
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('scrape-and-parse-files', async (event, pageUrl) => {
    try {
      const data = await myrient.scrapeAndParseFiles(pageUrl);
      return data;
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('filter-files', (event, allFiles, allTags, filters) => {
    try {
      return { data: filterService.applyFilters(allFiles, allTags, filters) };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('get-download-directory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Select Download Directory',
      properties: ['openDirectory', 'createDirectory']
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  });

  ipcMain.on('cancel-download', () => {
    log.info('Received cancel signal from renderer.');
    downloadManager.cancel();
  });

  ipcMain.handle('delete-file', async (event, filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        log.info(`Deleted partial file: ${filePath}`);
        return { success: true };
      }
      return { success: false, error: 'File not found.' };
    } catch (e) {
      log.error(`Failed to delete partial file ${filePath}: ${e.message}`);
      return { success: false, error: e.message };
    }
  });

  ipcMain.on('open-external', (event, url) => {
    if (url.startsWith('https://github.com') || url.startsWith('https://myrient.erista.me')) {
      shell.openExternal(url);
    } else {
      log.warn(`Blocked attempt to open invalid external URL: ${url}`);
    }
  });

  ipcMain.on('window-minimize', () => win.minimize());
  ipcMain.on('window-maximize-restore', () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });
  ipcMain.on('window-close', () => win.close());

  ipcMain.handle('start-download', async (event, baseUrl, files, targetDir) => {
    downloadManager.reset();

    let allSkippedFiles = [];
    let totalSize = 0;
    let skippedSize = 0;
    let summaryMessage = "";
    let wasCancelled = false;
    let partialFile = null;

    try {
      const scanResult = await downloadManager.getDownloadInfo(win, baseUrl, files, targetDir);

      const filesToDownload = scanResult.filesToDownload;
      totalSize = scanResult.totalSize;
      skippedSize = scanResult.skippedSize;
      allSkippedFiles.push(...scanResult.skippedFiles);

      if (filesToDownload.length === 0) {
        summaryMessage = "All matched files already exist locally. Nothing to download.";
      } else {
        win.webContents.send('download-log', `Total download size: ${(totalSize / (1024 ** 3)).toFixed(2)} GB (${filesToDownload.length} files)`);
        win.webContents.send('download-overall-progress', { current: skippedSize, total: totalSize, skippedSize: skippedSize });

        const downloadResult = await downloadManager.downloadFiles(win, baseUrl, filesToDownload, targetDir, totalSize, skippedSize);
        summaryMessage = downloadResult.message;
        allSkippedFiles.push(...downloadResult.skippedFiles);
      }

    } catch (e) {
      if (e.message.startsWith("CANCELLED_")) {
        log.warn("Download was cancelled by user.");
        summaryMessage = "Download cancelled by user.";
        wasCancelled = true;
        if (e.message === "CANCELLED_MID_FILE") {
          partialFile = e.partialFile || null;
        }
      } else {
        log.error(`[start-download] Unhandled Error: ${e.message}`);
        summaryMessage = `Error: ${e.message}`;
        win.webContents.send('download-log', summaryMessage);
      }
    }

    win.webContents.send('download-complete', {
      message: summaryMessage,
      skippedFiles: allSkippedFiles,
      wasCancelled: wasCancelled,
      partialFile: partialFile
    });

    return { success: true };
  });

  ipcMain.on('log-message', (event, level, message) => {
    log[level](message);
  });
}

module.exports = { setupIpcHandlers };