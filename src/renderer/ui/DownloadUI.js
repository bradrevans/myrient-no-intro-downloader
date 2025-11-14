import { formatTime } from '../utils.js';
import InfoIcon from './InfoIcon.js';
import tooltipContent from '../tooltipContent.js';

/**
 * Manages the user interface elements and interactions related to the download process.
 */
export default class DownloadUI {
  /**
   * Creates an instance of DownloadUI.
   * @param {object} stateService The StateService instance for managing application state.
   * @param {object} apiService The ApiService instance for interacting with the main process.
   * @param {object} uiManager The UIManager instance for managing overall UI.
   */
  constructor(stateService, apiService, uiManager) {
    this.stateService = stateService;
    this.apiService = apiService;
    this.uiManager = uiManager;
    this.downloadDirectoryStructure = null;
    this.resultsListChangeListener = null;
    this._isExtracting = false;
    this._setupEventListeners();
    if (window.electronAPI && window.electronAPI.onExtractionStarted) {
      window.electronAPI.onExtractionStarted(() => {
        this._isExtracting = true;
        const elements = this._getElements();
        elements.overallExtractionProgressBar.classList.remove('hidden');
        elements.extractionProgressBar.classList.remove('hidden');
      });
    }
    if (window.electronAPI && window.electronAPI.onExtractionEnded) {
      window.electronAPI.onExtractionEnded(() => {
        this._isExtracting = false;
        const elements = this._getElements();
        elements.overallExtractionProgressBar.classList.add('hidden');
        elements.extractionProgressBar.classList.add('hidden');
      });
    }
  }

  /**
   * Handles the click event for the cancel button, disabling it and logging a cancellation message.
   */
  handleCancelClick() {
    const elements = this._getElements();
    if (elements.downloadCancelBtn) elements.downloadCancelBtn.disabled = true;
    this.log(this._isExtracting ? 'Cancelling extraction, please wait...' : 'Cancelling download, please wait...');
  }

  /**
   * Retrieves and returns an object containing references to various DOM elements used in the download UI.
   * @returns {object} An object with keys as element IDs and values as the corresponding DOM elements.
   * @private
   */
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
      fileProgressContainer: document.getElementById('file-progress-container'),
      fileProgressLabel: document.querySelector('label[for="file-progress"]'),
      fileProgressName: document.getElementById('file-progress-name'),
      fileProgressSize: document.getElementById('file-progress-size'),
      downloadDirBtn: document.getElementById('download-dir-btn'),
      extractionProgressBar: document.getElementById('extraction-progress-bar'),
      extractionProgress: document.getElementById('extraction-progress'),
      extractionProgressName: document.getElementById('extraction-progress-name'),
      extractionProgressText: document.getElementById('extraction-progress-text'),
      overallExtractionProgressBar: document.getElementById('overall-extraction-progress-bar'),
      overallExtractionProgress: document.getElementById('overall-extraction-progress'),
      overallExtractionProgressText: document.getElementById('overall-extraction-progress-text'),
      overallExtractionProgressTime: document.getElementById('overall-extraction-progress-time'),
      selectAllResultsBtn: document.getElementById('select-all-results-btn'),
      deselectAllResultsBtn: document.getElementById('deselect-all-results-btn'),
      resultsSelectedCount: document.getElementById('results-selected-count'),
      createSubfolderCheckbox: document.getElementById('create-subfolder-checkbox'),
      createSubfolderLabel: document.querySelector('label[for="create-subfolder-checkbox"]'),
      maintainFolderStructureCheckbox: document.getElementById('maintain-folder-structure-checkbox'),
      throttleDownloadCheckbox: document.getElementById('throttle-download-checkbox'),
      throttleSpeedInput: document.getElementById('throttle-speed-input'),
      throttleUnitSelect: document.getElementById('throttle-unit-select'),
    };
  }

  /**
   * Updates the displayed count of selected results.
   */
  updateSelectedCount() {
    const elements = this._getElements();
    if (!elements.resultsSelectedCount) return;
    const selectedCount = this.stateService.get('selectedResults').length;
    elements.resultsSelectedCount.innerHTML = `Selected to download: <span class="font-bold text-white">${selectedCount}</span>`;
  }

  /**
   * Updates the application's state with the currently selected download results based on UI checkboxes.
   * @private
   */
  _updateSelectionState() {
    const elements = this._getElements();
    if (!elements.resultsList) return;

    const finalFileList = this.stateService.get('finalFileList');
    const updatedSelectedResults = Array.from(elements.resultsList.querySelectorAll('input[type=checkbox]:checked'))
      .map(cb => {
        const name = cb.parentElement.dataset.name;
        return finalFileList.find(f => f.name_raw === name);
      })
      .filter(Boolean);

    this.stateService.set('selectedResults', updatedSelectedResults);
    this.updateSelectedCount();
    this.updateScanButtonState();
  }

  /**
   * Updates the text of the Scan & Download button based on extract checkbox state.
   */
  updateScanButtonText() {
    const elements = this._getElements();
    const scanBtn = elements.downloadScanBtn;
    const extractCheckbox = document.getElementById('extract-archives-checkbox');
    if (scanBtn) {
      if (extractCheckbox && extractCheckbox.checked) {
        scanBtn.textContent = 'Scan, Download & Extract';
      } else {
        scanBtn.textContent = 'Scan & Download';
      }
    }
  }

  /**
   * Updates the title (tooltip) of the Scan & Download button based on state.
   */
  updateScanButtonTitle() {
    const elements = this._getElements();
    const scanBtn = elements.downloadScanBtn;
    if (scanBtn) {
      const selectedResults = this.stateService.get('selectedResults') || [];
      const noResults = selectedResults.length === 0;
      const noDir = !this.stateService.get('downloadDirectory');
      if (noResults && noDir) {
        scanBtn.title = "Select at least one result and a target directory to enable downloading.";
      } else if (noResults) {
        scanBtn.title = "Select at least one result to enable downloading.";
      } else if (noDir) {
        scanBtn.title = "Select a target directory to enable downloading.";
      } else {
        scanBtn.title = '';
      }
    }
  }

  /**
   * Updates the enabled/disabled state, text, and tooltip of the Scan & Download button.
   */
  updateScanButtonState() {
    const elements = this._getElements();
    const scanBtn = elements.downloadScanBtn;
    if (scanBtn) {
      const selectedResults = this.stateService.get('selectedResults') || [];
      const noResults = selectedResults.length === 0;
      const noDir = !this.stateService.get('downloadDirectory');
      scanBtn.disabled = noResults || noDir;
      this.updateScanButtonText();
      this.updateScanButtonTitle();
    }
  }

  /**
   * Populates the results list in the UI with the final filtered file list.
   * Sets up event listeners for checkbox changes and resets download-related UI elements.
   * @param {boolean} hasSubdirectories Indicates if the selected directory contains subdirectories.
   * @returns {Promise<void>}
   */
  async populateResults(hasSubdirectories = false) {
    const elements = this._getElements();
    if (!elements.resultsFileCount) return;

    const finalFileList = this.stateService.get('finalFileList');
    elements.resultsFileCount.textContent = finalFileList.length;
    elements.resultsTotalCount.textContent = this.stateService.get('allFiles').length;

    elements.resultsList.innerHTML = '';

    finalFileList.forEach(item => {
      const el = document.createElement('label');
      el.className = 'flex items-center p-2 bg-neutral-900 rounded-md space-x-2 cursor-pointer border border-transparent hover:border-accent-500 hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-accent-500 select-none';
      el.dataset.name = item.name_raw;
      el.tabIndex = 0;

      el.innerHTML = `
        <input type="checkbox" class="h-4 w-4" checked>
        <span class="text-neutral-300 truncate">${item.name_raw}</span>
      `;
      elements.resultsList.appendChild(el);
    });

    elements.createSubfolderCheckbox.checked = false;
    elements.createSubfolderCheckbox.disabled = false;
    this.stateService.set('createSubfolder', false);

    elements.maintainFolderStructureCheckbox.checked = false;
    this.stateService.set('maintainFolderStructure', false);

    const throttleDownloadCheckbox = document.getElementById('throttle-download-checkbox');
    const throttleSpeedInput = document.getElementById('throttle-speed-input');
    const throttleUnitSelect = document.getElementById('throttle-unit-select');

    if (throttleDownloadCheckbox && throttleSpeedInput && throttleUnitSelect) {
      const isThrottlingEnabled = this.stateService.get('isThrottlingEnabled') || false;
      const throttleSpeed = this.stateService.get('throttleSpeed') || 100;
      const throttleUnit = this.stateService.get('throttleUnit') || 'KB/s';

      throttleDownloadCheckbox.checked = isThrottlingEnabled;
      throttleSpeedInput.disabled = !isThrottlingEnabled;
      throttleUnitSelect.disabled = !isThrottlingEnabled;

      throttleSpeedInput.value = throttleSpeed;
      throttleUnitSelect.value = throttleUnit;

      this.stateService.set('isThrottlingEnabled', isThrottlingEnabled);
      this.stateService.set('throttleSpeed', throttleSpeed);
      this.stateService.set('throttleUnit', throttleUnit);

      if (!throttleSpeedInput.parentNode.querySelector('.info-icon')) {
        const infoIcon = new InfoIcon(tooltipContent.throttleSpeed);
        throttleSpeedInput.parentNode.appendChild(infoIcon.element);
      }
    }

    const extractArchivesCheckbox = document.getElementById('extract-archives-checkbox');
    if (extractArchivesCheckbox) {
      extractArchivesCheckbox.checked = false;
    }

    const extractPreviouslyDownloadedCheckbox = document.getElementById('extract-previously-downloaded-checkbox');
    if (extractPreviouslyDownloadedCheckbox) {
      extractPreviouslyDownloadedCheckbox.checked = false;
      const extractArchivesCheckbox = document.getElementById('extract-archives-checkbox');
      if (extractArchivesCheckbox) {
        extractPreviouslyDownloadedCheckbox.disabled = !extractArchivesCheckbox.checked;
        const parentLabel = extractPreviouslyDownloadedCheckbox.closest('label');
        if (parentLabel) {
          if (!extractArchivesCheckbox.checked) {
            parentLabel.classList.add('disabled-option');
          } else {
            parentLabel.classList.remove('disabled-option');
          }
        }
      }
    }

    this._updateSelectionState();
    this.updateScanButtonText();
    this.updateScanButtonState();

    if (this.resultsListChangeListener) {
      elements.resultsList.removeEventListener('change', this.resultsListChangeListener);
    }

    this.resultsListChangeListener = (e) => {
      if (e.target.type === 'checkbox') {
        this._updateSelectionState();
        e.target.parentElement.focus();
      }
    };
    elements.resultsList.addEventListener('change', this.resultsListChangeListener);

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

  /**
   * Initiates the download process after performing necessary checks and UI updates.
   * Displays confirmation modals for directory structure mismatches.
   * @returns {Promise<void>}
   */
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
      const userConfirmed = await this.uiManager.showConfirmationModal(confirmationMessage, { title: 'File Structure Mismatch' });
      if (!userConfirmed) {
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

    elements.fileProgressLabel.classList.remove('hidden');

    elements.extractionProgress.value = 0;
    elements.overallExtractionProgress.value = 0;
    elements.overallExtractionProgressText.textContent = "";
    elements.overallExtractionProgressTime.textContent = "Estimated Time Remaining: --";
    elements.extractionProgressName.textContent = "";
    elements.extractionProgressText.textContent = "";

    elements.scanProgressBar.classList.remove('hidden');
    elements.downloadProgressBars.classList.remove('hidden');
    elements.extractionProgressBar.classList.add('hidden');
    elements.overallExtractionProgressBar.classList.add('hidden');

    const isThrottlingEnabled = this.stateService.get('isThrottlingEnabled');
    const throttleSpeed = this.stateService.get('throttleSpeed');
    const throttleUnit = this.stateService.get('throttleUnit');
    this.apiService.startDownload(this.stateService.get('selectedResults'), isThrottlingEnabled, throttleSpeed, throttleUnit);
  }

  /**
   * Appends a message to the download log display.
   * @param {string} message The message to log.
   */
  log(message) {
    const elements = this._getElements();
    if (!elements.downloadLog) return;
    const logEl = elements.downloadLog;
    logEl.innerHTML += `<div>${message}</div>`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  /**
   * Sets up all event listeners for UI interactions and IPC communications related to downloads.
   * @private
   */
  _setupEventListeners() {
    window.electronAPI.onHideDownloadUi(() => {
      const elements = this._getElements();
      elements.scanProgressBar.classList.add('hidden');
      elements.downloadProgressBars.classList.add('hidden');
      elements.downloadCancelBtn.classList.add('hidden');
      elements.downloadRestartBtn.classList.add('hidden');
      elements.extractionProgressBar.classList.add('hidden');
      elements.overallExtractionProgressBar.classList.add('hidden');
      elements.fileProgress.classList.add('hidden');
      elements.fileProgressName.classList.add('hidden');
      elements.fileProgressSize.classList.add('hidden');
      elements.fileProgressLabel.classList.add('hidden');
      elements.extractionProgress.value = 0;
      elements.overallExtractionProgress.value = 0;
      elements.overallExtractionProgressText.textContent = "";
      elements.overallExtractionProgressTime.textContent = "Estimated Time Remaining: --";
      elements.extractionProgressName.textContent = "";
      elements.extractionProgressText.textContent = "";
    });
    document.addEventListener('click', (e) => {
      const elements = this._getElements();
      if (!elements.resultsList) return;

      if (e.target.id === 'select-all-results-btn') {
        elements.resultsList.querySelectorAll('label:not(.hidden) input[type=checkbox]').forEach(checkbox => {
          checkbox.checked = true;
        });
        this._updateSelectionState();
      }

      if (e.target.id === 'deselect-all-results-btn') {
        elements.resultsList.querySelectorAll('label:not(.hidden) input[type=checkbox]').forEach(checkbox => {
          checkbox.checked = false;
        });
        this._updateSelectionState();
      }
    });

    document.addEventListener('change', (e) => {
      const { throttleDownloadCheckbox, throttleSpeedInput, throttleUnitSelect } = this._getElements();
      if (e.target.id === 'throttle-download-checkbox') {
        const isThrottlingEnabled = e.target.checked;
        throttleSpeedInput.disabled = !isThrottlingEnabled;
        throttleUnitSelect.disabled = !isThrottlingEnabled;
        this.stateService.set('isThrottlingEnabled', isThrottlingEnabled);
        if (isThrottlingEnabled) {
          this.stateService.set('throttleSpeed', parseInt(throttleSpeedInput.value, 10));
          this.stateService.set('throttleUnit', throttleUnitSelect.value);
        }
      }

      if (e.target.id === 'throttle-speed-input') {
        this.stateService.set('throttleSpeed', parseInt(e.target.value, 10));
      }

      if (e.target.id === 'throttle-unit-select') {
        this.stateService.set('throttleUnit', e.target.value);
      }

      const elements = this._getElements();
      if (e.target.id === 'create-subfolder-checkbox' && !e.target.disabled) {
        this.stateService.set('createSubfolder', e.target.checked);
      }
      if (e.target.id === 'maintain-folder-structure-checkbox') {
        this.stateService.set('maintainFolderStructure', e.target.checked);
      }
      if (e.target.id === 'extract-archives-checkbox') {
        const extractPreviouslyDownloadedCheckbox = document.getElementById('extract-previously-downloaded-checkbox');
        if (extractPreviouslyDownloadedCheckbox) {
          extractPreviouslyDownloadedCheckbox.disabled = !e.target.checked;
          const parentLabel = extractPreviouslyDownloadedCheckbox.closest('label');
          if (parentLabel) {
            if (!e.target.checked) {
              parentLabel.classList.add('disabled-option');
            } else {
              parentLabel.classList.remove('disabled-option');
            }
          }
          if (!e.target.checked) {
            extractPreviouslyDownloadedCheckbox.checked = false;
          }
        }
      }
    });

    window.electronAPI.onDownloadScanProgress(data => {
      const elements = this._getElements();
      if (!elements.scanProgress) return;
      const percent = data.total > 0 ? (data.current / data.total) * 100 : 0;
      elements.scanProgress.value = percent;
      const percentFixed = percent.toFixed(0);
      elements.scanProgressText.textContent = `${percentFixed}% (${data.current} / ${data.total} files)`;
    });

    window.electronAPI.onDownloadOverallProgress(async data => {
      const elements = this._getElements();
      if (!elements.overallProgress) return;
      const percent = data.total > 0 ? (data.current / data.total) * 100 : 0;
      elements.overallProgress.value = percent;
      const percentFixed = percent.toFixed(1);
      elements.overallProgressText.textContent =
        `${await window.electronAPI.formatBytes(data.current)} / ${await window.electronAPI.formatBytes(data.total)} (${percentFixed}%)`;

      this.stateService.set('totalBytesDownloadedThisSession', data.current - data.skippedSize);

      const timeElapsed = (Date.now() - this.stateService.get('downloadStartTime')) / 1000;

      if (timeElapsed > 1 && this.stateService.get('totalBytesDownloadedThisSession') > 0) {
        const avgSpeed = this.stateService.get('totalBytesDownloadedThisSession') / timeElapsed;
        const sizeRemaining = data.total - data.current;

        if (avgSpeed > 0 && sizeRemaining > 0) {
          const secondsRemaining = sizeRemaining / avgSpeed;
          elements.overallProgressTime.textContent = `Estimated Time Remaining: ${formatTime(secondsRemaining)}`;
        } else {
          elements.overallProgressTime.textContent = "Estimated Time Remaining: --";
        }
      }
    });

    window.electronAPI.onDownloadFileProgress(async data => {
      const elements = this._getElements();
      if (!elements.fileProgress) return;

      elements.fileProgressContainer.classList.remove('hidden');

      const newFileNameText = `${data.name} (${data.currentFileIndex}/${data.totalFilesToDownload})`;
      if (elements.fileProgressName.textContent !== newFileNameText) {
        elements.fileProgress.value = 0;
        elements.fileProgressName.textContent = newFileNameText;
      }

      const percent = data.total > 0 ? (data.current / data.total) * 100 : 0;
      elements.fileProgress.value = percent;
      const percentFixed = percent.toFixed(0);
      elements.fileProgressSize.textContent =
        `${await window.electronAPI.formatBytes(data.current)} / ${await window.electronAPI.formatBytes(data.total)} (${percentFixed}%)`;
    });

    window.electronAPI.onDownloadLog(message => {
      this.log(message);
    });

    window.electronAPI.onDownloadComplete((summary) => {
      const elements = this._getElements();
      if (!elements.fileProgressContainer) return;
      elements.fileProgressContainer.classList.add('hidden');
    });

    window.electronAPI.onExtractionProgress(async data => {
      const elements = this._getElements();
      if (!elements.extractionProgress) return;

      const overallExtractionProgressBar = document.getElementById('overall-extraction-progress-bar');
      if (data.totalUncompressedSizeOfAllArchives > 0) {
        const overallPercent = data.totalUncompressedSizeOfAllArchives > 0 ? (data.overallExtractedBytes / data.totalUncompressedSizeOfAllArchives) * 100 : 0;
        elements.overallExtractionProgress.value = overallPercent;
        const overallPercentFixed = overallPercent.toFixed(1);
        elements.overallExtractionProgressText.textContent = `${await window.electronAPI.formatBytes(data.overallExtractedBytes)} / ${await window.electronAPI.formatBytes(data.totalUncompressedSizeOfAllArchives)} (${overallPercentFixed}%)`;
        if (data.eta !== undefined) {
          elements.overallExtractionProgressTime.textContent = `Estimated Time Remaining: ${data.eta}`;
        } else {
          elements.overallExtractionProgressTime.textContent = "Estimated Time Remaining: --";
        }
      }

      const extractionProgressBar = document.getElementById('extraction-progress-bar');
      if (data.fileTotal > 0) {
        const filePercent = data.fileTotal > 0 ? (data.fileProgress / data.fileTotal) * 100 : 0;
        elements.extractionProgress.value = filePercent;
        const filePercentFixed = filePercent.toFixed(0);
        elements.extractionProgressName.textContent = `${data.filename} (${data.overallExtractedEntryCount}/${data.totalEntriesOverall})`;
        elements.extractionProgressText.textContent = `${await window.electronAPI.formatBytes(data.fileProgress)} / ${await window.electronAPI.formatBytes(data.fileTotal)} (${filePercentFixed}%)`;
      }
    });
  }
}
