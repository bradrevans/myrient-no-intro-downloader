import electron from 'electron';
const { app, BrowserWindow, ipcMain } = electron;
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import axios from 'axios';
import IpcManager from './IpcManager.js';
import { formatBytes, compareVersions } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const appVersion = packageJson.version;

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 640,
    minHeight: 360,
    autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('src/renderer/index.html');
  return win;
}

app.whenReady().then(() => {
  const win = createWindow();
  const ipcManager = new IpcManager(win);
  ipcManager.setupIpcHandlers();

  ipcMain.handle('get-app-version', () => {
    return appVersion;
  });

  ipcMain.handle('check-for-updates', async () => {
    try {
      const response = await axios.get('https://api.github.com/repos/bradrevans/myrient-downloader/releases/latest');
      const latestVersion = response.data.tag_name.replace('v', '');
      const isUpdateAvailable = compareVersions(latestVersion, appVersion) > 0;
      return {
        isUpdateAvailable,
        latestVersion,
        releaseNotes: response.data.body,
        releaseUrl: response.data.html_url,
      };
    } catch (error) {
      return { error: 'Could not check for updates.' };
    }
  });

  ipcMain.handle('format-bytes', (event, bytes, decimals) => {
    return formatBytes(bytes, decimals);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
