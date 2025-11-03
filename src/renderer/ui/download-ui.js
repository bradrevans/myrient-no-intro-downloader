import { state, downloadUi } from '../state.js';
import { log, formatBytes, formatTime } from '../utils.js';
import * as api from '../api.js';

export function populateResults() {
  document.getElementById('results-file-count').textContent = state.finalFileList.length;
  document.getElementById('results-total-count').textContent = state.allFiles.length;

  const listEl = document.getElementById('results-list');
  listEl.innerHTML = '';

  state.finalFileList.forEach(file => {
    const el = document.createElement('div');
    el.className = 'p-1 text-sm truncate';
    el.textContent = file.name_raw;
    listEl.appendChild(el);
  });

  downloadUi.dirText.textContent = 'No directory selected.';
  downloadUi.scanBtn.disabled = true;
  state.downloadDirectory = null;
  downloadUi.scanProgressBar.classList.add('hidden');
  downloadUi.sizeProgressBars.classList.add('hidden');
  downloadUi.cancelBtn.classList.add('hidden');
  downloadUi.restartBtn.classList.add('hidden');
  downloadUi.log.innerHTML = '';
}

export function startDownload() {
  if (!state.downloadDirectory) {
    alert("Please select a download directory first.");
    return;
  }

  log('info', `Starting download (mode: scan)...`);
  state.isDownloading = true;
  state.downloadStartTime = Date.now();
  state.totalBytesDownloadedThisSession = 0;

  downloadUi.log.innerHTML = '';
  logDownload('Starting download...');
  downloadUi.scanBtn.disabled = true;
  downloadUi.dirBtn.disabled = true;
  downloadUi.cancelBtn.classList.remove('hidden');
  downloadUi.restartBtn.classList.add('hidden');

  downloadUi.scanProgress.value = 0;
  downloadUi.overallProgress.value = 0;
  downloadUi.fileProgress.value = 0;
  downloadUi.fileProgressName.textContent = "";
  downloadUi.fileProgressSize.textContent = "";
  downloadUi.overallProgressTime.textContent = "Estimated Time Remaining: --";
  downloadUi.overallProgressText.textContent = "0.00 MB / 0.00 MB";

  downloadUi.scanProgressBar.classList.remove('hidden');
  downloadUi.sizeProgressBars.classList.remove('hidden');
  downloadUi.fileProgress.classList.remove('hidden');
  downloadUi.fileProgressSize.classList.remove('hidden');

  api.startDownload();
}

export function logDownload(message) {
  const logEl = document.getElementById('download-log');
  logEl.innerHTML += `<div>${message}</div>`;
  logEl.scrollTop = logEl.scrollHeight;
}

export function setupDownloadUiListeners() {
  window.electronAPI.onDownloadScanProgress(data => {
    downloadUi.scanProgress.value = data.current;
    downloadUi.scanProgress.max = data.total;
    const percent = data.total > 0 ? ((data.current / data.total) * 100).toFixed(0) : 0;
    downloadUi.scanProgressText.textContent = `${percent}% (${data.current} / ${data.total} files)`;
  });

  window.electronAPI.onDownloadOverallProgress(data => {
    downloadUi.overallProgress.value = data.current;
    downloadUi.overallProgress.max = data.total;
    const percent = data.total > 0 ? ((data.current / data.total) * 100).toFixed(1) : 0;
    downloadUi.overallProgressText.textContent =
      `${formatBytes(data.current)} / ${formatBytes(data.total)} (${percent}%)`;

    state.totalBytesDownloadedThisSession = data.current - data.skippedSize;

    const timeElapsed = (Date.now() - state.downloadStartTime) / 1000;

    if (timeElapsed > 1 && state.totalBytesDownloadedThisSession > 0) {
      const avgSpeed = state.totalBytesDownloadedThisSession / timeElapsed;
      const sizeRemaining = data.total - data.current;

      if (avgSpeed > 0 && sizeRemaining > 0) {
        const secondsRemaining = sizeRemaining / avgSpeed;
        downloadUi.overallProgressTime.textContent = `Time: ${formatTime(secondsRemaining)}`;
      } else {
        downloadUi.overallProgressTime.textContent = "Estimated Time Remaining: --";
      }
    }
  });

  window.electronAPI.onDownloadFileProgress(data => {
    if (downloadUi.fileProgressName.textContent !== data.name) {
      downloadUi.fileProgress.value = 0;
      downloadUi.fileProgressName.textContent = data.name;
    }

    downloadUi.fileProgress.value = data.current;
    downloadUi.fileProgress.max = data.total;
    const percent = data.total > 0 ? ((data.current / data.total) * 100).toFixed(0) : 0;
    downloadUi.fileProgressSize.textContent =
      `${formatBytes(data.current)} / ${formatBytes(data.total)} (${percent}%)`;
  });

  window.electronAPI.onDownloadLog(message => {
    logDownload(message);
  });
}
