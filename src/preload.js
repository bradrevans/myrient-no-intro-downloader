const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getMainArchives: () => ipcRenderer.invoke('get-main-archives'),
  getDirectoryList: (archiveUrl) => ipcRenderer.invoke('get-directory-list', archiveUrl),
  scrapeAndParseFiles: (pageUrl) => ipcRenderer.invoke('scrape-and-parse-files', pageUrl),
  filterFiles: (files, allTags, filters) => ipcRenderer.invoke('filter-files', files, allTags, filters),

  getDownloadDirectory: () => ipcRenderer.invoke('get-download-directory'),

  startDownload: (baseUrl, files, targetDir) => ipcRenderer.invoke('start-download', baseUrl, files, targetDir),
  cancelDownload: () => ipcRenderer.send('cancel-download'),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),

  openExternal: (url) => ipcRenderer.send('open-external', url),

  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximizeRestore: () => ipcRenderer.send('window-maximize-restore'),
  windowClose: () => ipcRenderer.send('window-close'),

  log: (level, message) => ipcRenderer.send('log-message', level, message),

  onDownloadScanProgress: (callback) => ipcRenderer.on('download-scan-progress', (event, data) => callback(data)),
  onDownloadOverallProgress: (callback) => ipcRenderer.on('download-overall-progress', (event, data) => callback(data)),
  onDownloadFileProgress: (callback) => ipcRenderer.on('download-file-progress', (event, data) => callback(data)),
  onDownloadLog: (callback) => ipcRenderer.on('download-log', (event, message) => callback(message)),
  onDownloadComplete: (callback) => ipcRenderer.on('download-complete', (event, summary) => callback(summary)),


  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
});
