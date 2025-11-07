const { MYRIENT_BASE_URL } = require('./constants.js');
const { ipcMain, dialog, shell } = require('electron');
const fs = require('fs');
const MyrientService = require('./services/MyrientService.js');
const FilterService = require('./services/FilterService.js');
const DownloadManager = require('./services/DownloadManager.js');

function setupIpcHandlers(win) {
  const myrientService = new MyrientService();
  const filterService = new FilterService();
  const downloadManager = new DownloadManager(win);

  ipcMain.handle('get-myrient-base-url', () => {
    return MYRIENT_BASE_URL;
  });

  ipcMain.handle('get-main-archives', async () => {
    try {
      const data = await myrientService.getMainArchives(MYRIENT_BASE_URL);
      return { data };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('get-directory-list', async (event, archiveUrl) => {
    try {
      const data = await myrientService.getDirectoryList(archiveUrl);
      return data;
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('scrape-and-parse-files', async (event, pageUrl) => {
    try {
      const data = await myrientService.scrapeAndParseFiles(pageUrl);
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
    downloadManager.cancel();
  });

  ipcMain.handle('delete-file', async (event, filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return { success: true };
      }
      return { success: false, error: 'File not found.' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.on('open-external', (event, url) => {
    if (url.startsWith('https://github.com') || url.startsWith('https://myrient.erista.me')) {
      shell.openExternal(url);
    } else {
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

  ipcMain.on('zoom-in', () => {
    const currentZoom = win.webContents.getZoomFactor();
    win.webContents.setZoomFactor(currentZoom + 0.1);
  });

  ipcMain.on('zoom-out', () => {
    const currentZoom = win.webContents.getZoomFactor();
    win.webContents.setZoomFactor(currentZoom - 0.1);
  });

  ipcMain.on('zoom-reset', () => {
    win.webContents.setZoomFactor(1);
  });

  ipcMain.handle('get-zoom-factor', () => {
    return win.webContents.getZoomFactor();
  });

  ipcMain.on('set-zoom-factor', (event, factor) => {
    win.webContents.setZoomFactor(factor);
  });

  ipcMain.handle('start-download', async (event, baseUrl, files, targetDir, createSubfolder) => {
    return await downloadManager.startDownload(baseUrl, files, targetDir, createSubfolder);
  });

  ipcMain.on('log-message', (event, level, message) => {
  });

  ipcMain.handle('read-file', async (event, filePath) => {
    try {
      const fileContent = await fs.promises.readFile(filePath, 'utf8');
      return { data: fileContent };
    } catch (e) {
      return { error: e.message };
    }
  });
}

module.exports = { setupIpcHandlers };