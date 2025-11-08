import { formatBytes, formatTime } from '../utils.js';

export default class DownloadUI {
  constructor(stateService, apiService, uiManager) {
    this.stateService = stateService;
    this.apiService = apiService;
    this.uiManager = uiManager;
    this.downloadDirectoryStructure = null;

    this._setupEventListeners();
  }

  _getElements() {
    return {
      resultsFileCount: document.getElementById('results-file-count'),
      resultsTotalCount: document.getElementById('results-total-count'),
      resultsList: document.getElementById('results-list'),
      downloadDirText: document.getElementById('download-dir-text'),
      downloadScanBtn: document.getElementById('download-scan-btn'),
      scanProgressBar: document.getElementById('scan-progress-bar'),
      downloadProgressBars: document.getElementById('download-progress-bars'),
      downloadCancelBtn: document.getElementById('download-cancel-btn'),
      downloadRestartBtn: document.getElementById('download-restart-btn'),
      downloadLog: document.getElementById('download-log'),
      scanProgress: document.getElementById('scan-progress'),
      scanProgressText: document.getElementById('scan-progress-text'),
      overallProgress: document.getElementById('overall-progress'),
      overallProgressText: document.getElementById('overall-progress-text'),
      overallProgressTime: document.getElementById('overall-progress-time'),
      fileProgress: document.getElementById('file-progress'),
      fileProgressName: document.getElementById('file-progress-name'),
      fileProgressSize: document.getElementById('file-progress-size'),
      downloadDirBtn: document.getElementById('download-dir-btn'),
      extractionProgressBar: document.getElementById('extraction-progress-bar'),
      extractionProgress: document.getElementById('extraction-progress'),
      extractionProgressName: document.getElementById('extraction-progress-name'),
      extractionProgressText: document.getElementById('extraction-progress-text'),
    };
  }

  async populateResults() {
    const elements = this._getElements();
    if (!elements.resultsFileCount) return; // Guard against wrong view

    elements.resultsFileCount.textContent = this.stateService.get('finalFileList').length;
    elements.resultsTotalCount.textContent = this.stateService.get('allFiles').length;

    elements.resultsList.innerHTML = '';

    this.stateService.get('finalFileList').forEach(file => {
      const el = document.createElement('div');
      el.className = 'p-1 text-sm truncate';
      el.textContent = file.name_raw;
      elements.resultsList.appendChild(el);
    });

    elements.downloadDirText.textContent = 'No directory selected.';
    elements.downloadScanBtn.disabled = true;
    this.stateService.set('downloadDirectory', null);
    elements.scanProgressBar.classList.add('hidden');
    elements.downloadProgressBars.classList.add('hidden');
    elements.downloadCancelBtn.classList.add('hidden');
    elements.downloadRestartBtn.classList.add('hidden');
    elements.downloadLog.innerHTML = '';

    if (!this.downloadDirectoryStructure) {
      this.downloadDirectoryStructure = await this.apiService.getDownloadDirectoryStructureEnum();
    }
  }

  async startDownload() {
    const elements = this._getElements();
    if (!elements.downloadDirBtn) return;

    if (!this.stateService.get('downloadDirectory')) {
      alert("Please select a download directory first.");
      return;
    }

    const downloadPath = this.stateService.get('downloadDirectory');
    const createSubfolder = this.stateService.get('createSubfolder');
    const currentStructure = await this.apiService.checkDownloadDirectoryStructure(downloadPath);

    let shouldProceed = true;
    let confirmationMessage = '';

    if (currentStructure === this.downloadDirectoryStructure.FLAT && createSubfolder) {
      confirmationMessage = `The target directory "${downloadPath}" contains flat files, but you have selected to create subfolders. Do you want to continue?`;
      shouldProceed = false;
    } else if (currentStructure === this.downloadDirectoryStructure.SUBFOLDERS && !createSubfolder) {
      confirmationMessage = `The target directory "${downloadPath}" contains subfolders, but you have selected to download files directly. Do you want to continue?`;
      shouldProceed = false;
    } else if (currentStructure === this.downloadDirectoryStructure.MIXED) {
      confirmationMessage = `The target directory "${downloadPath}" contains both flat files and subfolders. This might lead to an inconsistent structure. Do you want to continue?`;
      shouldProceed = false;
    }

    if (!shouldProceed) {
      const userConfirmed = await this.uiManager.showConfirmationModal(confirmationMessage);
      if (!userConfirmed) {
        this.log('Download cancelled by user.');
        return;
      }
    }

    this.stateService.set('isDownloading', true);
    this.stateService.set('downloadStartTime', Date.now());
    this.stateService.set('totalBytesDownloadedThisSession', 0);

    elements.downloadLog.innerHTML = '';
    this.log('Starting download...');
    elements.downloadScanBtn.disabled = true;
    elements.downloadDirBtn.disabled = true;
    elements.downloadCancelBtn.classList.remove('hidden');
    elements.downloadRestartBtn.classList.add('hidden');

    elements.scanProgress.value = 0;
    elements.overallProgress.value = 0;
    elements.fileProgress.value = 0;
    elements.fileProgressName.textContent = "";
    elements.fileProgressSize.textContent = "";
    elements.overallProgressTime.textContent = "Estimated Time Remaining: --";
    elements.overallProgressText.textContent = "0.00 MB / 0.00 MB";

    elements.scanProgressBar.classList.remove('hidden');
    elements.downloadProgressBars.classList.remove('hidden');
    elements.fileProgress.classList.remove('hidden');
    elements.fileProgressSize.classList.remove('hidden');

    this.apiService.startDownload();
  }

  log(message) {
    const elements = this._getElements();
    if (!elements.downloadLog) return;
    const logEl = elements.downloadLog;
    logEl.innerHTML += `<div>${message}</div>`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  _setupEventListeners() {
    window.electronAPI.onDownloadScanProgress(data => {
      const elements = this._getElements();
      if (!elements.scanProgress) return;
      elements.scanProgress.value = data.current;
      elements.scanProgress.max = data.total;
      const percent = data.total > 0 ? ((data.current / data.total) * 100).toFixed(0) : 0;
      elements.scanProgressText.textContent = `${percent}% (${data.current} / ${data.total} files)`;
    });

    window.electronAPI.onDownloadOverallProgress(data => {
      const elements = this._getElements();
      if (!elements.overallProgress) return;
      elements.overallProgress.value = data.current;
      elements.overallProgress.max = data.total;
      const percent = data.total > 0 ? ((data.current / data.total) * 100).toFixed(1) : 0;
      elements.overallProgressText.textContent =
        `${formatBytes(data.current)} / ${formatBytes(data.total)} (${percent}%)`;

      this.stateService.set('totalBytesDownloadedThisSession', data.current - data.skippedSize);

      const timeElapsed = (Date.now() - this.stateService.get('downloadStartTime')) / 1000;

      if (timeElapsed > 1 && this.stateService.get('totalBytesDownloadedThisSession') > 0) {
        const avgSpeed = this.stateService.get('totalBytesDownloadedThisSession') / timeElapsed;
        const sizeRemaining = data.total - data.current;

        if (avgSpeed > 0 && sizeRemaining > 0) {
          const secondsRemaining = sizeRemaining / avgSpeed;
          elements.overallProgressTime.textContent = `Time: ${formatTime(secondsRemaining)}`;
        } else {
          elements.overallProgressTime.textContent = "Estimated Time Remaining: --";
        }
      }
    });

    window.electronAPI.onDownloadFileProgress(data => {
      const elements = this._getElements();
      if (!elements.fileProgress) return;
      if (elements.fileProgressName.textContent !== data.name) {
        elements.fileProgress.value = 0;
        elements.fileProgressName.textContent = data.name;
      }

      elements.fileProgress.value = data.current;
      elements.fileProgress.max = data.total;
      const percent = data.total > 0 ? ((data.current / data.total) * 100).toFixed(0) : 0;
      elements.fileProgressSize.textContent =
        `${formatBytes(data.current)} / ${formatBytes(data.total)} (${percent}%)`;
    });

    window.electronAPI.onDownloadLog(message => {
      this.log(message);
    });

    window.electronAPI.onExtractionProgress(data => {
      const elements = this._getElements();
      if (!elements.extractionProgress) return;

      const extractionProgressBar = document.getElementById('extraction-progress-bar');
      if (data.total > 0) {
        extractionProgressBar.classList.remove('hidden');
      } else {
        extractionProgressBar.classList.add('hidden');
      }

      elements.extractionProgress.value = data.current;
      elements.extractionProgress.max = data.total;
      elements.extractionProgressName.textContent = data.filename;
      const percent = data.total > 0 ? ((data.current / data.total) * 100).toFixed(0) : 0;
      elements.extractionProgressText.textContent = `${percent}% (${data.current} / ${data.total} files)`;
    });
  }
}
