import { state, views, breadcrumbs, loadingSpinner, loadingText, headerBackButton, downloadUi, initElements } from './state.js';
import { log } from './utils.js';
import * as api from './api.js';
import { updateBreadcrumbs } from './ui/breadcrumbs.js';
import { setupSearch, clearSearchAndTrigger, setupSearchClearButton } from './ui/search.js';
import { showView, showLoading, hideLoading, populateList, setupWizard } from './ui/views.js';
import { populateResults, startDownload, logDownload, setupDownloadUiListeners } from './ui/download-ui.js';

async function loadArchives() {
  showLoading('Loading Archives...');
  try {
    const archives = await api.loadArchives();
    populateList('list-archives', archives, (item) => {
      state.archive = item;
      loadDirectories();
    });
  } catch (e) {
    alert(`Error: ${e.message}`);
  } finally {
    hideLoading();
  }
}

async function loadDirectories() {
  showLoading('Loading Directories...');
  try {
    const directories = await api.loadDirectories();
    populateList('list-directories', directories, (item) => {
      handleDirectorySelect(item);
    });
    showView('directories');

    const searchInput = document.getElementById('search-directories');
    if (searchInput.value) {
      searchInput.dispatchEvent(new Event('input'));
    }
  } catch (e) {
    alert(`Error: ${e.message}`);
  } finally {
    hideLoading();
  }
}

async function handleDirectorySelect(item) {
  state.directory = item;
  showLoading('Scanning files... (This may take a while)');
  try {
    await api.scrapeAndParseFiles();
    setupWizard();
    showView('wizard');
  } catch (e) {
    alert(`Error: ${e.message}`);
    showView('directories');
  } finally {
    hideLoading();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initElements();

  breadcrumbs.addEventListener('click', (e) => {
    if (state.isDownloading) return;
    if (e.target.dataset.view) {
      const view = e.target.dataset.view;
      const step = parseInt(e.target.dataset.step, 10);
      if (step === 0) {
        state.archive = { name: '', href: '' };
        state.directory = { name: '', href: '' };
        showView(view);
        const searchInput = document.getElementById('search-archives');
        if (searchInput.value) searchInput.dispatchEvent(new Event('input'));
        clearSearchAndTrigger('search-directories');
        clearSearchAndTrigger('search-tags');
        clearSearchAndTrigger('search-priority-tags');
        clearSearchAndTrigger('search-results');
      }
      if (step === 1) {
        state.directory = { name: '', href: '' };
        loadDirectories();
        clearSearchAndTrigger('search-tags');
        clearSearchAndTrigger('search-priority-tags');
        clearSearchAndTrigger('search-results');
      }
    }
  });

  headerBackButton.addEventListener('click', () => {
    if (state.isDownloading) return;
    if (state.currentView === 'results') {
      showView('wizard');
      downloadUi.restartBtn.classList.add('hidden');
      const searchTags = document.getElementById('search-tags');
      if (searchTags.value) searchTags.dispatchEvent(new Event('input'));
      const searchPriority = document.getElementById('search-priority-tags');
      if (searchPriority.value) searchPriority.dispatchEvent(new Event('input'));
      clearSearchAndTrigger('search-results');
    } else if (state.currentView === 'wizard') {
      setupWizard();
      state.directory = { name: '', href: '' };
      showView('directories');
      const searchInput = document.getElementById('search-directories');
      if (searchInput.value) searchInput.dispatchEvent(new Event('input'));
      clearSearchAndTrigger('search-tags');
      clearSearchAndTrigger('search-priority-tags');
      clearSearchAndTrigger('search-results');
    } else if (state.currentView === 'directories') {
      state.archive = { name: '', href: '' };
      showView('archives');
      const searchInput = document.getElementById('search-archives');
      if (searchInput.value) searchInput.dispatchEvent(new Event('input'));
      clearSearchAndTrigger('search-directories');
      clearSearchAndTrigger('search-tags');
      clearSearchAndTrigger('search-priority-tags');
      clearSearchAndTrigger('search-results');
    }
  });

  document.getElementById('minimize-btn').addEventListener('click', () => {
    api.minimizeWindow();
  });
  document.getElementById('maximize-restore-btn').addEventListener('click', () => {
    api.maximizeRestoreWindow();
  });
  document.getElementById('close-btn').addEventListener('click', () => {
    api.closeWindow();
  });

  document.getElementById('wizard-run-btn').addEventListener('click', async () => {
    showLoading('Filtering files...');

    const langMode = document.getElementById('filter-lang-mode').value;
    const selectedTags = [];
    document.querySelectorAll('#wizard-tags-list input[type=checkbox]:checked').forEach(cb => {
      selectedTags.push(cb.parentElement.dataset.name);
    });

    const priorityList = Array.from(document.querySelectorAll('#priority-list .list-group-item')).map(el => el.textContent);

    const filters = {
      lang_mode: langMode,
      lang_tags: selectedTags,
      rev_mode: document.getElementById('filter-revision-mode').value,
      dedupe_mode: document.getElementById('filter-dedupe-mode').value,
      priority_list: priorityList,
      keep_fallbacks: document.getElementById('filter-keep-fallbacks').checked,
    };

    try {
      await api.runFilter(filters);
      populateResults();
      showView('results');
    } catch (e) {
      alert(`Error during filtering: ${e.message}`);
    } finally {
      hideLoading();
    }
  });

  downloadUi.dirBtn.addEventListener('click', async () => {
    const dir = await api.getDownloadDirectory();
    if (dir) {
      downloadUi.dirText.textContent = dir;
      downloadUi.scanBtn.disabled = false;
    }
  });

  downloadUi.scanBtn.addEventListener('click', () => startDownload());

  downloadUi.cancelBtn.addEventListener('click', () => {
    log('info', 'Cancel button clicked.');
    logDownload('Cancelling download, please wait...');
    downloadUi.cancelBtn.disabled = true;
    api.cancelDownload();
  });

  downloadUi.restartBtn.addEventListener('click', () => {
    state.archive = { name: '', href: '' };
    state.directory = { name: '', href: '' };

    showView('archives');

    clearSearchAndTrigger('search-archives');
    clearSearchAndTrigger('search-directories');
    clearSearchAndTrigger('search-tags');
    clearSearchAndTrigger('search-priority-tags');
    clearSearchAndTrigger('search-results');
  });

  document.getElementById('github-link').addEventListener('click', () => {
    api.openExternal('https://github.com/bradrevans/myrient-downloader');
  });

  document.getElementById('donate-link').addEventListener('click', () => {
    api.openExternal('https://myrient.erista.me/donate/');
  });

  setupSearch('search-archives', 'list-archives', '.list-item');
  setupSearch('search-directories', 'list-directories', '.list-item');
  setupSearch('search-tags', 'wizard-tags-list', 'label');
  setupSearch('search-priority-tags', 'priority-available', '.list-group-item');
  setupSearch('search-results', 'results-list', '.p-1.text-sm.truncate');

  setupSearchClearButton('search-archives', 'search-archives-clear');
  setupSearchClearButton('search-directories', 'search-directories-clear');
  setupSearchClearButton('search-tags', 'search-tags-clear');
  setupSearchClearButton('search-priority-tags', 'search-priority-tags-clear');
  setupSearchClearButton('search-results', 'search-results-clear');

  loadArchives();
  updateBreadcrumbs();
  setupDownloadUiListeners();
});

window.electronAPI.onDownloadComplete(async (summary) => {
  log('info', `Download complete. Message: ${summary.message}`);
  logDownload(summary.message);

  if (summary.wasCancelled && summary.partialFile) {
    const userWantsDelete = confirm(`Download cancelled. Do you want to delete the incomplete file?\n\nFile: ${summary.partialFile.name}`);
    if (userWantsDelete) {
      await api.deleteFile(summary.partialFile.path);
      logDownload(`Deleted partial file: ${summary.partialFile.name}`);
    }
  }

  state.isDownloading = false;
  downloadUi.scanBtn.disabled = false;
  downloadUi.dirBtn.disabled = false;
  downloadUi.cancelBtn.classList.add('hidden');
  downloadUi.cancelBtn.disabled = false;
  downloadUi.overallProgressTime.textContent = "Estimated Time Remaining: --";
  downloadUi.restartBtn.classList.remove('hidden');
});
