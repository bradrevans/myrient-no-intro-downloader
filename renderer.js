const state = {
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

let views = {};
let breadcrumbs;
let loadingSpinner;
let loadingText;
let headerBackButton;
let downloadUi = {};

function log(level, message) {
  console[level](message);
  window.electronAPI.log(level, `[Renderer] ${message}`);
}

function showView(viewId) {
  Object.values(views).forEach(v => v.classList.remove('active'));
  views[viewId].classList.add('active');
  state.currentView = viewId;
  updateBreadcrumbs();

  if (viewId === 'archives') {
    headerBackButton.classList.add('invisible');
  } else {
    headerBackButton.classList.remove('invisible');
  }
}

function updateBreadcrumbs() {
  let html = `<span class="cursor-pointer hover:text-orange-500 transition-all duration-200" data-view="archives" data-step="0">Myrient Downloader</span>`;
  if (state.archive.name) {
    html += ` <span class="mx-2">&gt;</span> <span class="cursor-pointer hover:text-orange-500 transition-all duration-200" data-view="directories" data-step="1">${state.archive.name}</span>`;
  }
  if (state.directory.name) {
    html += ` <span class="mx-2">&gt;</span> <span class="hover:text-orange-500 transition-all duration-200">${state.directory.name}</span>`;
  }
  breadcrumbs.innerHTML = html;
}

function showLoading(text = 'Loading...') {
  loadingText.textContent = text;
  loadingSpinner.classList.remove('hidden');
}

function hideLoading() {
  loadingSpinner.classList.add('hidden');
}

function setupSearch(inputId, listContainerId, itemSelector) {
  document.getElementById(inputId).addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const searchTerms = query.split(' ').filter(term => term.length > 0);

    document.querySelectorAll(`#${listContainerId} ${itemSelector}`).forEach(item => {
      const name = (item.dataset.name || item.textContent).toLowerCase();

      const isMatch = searchTerms.every(term => name.includes(term));

      item.style.display = isMatch ? 'block' : 'none';
    });
  });
}

function populateList(listId, items, clickHandler) {
  const listEl = document.getElementById(listId);
  listEl.innerHTML = '';
  items.forEach(item => {
    const el = document.createElement('button');
    el.className = 'list-item text-left';
    el.textContent = item.name;
    el.dataset.name = item.name;
    el.dataset.href = item.href;
    el.addEventListener('click', () => clickHandler(item));
    listEl.appendChild(el);
  });
}

async function loadArchives() {
  showLoading('Loading Archives...');
  const result = await window.electronAPI.getMainArchives();
  hideLoading();
  if (result.error) {
    alert(`Error: ${result.error}`);
    return;
  }
  populateList('list-archives', result.data, (item) => {
    state.archive = item;
    loadDirectories();
  });
}

async function loadDirectories() {
  showLoading('Loading Directories...');
  const archiveUrl = new URL(state.archive.href, state.baseUrl).href;
  const result = await window.electronAPI.getDirectoryList(archiveUrl);
  hideLoading();
  if (result.error) {
    alert(`Error: ${result.error}`);
    return;
  }

  populateList('list-directories', result.data, (item) => {
    handleDirectorySelect(item);
  });
  showView('directories');

  const searchInput = document.getElementById('search-directories');
  if (searchInput.value) {
    searchInput.dispatchEvent(new Event('input'));
  }
}

async function handleDirectorySelect(item) {
  state.directory = item;
  showLoading('Scanning files... (This may take a while)');
  const pageUrl = new URL(state.archive.href + item.href, state.baseUrl).href;

  const result = await window.electronAPI.scrapeAndParseFiles(pageUrl);
  hideLoading();

  if (result.error) {
    alert(`Error: ${result.error}`);
    showView('directories');
    return;
  }

  state.allFiles = result.files;
  state.allTags = result.tags.filter(tag => !/^(v|Rev)\s*[\d\.]+$/i.test(tag));

  setupWizard();
  showView('wizard');
}

function updatePriorityBuilderAvailableTags() {
  const langMode = document.getElementById('filter-lang-mode').value;
  let availableTags = [];

  if (langMode === 'include') {
    document.querySelectorAll('#wizard-tags-list input[type=checkbox]:checked').forEach(cb => {
      availableTags.push(cb.parentElement.dataset.name);
    });
  } else if (langMode === 'all') {
    availableTags = state.allTags;
  } else {
    const excludeTags = new Set();
    document.querySelectorAll('#wizard-tags-list input[type=checkbox]:checked').forEach(cb => {
      excludeTags.add(cb.parentElement.dataset.name);
    });
    availableTags = state.allTags.filter(tag => !excludeTags.has(tag));
  }
  const availableTagsSet = new Set(availableTags);

  const priorityList = document.getElementById('priority-list');
  const priorityAvailable = document.getElementById('priority-available');

  const currentPriorityItems = Array.from(priorityList.children);

  const validPriorityItems = currentPriorityItems.filter(item =>
    availableTagsSet.has(item.textContent)
  );
  const validPriorityTagsSet = new Set(
    validPriorityItems.map(item => item.textContent)
  );

  const tagsForAvailableList = availableTags.filter(tag =>
    !validPriorityTagsSet.has(tag)
  );
  tagsForAvailableList.sort((a, b) => a.localeCompare(b));

  priorityList.innerHTML = '';
  priorityAvailable.innerHTML = '';

  validPriorityItems.forEach(item => priorityList.appendChild(item));

  tagsForAvailableList.forEach((tag, i) => {
    const el = document.createElement('div');
    el.className = 'list-group-item';
    el.textContent = tag;
    el.dataset.name = tag;
    el.dataset.id = `tag-priority-available-${i}`;
    priorityAvailable.appendChild(el);
  });

  const searchInput = document.getElementById('search-priority-tags');
  if (searchInput && searchInput.value) {
    searchInput.dispatchEvent(new Event('input'));
  }

  if (state.prioritySortable) state.prioritySortable.destroy();
  if (state.availableSortable) state.availableSortable.destroy();

  state.availableSortable = new Sortable(priorityAvailable, {
    group: 'shared',
    animation: 150,
    sort: false,
    onAdd: (evt) => {
      const allItems = Array.from(priorityAvailable.children);
      allItems.sort((a, b) => a.textContent.localeCompare(b.textContent));
      allItems.forEach(item => priorityAvailable.appendChild(item));
    }
  });

  state.prioritySortable = new Sortable(priorityList, {
    group: 'shared',
    animation: 150,
  });
}


function setupWizard() {
  document.getElementById('filter-lang-mode').value = 'include';
  document.getElementById('filter-revision-mode').value = 'highest';
  document.getElementById('filter-dedupe-mode').value = 'priority';

  document.getElementById('wizard-file-count').textContent = state.allFiles.length;
  document.getElementById('wizard-tag-count').textContent = state.allTags.length;

  const langTagList = document.getElementById('wizard-tags-list');
  langTagList.innerHTML = '';
  state.allTags.forEach(tag => {
    const el = document.createElement('label');
    el.className = 'flex items-center p-2 bg-neutral-900 rounded-md space-x-2 cursor-pointer hover:bg-neutral-700';
    el.dataset.name = tag;
    el.innerHTML = `
      <input type="checkbox" class="h-4 w-4">
      <span class="text-neutral-300">${tag}</span>
    `;
    langTagList.appendChild(el);
  });

  document.getElementById('priority-list').innerHTML = '';
  document.getElementById('priority-available').innerHTML = '';

  updatePriorityBuilderAvailableTags();

  langTagList.addEventListener('click', (e) => {
    if (e.target.type === 'checkbox') {
      updatePriorityBuilderAvailableTags();
    }
  });

  document.getElementById('select-all-tags-btn').addEventListener('click', () => {
    const query = document.getElementById('search-tags').value.toLowerCase();
    document.querySelectorAll('#wizard-tags-list label').forEach(label => {
      if (label.style.display !== 'none' || query === '') {
        label.querySelector('input[type=checkbox]').checked = true;
      }
    });
    updatePriorityBuilderAvailableTags();
  });

  document.getElementById('deselect-all-tags-btn').addEventListener('click', () => {
    const query = document.getElementById('search-tags').value.toLowerCase();
    document.querySelectorAll('#wizard-tags-list label').forEach(label => {
      if (label.style.display !== 'none' || query === '') {
        label.querySelector('input[type=checkbox]').checked = false;
      }
    });
    updatePriorityBuilderAvailableTags();
  });

  const priorityList = document.getElementById('priority-list');

  function getVisibleAvailableItems() {
    return Array.from(document.querySelectorAll('#priority-available .list-group-item'))
      .filter(el => el.style.display !== 'none')
      .map(el => ({ el, text: el.textContent }));
  }

  document.getElementById('add-all-shortest').addEventListener('click', () => {
    let visibleItems = getVisibleAvailableItems();
    visibleItems.sort((a, b) => a.text.length - b.text.length);
    visibleItems.forEach(item => priorityList.appendChild(item.el));
  });

  document.getElementById('add-all-longest').addEventListener('click', () => {
    let visibleItems = getVisibleAvailableItems();
    visibleItems.sort((a, b) => b.text.length - a.text.length);
    visibleItems.forEach(item => priorityList.appendChild(item.el));
  });

  document.getElementById('filter-lang-mode').addEventListener('change', (e) => {
    document.getElementById('lang-tag-ui').style.display = e.target.value === 'all' ? 'none' : 'block';
    updatePriorityBuilderAvailableTags();
  });
  document.getElementById('filter-dedupe-mode').addEventListener('change', (e) => {
    document.getElementById('priority-builder-ui').style.display = e.target.value === 'priority' ? 'block' : 'none';
  });

  document.getElementById('filter-lang-mode').dispatchEvent(new Event('change'));
  document.getElementById('filter-dedupe-mode').dispatchEvent(new Event('change'));
}

function populateResults() {
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

function startDownload() {
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

  const baseUrl = new URL(state.archive.href + state.directory.href, state.baseUrl).href;

  window.electronAPI.startDownload(baseUrl, state.finalFileList, state.downloadDirectory);
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatTime(totalSeconds) {
  if (totalSeconds === Infinity || totalSeconds < 0 || isNaN(totalSeconds)) {
    return "--";
  }
  const hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function logDownload(message) {
  const logEl = document.getElementById('download-log');
  logEl.innerHTML += `<div>${message}</div>`;
  logEl.scrollTop = logEl.scrollHeight;
}

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
    `${percent}% (${formatBytes(data.current)} / ${formatBytes(data.total)})`;

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
    `${percent}% (${formatBytes(data.current)} / ${formatBytes(data.total)})`;
});

window.electronAPI.onDownloadLog(message => {
  logDownload(message);
});

window.electronAPI.onDownloadComplete(async (summary) => {
  log('info', `Download complete. Message: ${summary.message}`);
  logDownload(summary.message);

  if (summary.wasCancelled && summary.partialFile) {
    const userWantsDelete = confirm(
      `Download cancelled. Do you want to delete the incomplete file?

File: ${summary.partialFile.name}`
    );

    if (userWantsDelete) {
      log.info(`User confirmed delete for: ${summary.partialFile.path}`);
      try {
        await window.electronAPI.deleteFile(summary.partialFile.path);
        logDownload(`Deleted partial file: ${summary.partialFile.name}`);
      } catch (e) {
        log.error(`Failed to delete partial file: ${e.message}`);
        logDownload(`Error: Could not delete ${summary.partialFile.name}.`);
      }
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


document.addEventListener('DOMContentLoaded', () => {
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
    window.electronAPI.windowMinimize();
  });
  document.getElementById('maximize-restore-btn').addEventListener('click', () => {
    window.electronAPI.windowMaximizeRestore();
  });
  document.getElementById('close-btn').addEventListener('click', () => {
    window.electronAPI.windowClose();
  });

  document.getElementById('wizard-run-btn').addEventListener('click', async () => {
    showLoading('Filtering files...');

    const langMode = document.getElementById('filter-lang-mode').value;
    const selectedTags = [];
    document.querySelectorAll('#wizard-tags-list input[type=checkbox]:checked').forEach(cb => {
      selectedTags.push(cb.parentElement.dataset.name);
    });

    const priorityList = Array.from(document.querySelectorAll('#priority-list .list-group-item')).map(el => el.textContent);

    let tagsForPriority;
    if (langMode === 'include') {
      tagsForPriority = selectedTags;
    } else {
      tagsForPriority = state.allTags.filter(tag =>
        !selectedTags.includes(tag)
      );
    }

    const filters = {
      lang_mode: langMode,
      lang_tags: selectedTags,
      rev_mode: document.getElementById('filter-revision-mode').value,
      dedupe_mode: document.getElementById('filter-dedupe-mode').value,
      priority_list: priorityList,
      keep_fallbacks: document.getElementById('filter-keep-fallbacks').checked,
    };

    const result = await window.electronAPI.filterFiles(state.allFiles, tagsForPriority, filters);
    hideLoading();

    if (result.error) {
      alert(`Error during filtering: ${result.error}`);
      return;
    }

    state.finalFileList = result.data;
    populateResults();
    showView('results');
  });

  downloadUi.dirBtn.addEventListener('click', async () => {
    const dir = await window.electronAPI.getDownloadDirectory();
    if (dir) {
      state.downloadDirectory = dir;
      downloadUi.dirText.textContent = dir;
      downloadUi.scanBtn.disabled = false;
    }
  });

  downloadUi.scanBtn.addEventListener('click', () => startDownload());

  downloadUi.cancelBtn.addEventListener('click', () => {
    log('info', 'Cancel button clicked.');
    logDownload('Cancelling download, please wait...');
    downloadUi.cancelBtn.disabled = true;
    window.electronAPI.cancelDownload();
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
    window.electronAPI.openExternal('https://github.com/bradrevans/myrient-downloader');
  });

  document.getElementById('donate-link').addEventListener('click', () => {
    window.electronAPI.openExternal('https://myrient.erista.me/donate/');
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
});


function clearSearchAndTrigger(inputId) {
  const input = document.getElementById(inputId);
  if (input && input.value) {
    input.value = '';
    input.dispatchEvent(new Event('input'));

    const clearBtn = document.getElementById(inputId + '-clear');
    if (clearBtn) {
      clearBtn.style.display = 'none';
    }
  }
}

function setupSearchClearButton(inputId, clearId) {
  const input = document.getElementById(inputId);
  const clearBtn = document.getElementById(clearId);

  if (input && clearBtn) {
    input.addEventListener('input', () => {
      clearBtn.style.display = input.value.length > 0 ? 'block' : 'none';
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      input.dispatchEvent(new Event('input'));
      input.focus();
    });
  }
}