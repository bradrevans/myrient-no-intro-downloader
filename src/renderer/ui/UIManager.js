import stateService from '../StateService.js';
import apiService from '../ApiService.js';
import Search from './Search.js';
import KeyboardNavigator from './KeyboardNavigator.js';

/**
 * Manages the overall user interface, including view switching, loading states, modals, and event listeners.
 */
class UIManager {
  /**
   * Creates an instance of UIManager.
   * @param {HTMLElement} viewContainer The DOM element where different views will be rendered.
   * @param {function} loadArchivesCallback A callback function to load archives.
   */
  constructor(viewContainer, loadArchivesCallback) {
    this.viewContainer = viewContainer;
    this.views = {};
    this.currentView = null;
    this.loadArchivesCallback = loadArchivesCallback;
    this.downloadUI = null;
  }

  /**
   * Sets the DownloadUI instance for interaction.
   * @param {object} downloadUI The DownloadUI instance.
   */
  setDownloadUI(downloadUI) {
    this.downloadUI = downloadUI;
  }

  /**
   * Asynchronously loads HTML content for various views into memory.
   * @returns {Promise<void>}
   */
  async loadViews() {
    const viewFiles = ['archives', 'directories', 'wizard', 'results'];
    for (const view of viewFiles) {
      const response = await fetch(`./views/${view}.html`);
      this.views[view] = await response.text();
    }
  }

  /**
   * Displays a specified view in the main content area.
   * @param {string} viewId The ID of the view to display (e.g., 'archives', 'directories').
   */
  showView(viewId) {
    document.querySelector('main').scrollTop = 0;
    if (this.views[viewId]) {
      if (this.currentView) {
        const prevViewElement = this.viewContainer.querySelector('.view.active');
        if (prevViewElement) {
          prevViewElement.classList.remove('active');
        }
      }

      this.viewContainer.innerHTML = this.views[viewId];
      this.currentView = viewId;
      stateService.set('currentView', viewId);

      const newViewElement = this.viewContainer.querySelector('.view');
      if (newViewElement) {
        newViewElement.classList.add('active');
      }

      const backButton = document.getElementById('header-back-btn');
      if (backButton) {
        if (viewId === 'archives') {
          backButton.classList.add('invisible');
        } else {
          backButton.classList.remove('invisible');
        }
      }

      this.updateBreadcrumbs();
      this.addEventListeners(viewId);
      this.setupSearchEventListeners(viewId);
    }
  }

  /**
   * Displays a loading spinner with an optional message.
   * @param {string} [text='Loading...'] The message to display alongside the spinner.
   */
  showLoading(text = 'Loading...') {
    document.getElementById('loading-text').textContent = text;
    document.getElementById('loading-spinner').classList.remove('hidden');
  }

  /**
   * Hides the loading spinner.
   */
  hideLoading() {
    document.getElementById('loading-spinner').classList.add('hidden');
  }

  /**
   * Displays a confirmation modal to the user.
   * @param {string} message The message to display in the modal.
   * @param {object} [options={}] Optional settings for the modal.
   * @param {string} [options.title='Confirmation'] The title of the modal.
   * @param {string} [options.confirmText='Continue'] The text for the confirmation button.
   * @param {string} [options.cancelText='Cancel'] The text for the cancel button.
   * @returns {Promise<boolean>} A promise that resolves to true if the user confirms, false otherwise.
   */
  async showConfirmationModal(message, options = {}) {
    const {
      title = 'Confirmation',
      confirmText = 'Continue',
      cancelText = 'Cancel'
    } = options;

    const modal = document.getElementById('confirmation-modal');
    const modalTitle = document.getElementById('confirmation-modal-title');
    const modalMessage = document.getElementById('confirmation-modal-message');
    const continueBtn = document.getElementById('confirmation-modal-continue');
    const cancelBtn = document.getElementById('confirmation-modal-cancel');
    const settingsButton = document.getElementById('settings-btn');
    const modalContent = modal.querySelector('.modal-transition');

    if (settingsButton) {
      settingsButton.disabled = true;
    }

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    continueBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;

    modal.classList.add('open');
    if (modalContent) {
      modalContent.classList.add('open');
    }

    return new Promise(resolve => {
      const cleanup = (result) => {
        modal.classList.remove('open');
        if (modalContent) {
          modalContent.classList.remove('open');
        }
        if (settingsButton) {
          settingsButton.disabled = false;
        }
        continueBtn.removeEventListener('click', handleContinue);
        cancelBtn.removeEventListener('click', handleCancel);
        modal.removeEventListener('click', handleOverlayClick);
        resolve(result);
      };

      const handleContinue = () => cleanup(true);
      const handleCancel = () => cleanup(false);

      const handleOverlayClick = (event) => {
        if (event.target === modal) {
          handleCancel();
        }
      };

      continueBtn.addEventListener('click', handleContinue);
      cancelBtn.addEventListener('click', handleCancel);
      modal.addEventListener('click', handleOverlayClick);
    });
  }

  /**
   * Updates the breadcrumbs navigation based on the current application state.
   */
  updateBreadcrumbs() {
    const separator = `
            <span class="mx-2 pointer-events-none">
                <svg class="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
            </span>
        `;
    let html = `<span title="Myrient Downloader" class="truncate cursor-pointer hover:text-orange-500 transition-all duration-200" data-view="archives" data-step="0">Myrient Downloader</span>`;
    if (stateService.get('archive').name) {
      html += `${separator}<span title="${stateService.get('archive').name}" class="truncate cursor-pointer hover:text-orange-500 transition-all duration-200" data-view="directories" data-step="1">${stateService.get('archive').name}</span>`;
    }
    if (stateService.get('directory').name) {
      html += `${separator}<span title="${stateService.get('directory').name}" class="truncate hover:text-orange-500 transition-all duration-200">${stateService.get('directory').name}</span>`;
    }
    document.getElementById('breadcrumbs').innerHTML = html;
  }

  /**
   * Populates a given list element with items.
   * @param {string} listId The ID of the HTML element to populate.
   * @param {Array<object>} items An array of objects, each with `name` and `href` properties.
   * @param {function} clickHandler The function to call when an item is clicked.
   */
  populateList(listId, items, clickHandler) {
    const listEl = document.getElementById(listId);
    if (!listEl) return;
    listEl.innerHTML = '';
    items.forEach(item => {
      const el = document.createElement('button');
      el.className = 'list-item text-left';
      el.textContent = item.name;
      el.dataset.name = item.name;
      el.dataset.href = item.href;
      el.tabIndex = 0;
      el.addEventListener('click', () => clickHandler(item));
      listEl.appendChild(el);
    });
  }

  /**
   * Sets up the wizard view, including populating filter options and event listeners.
   */
  setupWizard() {
    document.getElementById('filter-lang-mode').value = stateService.get('langMode');
    document.getElementById('filter-revision-mode').value = stateService.get('revisionMode');
    document.getElementById('filter-dedupe-mode').value = stateService.get('dedupeMode');
    document.getElementById('filter-keep-fallbacks').checked = stateService.get('keepFallbacks');

    document.getElementById('wizard-file-count').textContent = stateService.get('allFiles').length;
    document.getElementById('wizard-tag-count').textContent = stateService.get('allTags').length;

    const langTagList = document.getElementById('wizard-tags-list');
    langTagList.innerHTML = '';
    const currentSelectedTags = stateService.get('selectedTags');
    const allTags = stateService.get('allTags').sort((a, b) => a.localeCompare(b));
    allTags.forEach(tag => {
      const el = document.createElement('label');
      el.className = 'flex items-center p-2 bg-neutral-900 rounded-md space-x-2 cursor-pointer hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-accent-500';
      el.dataset.name = tag;
      el.tabIndex = 0;
      el.innerHTML = `
      <input type="checkbox" class="h-4 w-4" ${currentSelectedTags.includes(tag) ? 'checked' : ''}>
      <span class="text-neutral-300">${tag}</span>
    `;
      langTagList.appendChild(el);
    });

    document.getElementById('priority-list').innerHTML = '';
    document.getElementById('priority-available').innerHTML = '';

    const currentPriorityList = stateService.get('priorityList');
    currentPriorityList.forEach(tag => {
      const el = document.createElement('div');
      el.className = 'list-group-item';
      el.textContent = tag;
      el.dataset.name = tag;
      document.getElementById('priority-list').appendChild(el);
    });

    this.updatePriorityBuilderAvailableTags();

    langTagList.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox') {
        const updatedSelectedTags = Array.from(document.querySelectorAll('#wizard-tags-list input[type=checkbox]:checked')).map(cb => cb.parentElement.dataset.name);
        stateService.set('selectedTags', updatedSelectedTags);
        this.updatePriorityBuilderAvailableTags();
        e.target.parentElement.focus();
      }
    });

    document.getElementById('select-all-tags-btn').addEventListener('click', () => {
      document.querySelectorAll('#wizard-tags-list label').forEach(label => {
        if (!label.classList.contains('hidden')) {
          label.querySelector('input[type=checkbox]').checked = true;
        }
      });
      const updatedSelectedTags = Array.from(document.querySelectorAll('#wizard-tags-list input[type=checkbox]:checked')).map(cb => cb.parentElement.dataset.name);
      stateService.set('selectedTags', updatedSelectedTags);
      this.updatePriorityBuilderAvailableTags();
    });

    document.getElementById('deselect-all-tags-btn').addEventListener('click', () => {
      document.querySelectorAll('#wizard-tags-list label').forEach(label => {
        if (!label.classList.contains('hidden')) {
          label.querySelector('input[type=checkbox]').checked = false;
        }
      });
      stateService.set('selectedTags', []);
      this.updatePriorityBuilderAvailableTags();
    });

    const priorityList = document.getElementById('priority-list');

    function getVisibleAvailableItems() {
      return Array.from(document.querySelectorAll('#priority-available .list-group-item'))
        .filter(el => !el.classList.contains('hidden'))
        .map(el => ({ el, text: el.textContent }));
    }

    document.getElementById('add-all-shortest').addEventListener('click', () => {
      let visibleItems = getVisibleAvailableItems();
      visibleItems.sort((a, b) => a.text.length - b.text.length);
      visibleItems.forEach(item => priorityList.appendChild(item.el));
      this.updatePriorityBuilderAvailableTags();
      this.updatePriorityPlaceholder();
      document.getElementById('search-priority-tags').focus();
    });

    document.getElementById('add-all-longest').addEventListener('click', () => {
      let visibleItems = getVisibleAvailableItems();
      visibleItems.sort((a, b) => b.text.length - a.text.length);
      visibleItems.forEach(item => priorityList.appendChild(item.el));
      this.updatePriorityBuilderAvailableTags();
      this.updatePriorityPlaceholder();
      document.getElementById('search-priority-tags').focus();
    });

    document.getElementById('reset-priorities-btn').addEventListener('click', () => {
      this.resetPriorityList();
      document.getElementById('search-priority-tags').focus();
    });

    document.getElementById('filter-lang-mode').addEventListener('change', (e) => {
      stateService.set('langMode', e.target.value);
      document.getElementById('lang-tag-ui').classList.toggle('hidden', e.target.value === 'all');
      this.updatePriorityBuilderAvailableTags();
    });
    document.getElementById('filter-revision-mode').addEventListener('change', (e) => {
      stateService.set('revisionMode', e.target.value);
    });
    document.getElementById('filter-dedupe-mode').addEventListener('change', (e) => {
      stateService.set('dedupeMode', e.target.value);
      document.getElementById('priority-builder-ui').classList.toggle('hidden', e.target.value !== 'priority');
    });

    document.getElementById('filter-lang-mode').dispatchEvent(new Event('change'));
    document.getElementById('filter-dedupe-mode').dispatchEvent(new Event('change'));

    document.getElementById('filter-keep-fallbacks').addEventListener('change', (e) => {
      stateService.set('keepFallbacks', e.target.checked);
    });
  }

  /**
   * Updates the placeholder text in the priority list based on whether tags are prioritized or not.
   */
  updatePriorityPlaceholder() {
    const priorityList = document.getElementById('priority-list');
    if (!priorityList) return;

    let noResultsEl = priorityList.querySelector('.no-results');
    const itemCount = priorityList.querySelectorAll('.list-group-item').length;

    if (itemCount === 0) {
      if (!noResultsEl) {
        noResultsEl = document.createElement('div');
        noResultsEl.className = 'no-results col-span-full text-center text-neutral-500';
        noResultsEl.textContent = 'No tags prioritised.';
        priorityList.appendChild(noResultsEl);
      }
    } else if (noResultsEl) {
      noResultsEl.remove();
    }
  }

  /**
   * Updates the list of available tags in the priority builder based on language filter mode and selected tags.
   */
  updatePriorityBuilderAvailableTags() {
    const langMode = document.getElementById('filter-lang-mode').value;
    let availableTags = [];

    if (langMode === 'include') {
      document.querySelectorAll('#wizard-tags-list input[type=checkbox]:checked').forEach(cb => {
        availableTags.push(cb.parentElement.dataset.name);
      });
    } else if (langMode === 'all') {
      availableTags = stateService.get('allTags');
    } else {
      const excludeTags = new Set();
      document.querySelectorAll('#wizard-tags-list input[type=checkbox]:checked').forEach(cb => {
        excludeTags.add(cb.parentElement.dataset.name);
      });
      availableTags = stateService.get('allTags').filter(tag => !excludeTags.has(tag));
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

    if (priorityAvailable) {
      const allSelectedTags = Array.from(document.querySelectorAll('#wizard-tags-list input[type=checkbox]:checked')).map(cb => cb.parentElement.dataset.name);
      const allSelectedTagsArePrioritised = allSelectedTags.length > 0 && allSelectedTags.every(tag => validPriorityTagsSet.has(tag));

      if (langMode === 'include' && allSelectedTagsArePrioritised) {
        priorityAvailable.dataset.noItemsText = 'All selected tags prioritised.';
      }
      else if (langMode === 'exclude' && availableTags.length === 0) {
        priorityAvailable.dataset.noItemsText = 'All tags have been selected.';
      }
      else {
        priorityAvailable.dataset.noItemsText = 'No tags have been selected.';
      }
    }

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
      el.tabIndex = 0;
      priorityAvailable.appendChild(el);
    });

    if (stateService.get('prioritySortable')) stateService.get('prioritySortable').destroy();
    if (stateService.get('availableSortable')) stateService.get('availableSortable').destroy();

    const searchInput = document.getElementById('search-priority-tags');
    if (searchInput) {
      searchInput.dispatchEvent(new Event('input'));
    }

    stateService.set('availableSortable', new Sortable(priorityAvailable, {
      group: 'shared',
      animation: 150,
      sort: false,
      onAdd: (evt) => {
        const allItems = Array.from(priorityAvailable.children);
        allItems.sort((a, b) => a.textContent.localeCompare(b.textContent));
        allItems.forEach(item => priorityAvailable.appendChild(item));
        const updatedPriorityList = Array.from(priorityList.children).map(el => el.textContent);
        stateService.set('priorityList', updatedPriorityList);
        this.updatePriorityPlaceholder();
        this.updatePriorityBuilderAvailableTags();
      },
      onUpdate: () => {
        const updatedPriorityList = Array.from(priorityList.children).map(el => el.textContent);
        stateService.set('priorityList', updatedPriorityList);
        this.updatePriorityPlaceholder();
        this.updatePriorityBuilderAvailableTags();
      },
      onEnd: () => {
        this.updatePriorityPlaceholder();
        this.updatePriorityBuilderAvailableTags();
      }
    }));

    stateService.set('prioritySortable', new Sortable(priorityList, {
      group: 'shared',
      animation: 150,
      onAdd: () => {
        const updatedPriorityList = Array.from(priorityList.children).map(el => el.textContent);
        stateService.set('priorityList', updatedPriorityList);
        this.updatePriorityPlaceholder();
        this.updatePriorityBuilderAvailableTags();
      },
      onUpdate: () => {
        const updatedPriorityList = Array.from(priorityList.children).map(el => el.textContent);
        stateService.set('priorityList', updatedPriorityList);
        this.updatePriorityPlaceholder();
        this.updatePriorityBuilderAvailableTags();
      },
      onEnd: () => {
        this.updatePriorityPlaceholder();
        this.updatePriorityBuilderAvailableTags();
      }
    }));

    this.updatePriorityPlaceholder();
  }

  /**
   * Moves a specified tag from the available tags list to the priority list.
   * @param {string} tagName The name of the tag to move.
   */
  moveTagToPriorityList(tagName) {
    const priorityList = document.getElementById('priority-list');
    const priorityAvailable = document.getElementById('priority-available');
    const itemToMove = priorityAvailable.querySelector(`[data-name="${tagName}"]`);

    if (itemToMove && priorityList) {
      priorityList.appendChild(itemToMove);
      const updatedPriorityList = Array.from(priorityList.children).map(el => el.textContent);
      stateService.set('priorityList', updatedPriorityList);
      this.updatePriorityPlaceholder();
      this.updatePriorityBuilderAvailableTags();
    }
  }

  /**
   * Resets the priority list, moving all tags back to the available tags list and clearing the state.
   */
  resetPriorityList() {
    const priorityListEl = document.getElementById('priority-list');
    const priorityAvailableEl = document.getElementById('priority-available');

    if (!priorityListEl || !priorityAvailableEl) return;

    Array.from(priorityListEl.children).forEach(item => {
      item.tabIndex = 0;
      priorityAvailableEl.appendChild(item);
    });

    stateService.set('priorityList', []);

    const allItems = Array.from(priorityAvailableEl.children);
    allItems.sort((a, b) => a.textContent.localeCompare(b.textContent));
    allItems.forEach(item => priorityAvailableEl.appendChild(item));

    this.updatePriorityBuilderAvailableTags();
    this.updatePriorityPlaceholder();
  }

  /**
   * Adds event listeners specific to the currently displayed view.
   * @param {string} viewId The ID of the current view.
   */
  addEventListeners(viewId) {
    if (viewId === 'wizard') {
      document.getElementById('wizard-run-btn').addEventListener('click', async () => {
        this.showLoading('Filtering files...');

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
          await apiService.runFilter(filters);
          this.showView('results');
          this.downloadUI.populateResults();
          const searchInput = document.getElementById('search-results');
          if (searchInput) {
            searchInput.dispatchEvent(new Event('input'));
          }
        } catch (e) {
          alert(`Error during filtering: ${e.message}`);
        } finally {
          this.hideLoading();
        }
      });
    } else if (viewId === 'results') {
      const createSubfolderCheckbox = document.getElementById('create-subfolder-checkbox');
      if (createSubfolderCheckbox) {
        createSubfolderCheckbox.checked = stateService.get('createSubfolder');
        createSubfolderCheckbox.addEventListener('change', (e) => {
          stateService.set('createSubfolder', e.target.checked);
        });
      }

      const extractArchivesCheckbox = document.getElementById('extract-archives-checkbox');
      const extractPreviouslyDownloadedCheckbox = document.getElementById('extract-previously-downloaded-checkbox');

      if (extractArchivesCheckbox && extractPreviouslyDownloadedCheckbox) {
        extractArchivesCheckbox.checked = stateService.get('extractAndDelete');
        extractPreviouslyDownloadedCheckbox.checked = stateService.get('extractPreviouslyDownloaded');
        extractPreviouslyDownloadedCheckbox.disabled = !extractArchivesCheckbox.checked;

        extractArchivesCheckbox.addEventListener('change', (e) => {
          const isChecked = e.target.checked;
          stateService.set('extractAndDelete', isChecked);
          extractPreviouslyDownloadedCheckbox.disabled = !isChecked;
          if (!isChecked) {
            extractPreviouslyDownloadedCheckbox.checked = false;
            stateService.set('extractPreviouslyDownloaded', false);
          }
        });

        extractPreviouslyDownloadedCheckbox.addEventListener('change', (e) => {
          stateService.set('extractPreviouslyDownloaded', e.target.checked);
        });
      }

      document.getElementById('download-dir-btn').addEventListener('click', async () => {
        const dir = await apiService.getDownloadDirectory();
        if (dir) {
          document.getElementById('download-dir-text').textContent = dir;
          document.getElementById('download-scan-btn').disabled = false;
        }
      });

      document.getElementById('download-scan-btn').addEventListener('click', () => this.downloadUI.startDownload());

      document.getElementById('download-cancel-btn').addEventListener('click', () => {
        if (this.downloadUI?.handleCancelClick) this.downloadUI.handleCancelClick();
        if (this.downloadUI?.apiService) this.downloadUI.apiService.cancelDownload();
      });

      document.getElementById('download-restart-btn').addEventListener('click', () => {
        stateService.set('archive', { name: '', href: '' });
        stateService.set('directory', { name: '', href: '' });
        stateService.resetWizardState();

        this.loadArchivesCallback();
      });
    }
  }

  /**
   * Sets up search and keyboard navigation event listeners for views that require them.
   * @param {string} viewId The ID of the current view.
   */
  setupSearchEventListeners(viewId) {
    const searchConfigs = {
      'archives': {
        searchId: 'search-archives',
        listId: 'list-archives',
        itemSelector: '.list-item',
        noResultsText: 'No archives found matching your search.',
        noItemsText: 'No archives available.'
      },
      'directories': {
        searchId: 'search-directories',
        listId: 'list-directories',
        itemSelector: '.list-item',
        noResultsText: 'No directories found matching your search.',
        noItemsText: 'No directories available.'
      },
      'wizard': [{
        searchId: 'search-tags',
        listId: 'wizard-tags-list',
        itemSelector: 'label',
        noResultsText: 'No tags found matching your search.',
        noItemsText: 'No tags available.'
      }, {
        searchId: 'search-priority-tags',
        listId: 'priority-available',
        itemSelector: '.list-group-item',
        noResultsText: 'No tags found matching your search.',
        noItemsText: 'No tags have been selected.'
      }],
      'results': {
        searchId: 'search-results',
        listId: 'results-list',
        itemSelector: 'label',
        noResultsText: 'No results found matching your search.',
        noItemsText: 'No results match your filters.'
      }
    };

    const configs = searchConfigs[viewId];
    if (!configs) return;

    let firstSearchInputFocused = false;

    (Array.isArray(configs) ? configs : [configs]).forEach(config => {
      new Search(config.searchId, config.listId, config.itemSelector, config.noResultsText, config.noItemsText, `${config.searchId}-clear`);

      const listContainer = document.getElementById(config.listId);
      const searchInput = document.getElementById(config.searchId);
      if (listContainer && searchInput) {
        const keyboardNavigator = new KeyboardNavigator(listContainer, config.itemSelector, searchInput, this);
        listContainer.addEventListener('keydown', keyboardNavigator.handleKeyDown.bind(keyboardNavigator));
        if (!firstSearchInputFocused) {
          searchInput.focus();
          firstSearchInputFocused = true;
        }

        searchInput.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            const visibleItems = Array.from(listContainer.querySelectorAll(`${config.itemSelector}:not(.hidden)`));
            if (visibleItems.length > 0) {
              visibleItems[0].focus();
            }
          }
        });
      }
    });
  }
}

export default UIManager;