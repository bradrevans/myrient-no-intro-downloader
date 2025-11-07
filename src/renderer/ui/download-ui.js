import stateService from '../StateService.js';
import { formatBytes, formatTime } from '../utils.js';
import apiService from '../ApiService.js';

let DownloadDirectoryStructure;
let uiManagerInstance;

export async function populateResults() {
  document.getElementById('results-file-count').textContent = stateService.get('finalFileList').length;
  document.getElementById('results-total-count').textContent = stateService.get('allFiles').length;

  const listEl = document.getElementById('results-list');
  listEl.innerHTML = '';

  stateService.get('finalFileList').forEach(file => {
    const el = document.createElement('div');
    el.className = 'p-1 text-sm truncate';
    el.textContent = file.name_raw;
    listEl.appendChild(el);
  });

  document.getElementById('download-dir-text').textContent = 'No directory selected.';
  document.getElementById('download-scan-btn').disabled = true;
  stateService.set('downloadDirectory', null);
  document.getElementById('scan-progress-bar').classList.add('hidden');
  document.getElementById('download-progress-bars').classList.add('hidden');
  document.getElementById('download-cancel-btn').classList.add('hidden');
  document.getElementById('download-restart-btn').classList.add('hidden');
  document.getElementById('download-log').innerHTML = '';

  if (!DownloadDirectoryStructure) {
    DownloadDirectoryStructure = await apiService.getDownloadDirectoryStructureEnum();
  }
}

export async function startDownload() {
  if (!stateService.get('downloadDirectory')) {
    alert("Please select a download directory first.");
    return;
  }

  const downloadPath = stateService.get('downloadDirectory');
  const createSubfolder = stateService.get('createSubfolder');
  const unzipFiles = stateService.get('unzipFiles');
  const currentStructure = await apiService.checkDownloadDirectoryStructure(downloadPath);

  let shouldProceed = true;
  let confirmationMessage = '';

  if (currentStructure === DownloadDirectoryStructure.FLAT && createSubfolder) {
    confirmationMessage = `The target directory "${downloadPath}" contains flat files, but you have selected to create subfolders. Do you want to continue?`;
    shouldProceed = false;
  } else if (currentStructure === DownloadDirectoryStructure.SUBFOLDERS && !createSubfolder) {
    confirmationMessage = `The target directory "${downloadPath}" contains subfolders, but you have selected to download files directly. Do you want to continue?`;
    shouldProceed = false;
  } else if (currentStructure === DownloadDirectoryStructure.MIXED) {
    confirmationMessage = `The target directory "${downloadPath}" contains both flat files and subfolders. This might lead to an inconsistent structure. Do you want to continue?`;
    shouldProceed = false;
  }

  if (!shouldProceed) {
    const userConfirmed = await uiManagerInstance.showConfirmationModal(confirmationMessage);
    if (!userConfirmed) {
      logDownload('Download cancelled by user.');
      return;
    }
  }

  stateService.set('isDownloading', true);
  stateService.set('downloadStartTime', Date.now());
  stateService.set('totalBytesDownloadedThisSession', 0);

  document.getElementById('download-log').innerHTML = '';
  logDownload('Starting download...');
  document.getElementById('download-scan-btn').disabled = true;
  document.getElementById('download-dir-btn').disabled = true;
  document.getElementById('download-cancel-btn').classList.remove('hidden');
  document.getElementById('download-restart-btn').classList.add('hidden');

  document.getElementById('scan-progress').value = 0;
  document.getElementById('overall-progress').value = 0;
  document.getElementById('file-progress').value = 0;
  document.getElementById('file-progress-name').textContent = "";
  document.getElementById('file-progress-size').textContent = "";
  document.getElementById('overall-progress-time').textContent = "Estimated Time Remaining: --";
  document.getElementById('overall-progress-text').textContent = "0.00 MB / 0.00 MB";

  document.getElementById('scan-progress-bar').classList.remove('hidden');
  document.getElementById('download-progress-bars').classList.remove('hidden');
  document.getElementById('file-progress').classList.remove('hidden');
  document.getElementById('file-progress-size').classList.remove('hidden');

  apiService.startDownload();
}

export function logDownload(message) {
  const logEl = document.getElementById('download-log');
  logEl.innerHTML += `<div>${message}</div>`;
  logEl.scrollTop = logEl.scrollHeight;
}

export function setupDownloadUiListeners(uiManager) {
  uiManagerInstance = uiManager;

  window.electronAPI.onDownloadScanProgress(data => {
    document.getElementById('scan-progress').value = data.current;
    document.getElementById('scan-progress').max = data.total;
    const percent = data.total > 0 ? ((data.current / data.total) * 100).toFixed(0) : 0;
    document.getElementById('scan-progress-text').textContent = `${percent}% (${data.current} / ${data.total} files)`;
  });

  window.electronAPI.onDownloadOverallProgress(data => {
    document.getElementById('overall-progress').value = data.current;
    document.getElementById('overall-progress').max = data.total;
    const percent = data.total > 0 ? ((data.current / data.total) * 100).toFixed(1) : 0;
    document.getElementById('overall-progress-text').textContent =
      `${formatBytes(data.current)} / ${formatBytes(data.total)} (${percent}%)`;

    stateService.set('totalBytesDownloadedThisSession', data.current - data.skippedSize);

    const timeElapsed = (Date.now() - stateService.get('downloadStartTime')) / 1000;

    if (timeElapsed > 1 && stateService.get('totalBytesDownloadedThisSession') > 0) {
      const avgSpeed = stateService.get('totalBytesDownloadedThisSession') / timeElapsed;
      const sizeRemaining = data.total - data.current;

      if (avgSpeed > 0 && sizeRemaining > 0) {
        const secondsRemaining = sizeRemaining / avgSpeed;
        document.getElementById('overall-progress-time').textContent = `Time: ${formatTime(secondsRemaining)}`;
      } else {
        document.getElementById('overall-progress-time').textContent = "Estimated Time Remaining: --";
      }
    }
  });

  window.electronAPI.onDownloadFileProgress(data => {
    if (document.getElementById('file-progress-name').textContent !== data.name) {
      document.getElementById('file-progress').value = 0;
      document.getElementById('file-progress-name').textContent = data.name;
    }

    document.getElementById('file-progress').value = data.current;
    document.getElementById('file-progress').max = data.total;
    const percent = data.total > 0 ? ((data.current / data.total) * 100).toFixed(0) : 0;
    document.getElementById('file-progress-size').textContent =
      `${formatBytes(data.current)} / ${formatBytes(data.total)} (${percent}%)`;
  });

  window.electronAPI.onDownloadLog(message => {
    logDownload(message);
  });
}