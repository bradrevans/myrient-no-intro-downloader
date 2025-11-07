export const IPC_CHANNELS = {
  GET_MAIN_ARCHIVES: 'get-main-archives',
  GET_DIRECTORY_LIST: 'get-directory-list',
  SCRAPE_AND_PARSE_FILES: 'scrape-and-parse-files',
  FILTER_FILES: 'filter-files',
  GET_DOWNLOAD_DIRECTORY: 'get-download-directory',
  CANCEL_DOWNLOAD: 'cancel-download',
  DELETE_FILE: 'delete-file',
  OPEN_EXTERNAL: 'open-external',
  WINDOW_MINIMIZE: 'window-minimize',
  WINDOW_MAXIMIZE_RESTORE: 'window-maximize-restore',
  WINDOW_CLOSE: 'window-close',
  ZOOM_IN: 'zoom-in',
  ZOOM_OUT: 'zoom-out',
  ZOOM_RESET: 'zoom-reset',
  GET_ZOOM_FACTOR: 'get-zoom-factor',
  SET_ZOOM_FACTOR: 'set-zoom-factor',
  START_DOWNLOAD: 'start-download',
  LOG_MESSAGE: 'log-message',
  READ_FILE: 'read-file',
};

export const EVENTS = {
  DOWNLOAD_LOG: 'download-log',
  DOWNLOAD_OVERALL_PROGRESS: 'download-overall-progress',
  DOWNLOAD_COMPLETE: 'download-complete',
  DOWNLOAD_SCAN_PROGRESS: 'download-scan-progress',
  DOWNLOAD_FILE_PROGRESS: 'download-file-progress',
};

export const KEYS = {
  ENTER: 'Enter',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
};
