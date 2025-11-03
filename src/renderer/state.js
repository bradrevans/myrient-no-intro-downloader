export const state = {
  currentView: 'archives',
  baseUrl: 'https://myrient.erista.me/files/',
  archive: { name: '', href: '' },
  directory: { name: '', href: '' },
  allFiles: [],
  allTags: [],
  finalFileList: [],
  downloadDirectory: null,
  prioritySortable: null,
  availableSortable: null,
  isDownloading: false,
  downloadStartTime: 0,
  totalBytesDownloadedThisSession: 0,
};

export let views = {};
export let breadcrumbs;
export let loadingSpinner;
export let loadingText;
export let headerBackButton;
export let downloadUi = {};

export function initElements() {
  views = {
    archives: document.getElementById('view-archives'),
    directories: document.getElementById('view-directories'),
    wizard: document.getElementById('view-wizard'),
    results: document.getElementById('view-results'),
  };
  breadcrumbs = document.getElementById('breadcrumbs');
  loadingSpinner = document.getElementById('loading-spinner');
  loadingText = document.getElementById('loading-text');
  headerBackButton = document.getElementById('header-back-btn');

  Object.assign(downloadUi, {
    dirBtn: document.getElementById('download-dir-btn'),
    dirText: document.getElementById('download-dir-text'),
    scanBtn: document.getElementById('download-scan-btn'),
    cancelBtn: document.getElementById('download-cancel-btn'),
    scanProgressBar: document.getElementById('scan-progress-bar'),
    sizeProgressBars: document.getElementById('download-progress-bars'),
    log: document.getElementById('download-log'),
    scanProgress: document.getElementById('scan-progress'),
    scanProgressText: document.getElementById('scan-progress-text'),
    overallProgress: document.getElementById('overall-progress'),
    overallProgressText: document.getElementById('overall-progress-text'),
    overallProgressTime: document.getElementById('overall-progress-time'),
    fileProgress: document.getElementById('file-progress'),
    fileProgressName: document.getElementById('file-progress-name'),
    fileProgressSize: document.getElementById('file-progress-size'),
    restartBtn: document.getElementById('download-restart-btn'),
  });
}