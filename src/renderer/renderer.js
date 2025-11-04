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
    uiManager.showLoading('Scanning files... (This may take a while)');
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

  document.getElementById('github-link').addEventListener('click', () => {
    apiService.openExternal('https://github.com/bradrevans/myrient-downloader');
  });

  document.getElementById('donate-link').addEventListener('click', () => {
    apiService.openExternal('https://myrient.erista.me/donate/');
  });

  loadArchives();
  uiManager.updateBreadcrumbs();
  setupDownloadUiListeners();
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
