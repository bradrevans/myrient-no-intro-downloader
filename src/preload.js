const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getMyrientBaseUrl: () => ipcRenderer.invoke('get-myrient-base-url'),
  getMainArchives: () => ipcRenderer.invoke('get-main-archives'),
  getDirectoryList: (archiveUrl) => ipcRenderer.invoke('get-directory-list', archiveUrl),
  scrapeAndParseFiles: (pageUrl) => ipcRenderer.invoke('scrape-and-parse-files', pageUrl),
  filterFiles: (files, allTags, filters) => ipcRenderer.invoke('filter-files', files, allTags, filters),

  getDownloadDirectory: () => ipcRenderer.invoke('get-download-directory'),
  checkDownloadDirectoryStructure: (downloadPath) => ipcRenderer.invoke('check-download-directory-structure', downloadPath),
  getDownloadDirectoryStructureEnum: () => ipcRenderer.invoke('get-download-directory-structure-enum'),

  startDownload: (baseUrl, files, targetDir, createSubfolder, extractAndDelete, extractPreviouslyDownloaded) => ipcRenderer.invoke('start-download', baseUrl, files, targetDir, createSubfolder, extractAndDelete, extractPreviouslyDownloaded),
  cancelDownload: () => ipcRenderer.send('cancel-download'),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),

  openExternal: (url) => ipcRenderer.send('open-external', url),

  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximizeRestore: () => ipcRenderer.send('window-maximize-restore'),
  windowClose: () => ipcRenderer.send('window-close'),

  zoomIn: () => ipcRenderer.send('zoom-in'),
  zoomOut: () => ipcRenderer.send('zoom-out'),
  zoomReset: () => ipcRenderer.send('zoom-reset'),

  getZoomFactor: () => ipcRenderer.invoke('get-zoom-factor'),
  setZoomFactor: (factor) => ipcRenderer.send('set-zoom-factor', factor),

  log: (level, message) => ipcRenderer.send('log-message', level, message),

  onDownloadScanProgress: (callback) => ipcRenderer.on('download-scan-progress', (event, data) => callback(data)),
  onDownloadOverallProgress: (callback) => ipcRenderer.on('download-overall-progress', (event, data) => callback(data)),
  onDownloadFileProgress: (callback) => ipcRenderer.on('download-file-progress', (event, data) => callback(data)),
  onDownloadLog: (callback) => ipcRenderer.on('download-log', (event, message) => callback(message)),
  onDownloadComplete: (callback) => ipcRenderer.on('download-complete', (event, summary) => callback(summary)),
  onExtractionStarted: (callback) => ipcRenderer.on('extraction-started', () => callback()),
  onExtractionEnded: (callback) => ipcRenderer.on('extraction-ended', () => callback()),
  onExtractionProgress: (callback) => ipcRenderer.on('extraction-progress', (event, data) => callback(data)),
  onHideDownloadUi: (callback) => ipcRenderer.on('hide-download-ui', (event) => callback()),

  formatBytes: (bytes, decimals) => ipcRenderer.invoke('format-bytes', bytes, decimals),

  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
});
