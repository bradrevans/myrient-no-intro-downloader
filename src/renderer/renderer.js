import stateService from './StateService.js';
import apiService from './ApiService.js';
import { setupDownloadUiListeners, logDownload } from './ui/download-ui.js';
import UIManager from './ui/UIManager.js';

document.addEventListener('DOMContentLoaded', async () => {

  const uiManager = new UIManager(document.getElementById('view-container'), loadArchives);
  await uiManager.loadViews();

  async function loadArchives() {
    uiManager.showLoading('Loading Archives...');
    try {
      const archives = await apiService.loadArchives();
      uiManager.showView('archives');
      uiManager.populateList('list-archives', archives, (item) => {
        stateService.set('archive', item);
        loadDirectories();
      });
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      uiManager.hideLoading();
    }
  }

  async function loadDirectories() {
    uiManager.showLoading('Loading Directories...');
    try {
      const directories = await apiService.loadDirectories();
      uiManager.showView('directories');
      uiManager.populateList('list-directories', directories, (item) => {
        handleDirectorySelect(item);
      });

      const searchInput = document.getElementById('search-directories');
      if (searchInput.value) {
        searchInput.dispatchEvent(new Event('input'));
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      uiManager.hideLoading();
    }
  }

  async function handleDirectorySelect(item) {
    stateService.set('directory', item);
    stateService.resetWizardState();
    uiManager.showLoading('Scanning files...');
    try {
      await apiService.scrapeAndParseFiles();
      uiManager.showView('wizard');
      uiManager.setupWizard();
    } catch (e) {
      alert(`Error: ${e.message}`);
      uiManager.showView('directories');
    } finally {
      uiManager.hideLoading();
    }
  }

  document.getElementById('breadcrumbs').addEventListener('click', (e) => {
    if (stateService.get('isDownloading')) return;
    if (e.target.dataset.view) {
      const view = e.target.dataset.view;
      const step = parseInt(e.target.dataset.step, 10);
      if (step === 0) {
        stateService.set('archive', { name: '', href: '' });
        stateService.set('directory', { name: '', href: '' });
        stateService.resetWizardState();
        loadArchives();
      }
      if (step === 1) {
        stateService.set('directory', { name: '', href: '' });
        stateService.resetWizardState();
        loadDirectories();
      }
    }
  });

  document.getElementById('header-back-btn').addEventListener('click', () => {
    if (stateService.get('isDownloading')) return;
    if (stateService.get('currentView') === 'results') {
      uiManager.showView('wizard');
      uiManager.setupWizard();
    } else if (stateService.get('currentView') === 'wizard') {
      stateService.set('directory', { name: '', href: '' });
      stateService.resetWizardState();
      loadDirectories();
    } else if (stateService.get('currentView') === 'directories') {
      stateService.set('archive', { name: '', href: '' });
      stateService.set('directory', { name: '', href: '' });
      stateService.resetWizardState();
      loadArchives();
    }
  });

  document.getElementById('minimize-btn').addEventListener('click', () => {
    apiService.minimizeWindow();
  });
  document.getElementById('maximize-restore-btn').addEventListener('click', () => {
    apiService.maximizeRestoreWindow();
  });
  document.getElementById('close-btn').addEventListener('click', () => {
    apiService.closeWindow();
  });

  const settingsPanel = document.getElementById('settings-panel');
  const settingsOverlay = document.getElementById('settings-overlay');
  const closeSettingsBtn = document.getElementById('close-settings-btn');

  document.getElementById('settings-btn').addEventListener('click', () => {
    settingsPanel.classList.remove('translate-x-full');
    settingsOverlay.classList.remove('hidden');
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsPanel.classList.add('translate-x-full');
    settingsOverlay.classList.add('hidden');
  });

  settingsOverlay.addEventListener('click', () => {
    settingsPanel.classList.add('translate-x-full');
    settingsOverlay.classList.add('hidden');
  });

  async function updateZoomDisplay() {
    const zoomFactor = await apiService.getZoomFactor();
    const zoomPercentage = Math.round(zoomFactor * 100);
    document.getElementById('zoom-level-display').value = zoomPercentage;
  }





  document.getElementById('zoom-in-btn').addEventListener('click', async () => {
    let zoomFactor = await apiService.getZoomFactor();
    let newZoomPercentage = Math.round(zoomFactor * 100) + 10;
    newZoomPercentage = Math.max(10, Math.min(400, newZoomPercentage));
    apiService.setZoomFactor(newZoomPercentage / 100);
    setTimeout(updateZoomDisplay, 100);
  });

  document.getElementById('zoom-out-btn').addEventListener('click', async () => {
    let zoomFactor = await apiService.getZoomFactor();
    let newZoomPercentage = Math.round(zoomFactor * 100) - 10;
    newZoomPercentage = Math.max(10, Math.min(400, newZoomPercentage));
    apiService.setZoomFactor(newZoomPercentage / 100);
    setTimeout(updateZoomDisplay, 100);
  });

  document.getElementById('zoom-level-display').addEventListener('change', (e) => {
    let newZoomPercentage = parseInt(e.target.value, 10);
    if (isNaN(newZoomPercentage)) newZoomPercentage = 100; // Default to 100 if invalid
    newZoomPercentage = Math.max(10, Math.min(400, newZoomPercentage)); // Clamp between 10% and 400%
    const newZoomFactor = newZoomPercentage / 100;
    apiService.setZoomFactor(newZoomFactor);
    updateZoomDisplay();
  });

  document.getElementById('zoom-reset-btn').addEventListener('click', () => {
    apiService.zoomReset();
    setTimeout(updateZoomDisplay, 100);
  });

  document.getElementById('github-link').addEventListener('click', () => {
    apiService.openExternal('https://github.com/bradrevans/myrient-downloader');
  });

  document.getElementById('donate-link').addEventListener('click', () => {
    apiService.openExternal('https://myrient.erista.me/donate/');
  });

  loadArchives();
  uiManager.updateBreadcrumbs();
  setupDownloadUiListeners();
  updateZoomDisplay();
});

window.electronAPI.onDownloadComplete(async (summary) => {
  logDownload(summary.message);

  if (summary.wasCancelled && summary.partialFile) {
    const userWantsDelete = confirm(`Download cancelled. Do you want to delete the incomplete file?\n\nFile: ${summary.partialFile.name}`);
    if (userWantsDelete) {
      await apiService.deleteFile(summary.partialFile.path);
      logDownload(`Deleted partial file: ${summary.partialFile.name}`);
    }
  }

  stateService.set('isDownloading', false);
  document.getElementById('download-scan-btn').disabled = false;
  document.getElementById('download-dir-btn').disabled = false;
  document.getElementById('download-cancel-btn').classList.add('hidden');
  document.getElementById('download-cancel-btn').disabled = false;
  document.getElementById('overall-progress-time').textContent = "Estimated Time Remaining: --";
  document.getElementById('download-restart-btn').classList.remove('hidden');
});
