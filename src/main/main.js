import electron from 'electron';
const { app, BrowserWindow } = electron;
import path from 'path';
import { fileURLToPath } from 'url';
import IpcManager from './IpcManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
