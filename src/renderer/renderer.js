import stateService from './StateService.js';
import apiService from './ApiService.js';
import UIManager from './ui/UIManager.js';
import DownloadUI from './ui/DownloadUI.js';

let downloadUI;

document.addEventListener('DOMContentLoaded', async () => {
  await stateService.init();

  const uiManager = new UIManager(document.getElementById('view-container'), loadArchives);
  downloadUI = new DownloadUI(stateService, apiService, uiManager);
  uiManager.setDownloadUI(downloadUI);
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
      const { hasSubdirectories } = await apiService.scrapeAndParseFiles();

      if (hasSubdirectories) {
        const defaultFilters = {
          include_tags: [],
          exclude_tags: [],
          rev_mode: 'all',
          dedupe_mode: 'all',
          priority_list: [],
        };
        await apiService.runFilter(defaultFilters);
        uiManager.showView('results');
        downloadUI.populateResults(hasSubdirectories);
        stateService.set('wizardSkipped', true);
        return;
      }

      const allTags = stateService.get('allTags');
      const hasNoTags = Object.keys(allTags).length === 0 || Object.values(allTags).every(arr => arr.length === 0);

      if (hasNoTags) {
        const defaultFilters = {
          include_tags: [],
          exclude_tags: [],
          rev_mode: 'all',
          dedupe_mode: 'all',
          priority_list: [],
        };
        await apiService.runFilter(defaultFilters);
        uiManager.showView('results');
        downloadUI.populateResults(hasSubdirectories);
        stateService.set('wizardSkipped', true);
      } else {
        const userWantsToFilter = await uiManager.showConfirmationModal(
          'This directory contains filterable tags. Would you like to use the filtering wizard?',
          {
            title: 'Filter Results?',
            confirmText: 'Enter Wizard',
            cancelText: 'Show All'
          }
        );

        if (userWantsToFilter === true) {
          uiManager.showView('wizard');
          uiManager.setupWizard();
          stateService.set('wizardSkipped', false);
        } else if (userWantsToFilter === false) {
          const defaultFilters = {
            include_tags: [],
            exclude_tags: [],
            rev_mode: 'all',
            dedupe_mode: 'all',
            priority_list: [],
          };
          await apiService.runFilter(defaultFilters);
          uiManager.showView('results');
          downloadUI.populateResults(hasSubdirectories);
          stateService.set('wizardSkipped', true);
        }
      }
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
      if (stateService.get('wizardSkipped')) {
        stateService.set('directory', { name: '', href: '' });
        stateService.resetWizardState();
        loadDirectories();
      } else {
        uiManager.showView('wizard');
        uiManager.setupWizard();
      }
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

  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsOverlay = document.getElementById('settings-overlay');
  const closeSettingsBtn = document.getElementById('close-settings-btn');

  function openSettings() {
    settingsPanel.classList.remove('translate-x-full');
    settingsOverlay.classList.add('open');
    settingsBtn.classList.add('settings-open');
  }

  function closeSettings() {
    settingsPanel.classList.add('translate-x-full');
    settingsOverlay.classList.remove('open');
    settingsBtn.classList.remove('settings-open');
  }

  settingsBtn.addEventListener('click', () => {
    if (settingsPanel.classList.contains('translate-x-full')) {
      openSettings();
    } else {
      closeSettings();
    }
  });

  closeSettingsBtn.addEventListener('click', closeSettings);

  settingsOverlay.addEventListener('click', closeSettings);

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
    if (isNaN(newZoomPercentage)) newZoomPercentage = 100;
    newZoomPercentage = Math.max(10, Math.min(400, newZoomPercentage));
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

  document.getElementById('kofi-link').addEventListener('click', () => {
    apiService.openExternal('https://ko-fi.com/bradrevans');
  });

  document.getElementById('donate-link').addEventListener('click', () => {
    apiService.openExternal('https://myrient.erista.me/donate/');
  });

  document.getElementById('check-for-updates-btn').addEventListener('click', async () => {
    const updateStatusElement = document.getElementById('update-status');
    updateStatusElement.textContent = 'Checking for updates...';
    const result = await apiService.checkForUpdates();
    if (result.error) {
      updateStatusElement.textContent = result.error;
    } else if (result.isUpdateAvailable) {
      updateStatusElement.innerHTML = `Update available: <a href="#" id="release-link" class="text-accent-500 hover:underline">${result.latestVersion}</a>`;
      document.getElementById('release-link').addEventListener('click', (e) => {
        e.preventDefault();
        apiService.openExternal(result.releaseUrl);
      });
    } else {
      updateStatusElement.textContent = 'You are on the latest version.';
    }
  });

  async function setAppVersion() {
    const version = await apiService.getAppVersion();
    const versionElement = document.getElementById('app-version');
    if (versionElement) {
      versionElement.textContent = version;
    }
  }

  async function checkForUpdatesOnStartup() {
    const result = await apiService.checkForUpdates();
    if (result.isUpdateAvailable) {
      const updateStatusElement = document.getElementById('update-status');
      updateStatusElement.innerHTML = `Update available: <a href="#" id="release-link" class="text-accent-500 hover:underline">${result.latestVersion}</a>`;
      document.getElementById('release-link').addEventListener('click', (e) => {
        e.preventDefault();
        apiService.openExternal(result.releaseUrl);
      });

      const userChoseDownload = await uiManager.showConfirmationModal(
        `A new version (${result.latestVersion}) is available. Would you like to download it?`,
        {
          title: 'Update Available',
          confirmText: 'Download',
          cancelText: 'Ignore'
        }
      );
      if (userChoseDownload) {
        apiService.openExternal(result.releaseUrl);
      }
    }
  }

  loadArchives();
  uiManager.updateBreadcrumbs();
  updateZoomDisplay();
  setAppVersion();
  checkForUpdatesOnStartup();
});

window.electronAPI.onDownloadComplete(async (summary) => {
  if (summary.wasCancelled && summary.partialFile) {
    const userWantsDelete = confirm(`Download cancelled. Do you want to delete the incomplete file?\n\nFile: ${summary.partialFile.name}`);
    if (userWantsDelete) {
      await apiService.deleteFile(summary.partialFile.path);
      downloadUI.log(`Deleted partial file: ${summary.partialFile.name}`);
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
