import { MYRIENT_BASE_URL, DOWNLOAD_DIRECTORY_STRUCTURE } from './constants.js';
import electron from 'electron';
const { ipcMain, dialog, shell } = electron;
import fs from 'fs';
import MyrientService from './services/MyrientService.js';
import FilterService from './services/FilterService.js';
import DownloadManager from './services/DownloadManager.js';
import FileSystemService from './services/FileSystemService.js';

import DownloadConsole from './services/DownloadConsole.js';

/**
 * Manages Inter-Process Communication (IPC) between the main and renderer processes.
 * Handles requests from the renderer process and interacts with various services.
 */
class IpcManager {
  /**
   * Creates an instance of IpcManager.
   * @param {object} win The Electron BrowserWindow instance.
   */
  constructor(win) {
    this.win = win;
    this.myrientService = new MyrientService();
    this.filterService = new FilterService();
    this.downloadConsole = new DownloadConsole(win);
    this.downloadManager = new DownloadManager(win, this.downloadConsole);
    this.fileSystemService = new FileSystemService();
  }

  /**
   * Sets up all IPC handlers for communication between the main and renderer processes.
   */
  setupIpcHandlers() {
    ipcMain.handle('get-myrient-base-url', () => {
      /**
       * Handles the 'get-myrient-base-url' IPC channel.
       * @returns {string} The base URL for Myrient.
       */
      return MYRIENT_BASE_URL;
    });

    ipcMain.handle('get-main-archives', async () => {
      /**
       * Handles the 'get-main-archives' IPC channel.
       * Fetches the main archives from Myrient.
       * @returns {Promise<{data: object[]}|{error: string}>} An object containing either the archives data or an error message.
       */
      try {
        const data = await this.myrientService.getMainArchives(MYRIENT_BASE_URL);
        return { data };
      } catch (e) {
        return { error: e.message };
      }
    });

    ipcMain.handle('get-directory-list', async (event, archiveUrl) => {
      /**
       * Handles the 'get-directory-list' IPC channel.
       * Fetches the directory list for a given archive URL.
       * @param {object} event The IPC event object.
       * @param {string} archiveUrl The URL of the archive.
       * @returns {Promise<object|{error: string}>} An object containing either the directory list data or an error message.
       */
      try {
        const data = await this.myrientService.getDirectoryList(archiveUrl);
        return data;
      } catch (e) {
        return { error: e.message };
      }
    });

    ipcMain.handle('scrape-and-parse-files', async (event, pageUrl) => {
      /**
       * Handles the 'scrape-and-parse-files' IPC channel.
       * Scrapes and parses files from a given page URL.
       * @param {object} event The IPC event object.
       * @param {string} pageUrl The URL of the page to scrape.
       * @returns {Promise<object|{error: string}>} An object containing either the scraped data or an error message.
       */
      try {
        const data = await this.myrientService.scrapeAndParseFiles(pageUrl);
        return data;
      } catch (e) {
        return { error: e.message };
      }
    });

    ipcMain.handle('filter-files', (event, allFiles, allTags, filters) => {
      /**
       * Handles the 'filter-files' IPC channel.
       * Applies filters to a list of files.
       * @param {object} event The IPC event object.
       * @param {Array<object>} allFiles An array of all files to filter.
       * @param {Array<string>} allTags An array of all available tags.
       * @param {object} filters The filters to apply.
       * @returns {{data: object[]}|{error: string}} An object containing either the filtered files data or an error message.
       */
      try {
        return { data: this.filterService.applyFilters(allFiles, allTags, filters) };
      } catch (e) {
        return { error: e.message };
      }
    });

    ipcMain.handle('get-download-directory', async () => {
      /**
       * Handles the 'get-download-directory' IPC channel.
       * Opens a dialog to select a download directory.
       * @returns {Promise<string|null>} The selected directory path or null if canceled.
       */
      const { canceled, filePaths } = await dialog.showOpenDialog(this.win, {
        title: 'Select Download Directory',
        properties: ['openDirectory', 'createDirectory']
      });
      if (canceled || filePaths.length === 0) return null;
      return filePaths[0];
    });

    ipcMain.handle('check-download-directory-structure', async (event, downloadPath) => {
      /**
       * Handles the 'check-download-directory-structure' IPC channel.
       * Checks the structure of the download directory.
       * @param {object} event The IPC event object.
       * @param {string} downloadPath The path to the download directory.
       * @returns {Promise<{data: string}|{error: string}>} An object containing either the directory structure or an error message.
       */
      try {
        const structure = await this.fileSystemService.checkDownloadDirectoryStructure(downloadPath);
        return { data: structure };
      } catch (e) {
        return { error: e.message };
      }
    });

    ipcMain.handle('get-download-directory-structure-enum', () => {
      /**
       * Handles the 'get-download-directory-structure-enum' IPC channel.
       * Returns the DownloadDirectoryStructure enum.
       * @returns {{data: object}} An object containing the DownloadDirectoryStructure enum.
       */
      return { data: DOWNLOAD_DIRECTORY_STRUCTURE };
    });

    ipcMain.on('cancel-download', () => {
      /**
       * Handles the 'cancel-download' IPC channel.
       * Cancels the ongoing download.
       */
      this.downloadManager.cancel();
    });

    ipcMain.handle('delete-file', async (event, filePath) => {
      /**
       * Handles the 'delete-file' IPC channel.
       * Deletes a file from the file system.
       * @param {object} event The IPC event object.
       * @param {string} filePath The path of the file to delete.
       * @returns {Promise<{success: boolean, error?: string}>} An object indicating success or failure and an optional error message.
       */
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
      /**
       * Handles the 'open-external' IPC channel.
       * Opens a URL in the user's default browser.
       * @param {object} event The IPC event object.
       * @param {string} url The URL to open.
       */
      shell.openExternal(url);
    });

    ipcMain.on('window-minimize', () => {
      /**
       * Handles the 'window-minimize' IPC channel.
       * Minimizes the main window.
       */
      this.win.minimize();
    });
    ipcMain.on('window-maximize-restore', () => {
      /**
       * Handles the 'window-maximize-restore' IPC channel.
       * Maximizes or restores the main window.
       */
      if (this.win.isMaximized()) {
        this.win.unmaximize();
      } else {
        this.win.maximize();
      }
    });
    ipcMain.on('window-close', () => {
      /**
       * Handles the 'window-close' IPC channel.
       * Closes the main window.
       */
      this.win.close();
    });

    ipcMain.on('zoom-in', () => {
      /**
       * Handles the 'zoom-in' IPC channel.
       * Increases the zoom factor of the web contents.
       */
      const currentZoom = this.win.webContents.getZoomFactor();
      this.win.webContents.setZoomFactor(currentZoom + 0.1);
    });

    ipcMain.on('zoom-out', () => {
      /**
       * Handles the 'zoom-out' IPC channel.
       * Decreases the zoom factor of the web contents.
       */
      const currentZoom = this.win.webContents.getZoomFactor();
      this.win.webContents.setZoomFactor(currentZoom - 0.1);
    });

    ipcMain.on('zoom-reset', () => {
      /**
       * Handles the 'zoom-reset' IPC channel.
       * Resets the zoom factor of the web contents to default (1).
       */
      this.win.webContents.setZoomFactor(1);
    });

    ipcMain.handle('get-zoom-factor', () => {
      /**
       * Handles the 'get-zoom-factor' IPC channel.
       * @returns {number} The current zoom factor of the web contents.
       */
      return this.win.webContents.getZoomFactor();
    });

    ipcMain.on('set-zoom-factor', (event, factor) => {
      /**
       * Handles the 'set-zoom-factor' IPC channel.
       * Sets the zoom factor of the web contents.
       * @param {object} event The IPC event object.
       * @param {number} factor The zoom factor to set.
       */
      this.win.webContents.setZoomFactor(factor);
    });

    ipcMain.handle('start-download', async (event, baseUrl, files, targetDir, createSubfolder, maintainFolderStructure, extractAndDelete, extractPreviouslyDownloaded, isThrottlingEnabled, throttleSpeed, throttleUnit) => {
      /**
       * Handles the 'start-download' IPC channel.
       * Initiates a download process.
       * @param {object} event The IPC event object.
       * @param {string} baseUrl The base URL for the files to download.
       * @param {Array<object>} files An array of file and/or directory objects to download.
       * @param {string} targetDir The target directory for the download.
       * @param {boolean} createSubfolder Whether to create subfolders for the download.
       * @param {boolean} maintainFolderStructure Whether to maintain the site's folder structure.
       * @param {boolean} extractAndDelete Whether to extract archives and delete them after download.
       * @param {boolean} extractPreviouslyDownloaded Whether to extract previously downloaded archives.
       * @param {boolean} isThrottlingEnabled Whether to enable download throttling.
       * @param {number} throttleSpeed The download speed limit.
       * @param {string} throttleUnit The unit for the download speed limit (KB/s or MB/s).
       * @returns {Promise<object|{error: string}>} A promise that resolves with download status or rejects with an error.
       */
      try {
        return await this.downloadManager.startDownload(baseUrl, files, targetDir, createSubfolder, maintainFolderStructure, extractAndDelete, extractPreviouslyDownloaded, isThrottlingEnabled, throttleSpeed, throttleUnit);
      } catch (e) {
        return { error: e && e.message ? e.message : String(e) };
      }
    });

    ipcMain.on('log-message', (event, level, message) => {
      /**
       * Handles the 'log-message' IPC channel.
       * Logs a message with a specified level.
       * @param {object} event The IPC event object.
       * @param {string} level The log level (e.g., 'info', 'warn', 'error').
       * @param {string} message The message to log.
       */
    });

    ipcMain.handle('read-file', async (event, filePath) => {
      /**
       * Handles the 'read-file' IPC channel.
       * Reads the content of a specified file.
       * @param {object} event The IPC event object.
       * @param {string} filePath The path to the file to read.
       * @returns {Promise<{data: string}|{error: string}>} An object containing either the file content or an error message.
       */
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
