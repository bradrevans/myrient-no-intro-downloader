import { MYRIENT_BASE_URL, DownloadDirectoryStructure } from './constants.js';
import electron from 'electron';
const { ipcMain, dialog, shell } = electron;
import fs from 'fs';
import MyrientService from './services/MyrientService.js';
import FilterService from './services/FilterService.js';
import DownloadManager from './services/DownloadManager.js';
import FileSystemService from './services/FileSystemService.js';

import DownloadConsole from './services/DownloadConsole.js';

class IpcManager {
  constructor(win) {
    this.win = win;
    this.myrientService = new MyrientService();
    this.filterService = new FilterService();
    this.downloadConsole = new DownloadConsole(win);
    this.downloadManager = new DownloadManager(win, this.downloadConsole);
    this.fileSystemService = new FileSystemService();
  }

  setupIpcHandlers() {
    ipcMain.handle('get-myrient-base-url', () => {
      return MYRIENT_BASE_URL;
    });

    ipcMain.handle('get-main-archives', async () => {
      try {
        const data = await this.myrientService.getMainArchives(MYRIENT_BASE_URL);
        return { data };
      } catch (e) {
        return { error: e.message };
      }
    });

    ipcMain.handle('get-directory-list', async (event, archiveUrl) => {
      try {
        const data = await this.myrientService.getDirectoryList(archiveUrl);
        return data;
      } catch (e) {
        return { error: e.message };
      }
    });

    ipcMain.handle('scrape-and-parse-files', async (event, pageUrl) => {
      try {
        const data = await this.myrientService.scrapeAndParseFiles(pageUrl);
        return data;
      } catch (e) {
        return { error: e.message };
      }
    });

    ipcMain.handle('filter-files', (event, allFiles, allTags, filters) => {
      try {
        return { data: this.filterService.applyFilters(allFiles, allTags, filters) };
      } catch (e) {
        return { error: e.message };
      }
    });

    ipcMain.handle('get-download-directory', async () => {
      const { canceled, filePaths } = await dialog.showOpenDialog(this.win, {
        title: 'Select Download Directory',
        properties: ['openDirectory', 'createDirectory']
      });
      if (canceled || filePaths.length === 0) return null;
      return filePaths[0];
    });

    ipcMain.handle('check-download-directory-structure', async (event, downloadPath) => {
      try {
        const structure = await this.fileSystemService.checkDownloadDirectoryStructure(downloadPath);
        return { data: structure };
      } catch (e) {
        return { error: e.message };
      }
    });

    ipcMain.handle('get-download-directory-structure-enum', () => {
      return { data: DownloadDirectoryStructure };
    });

    ipcMain.on('cancel-download', () => {
      this.downloadManager.cancel();
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
      shell.openExternal(url);
    });

    ipcMain.on('window-minimize', () => this.win.minimize());
    ipcMain.on('window-maximize-restore', () => {
      if (this.win.isMaximized()) {
        this.win.unmaximize();
      } else {
        this.win.maximize();
      }
    });
    ipcMain.on('window-close', () => this.win.close());

    ipcMain.on('zoom-in', () => {
      const currentZoom = this.win.webContents.getZoomFactor();
      this.win.webContents.setZoomFactor(currentZoom + 0.1);
    });

    ipcMain.on('zoom-out', () => {
      const currentZoom = this.win.webContents.getZoomFactor();
      this.win.webContents.setZoomFactor(currentZoom - 0.1);
    });

    ipcMain.on('zoom-reset', () => {
      this.win.webContents.setZoomFactor(1);
    });

    ipcMain.handle('get-zoom-factor', () => {
      return this.win.webContents.getZoomFactor();
    });

    ipcMain.on('set-zoom-factor', (event, factor) => {
      this.win.webContents.setZoomFactor(factor);
    });

    ipcMain.handle('start-download', async (event, baseUrl, files, targetDir, createSubfolder, extractAndDelete, extractPreviouslyDownloaded) => {
      try {
        return await this.downloadManager.startDownload(baseUrl, files, targetDir, createSubfolder, extractAndDelete, extractPreviouslyDownloaded);
      } catch (e) {
        return { error: e && e.message ? e.message : String(e) };
      }
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
}

export default IpcManager;
