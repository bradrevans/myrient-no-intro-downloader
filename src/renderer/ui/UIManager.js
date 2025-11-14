import stateService from '../StateService.js';
import apiService from '../ApiService.js';
import Search from './Search.js';
import KeyboardNavigator from './KeyboardNavigator.js';
import InfoIcon from './InfoIcon.js';
import tooltipContent from '../tooltipContent.js';

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
    this.searchInstances = {};
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
   * Adds an info icon next to a target element.
   * @param {string} targetElementId The ID of the element next to which the icon should be placed.
   * @param {string} tooltipKey The key for the tooltip text in tooltipContent.js.
   * @param {'after'|'append'|'prepend'} [placement='after'] Where to place the icon relative to the target element.
   */
  addInfoIconToElement(targetElementId, tooltipKey, placement = 'after') {
    const targetElement = document.getElementById(targetElementId);
    if (!targetElement) {
      console.warn(`Target element with ID '${targetElementId}' not found for info icon.`);
      return;
    }
    const text = tooltipContent[tooltipKey];
    if (!text) {
      console.warn(`Tooltip content for key '${tooltipKey}' not found.`);
      return;
    }

    const infoIcon = new InfoIcon(text);

    const isHeading = /^H[1-6]$/i.test(targetElement.tagName);

    if (isHeading) {
      targetElement.classList.add('inline-flex', 'items-center');
      targetElement.appendChild(infoIcon.element);
    } else if (placement === 'after') {
      targetElement.parentNode.insertBefore(infoIcon.element, targetElement.nextSibling);
    } else if (placement === 'append') {
      targetElement.appendChild(infoIcon.element);
    } else if (placement === 'prepend') {
      targetElement.prepend(infoIcon.element);
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
    if (cancelText === null) {
      cancelBtn.classList.add('hidden');
    } else {
      cancelBtn.textContent = cancelText;
      cancelBtn.classList.remove('hidden');
    }

    modal.classList.add('open');
    if (modalContent) {
      modalContent.classList.add('open');
    }

    setTimeout(() => {
      continueBtn.focus();
    }, 50);

    return new Promise(resolve => {
      const modalButtons = [cancelBtn, continueBtn].filter(btn => !btn.classList.contains('hidden'));
      const modalKeyboardNavigator = new KeyboardNavigator([], '', null, this, modalButtons);

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
        modal.removeEventListener('keydown', modalKeyboardNavigator.handleModalKeyDown.bind(modalKeyboardNavigator));
        resolve(result);
      };

      const handleContinue = () => cleanup(true);
      const handleCancel = () => cleanup(false);

      const handleOverlayClick = (event) => {
        if (event.target === modal) {
          cleanup(null);
        }
      };

      continueBtn.addEventListener('click', handleContinue);
      cancelBtn.addEventListener('click', handleCancel);
      modal.addEventListener('click', handleOverlayClick);
      modal.addEventListener('keydown', modalKeyboardNavigator.handleModalKeyDown.bind(modalKeyboardNavigator));
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
   * Refreshes the placeholders for all search instances in the current view.
   */
  refreshSearchPlaceholders() {
    for (const key in this.searchInstances) {
      if (Object.hasOwnProperty.call(this.searchInstances, key)) {
        this.searchInstances[key].handleSearch();
      }
    }
  }

  /**
   * Sets up the wizard view by populating all filter sections and attaching event listeners.
   */
  setupWizard() {
    const revisionToggle = document.getElementById('filter-revision-mode');
    if (!revisionToggle) { console.error('filter-revision-mode not found'); return; }
    const revisionOptions = revisionToggle.querySelectorAll('.toggle-option');
    const currentRevisionMode = stateService.get('revisionMode');

    revisionOptions.forEach(option => {
      if (option.dataset.value === currentRevisionMode) {
        option.classList.add('active');
      }
      option.addEventListener('click', () => {
        revisionOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        const newMode = option.dataset.value;
        stateService.set('revisionMode', newMode);
      });
    });

    this.addInfoIconToElement('filter-revision-mode-label', 'revisionMode');
    this.addInfoIconToElement('region-filtering-label', 'regionFiltering');
    this.addInfoIconToElement('language-filtering-label', 'languageFiltering');
    this.addInfoIconToElement('other-filtering-label', 'otherFiltering');
    this.addInfoIconToElement('region-include-label', 'includeTags');
    this.addInfoIconToElement('region-exclude-label', 'excludeTags');
    this.addInfoIconToElement('language-include-label', 'includeTags');
    this.addInfoIconToElement('language-exclude-label', 'excludeTags');
    this.addInfoIconToElement('other-include-label', 'includeTags');
    this.addInfoIconToElement('other-exclude-label', 'excludeTags');

    const allTags = stateService.get('allTags');
    const totalTagCount = Object.values(allTags).reduce((sum, tags) => sum + tags.length, 0);

    const wizardFileCount = document.getElementById('wizard-file-count');
    if (wizardFileCount) wizardFileCount.textContent = stateService.get('allFiles').length;
    const wizardTagCount = document.getElementById('wizard-tag-count');
    if (wizardTagCount) wizardTagCount.textContent = totalTagCount;

    this.populateTagCategory('region', allTags.Region || [], stateService.get('includeTags').region, stateService.get('excludeTags').region);
    this.populateTagCategory('language', allTags.Language || [], stateService.get('includeTags').language, stateService.get('excludeTags').language);
    this.populateTagCategory('other', allTags.Other || [], stateService.get('includeTags').other, stateService.get('excludeTags').other);

    const priorityListEl = document.getElementById('priority-list');
    if (priorityListEl) priorityListEl.innerHTML = '';
    const priorityAvailableEl = document.getElementById('priority-available');
    if (priorityAvailableEl) priorityAvailableEl.innerHTML = '';

    const currentPriorityList = stateService.get('priorityList');
    currentPriorityList.forEach(tag => {
      const el = document.createElement('div');
      el.className = 'list-group-item';
      el.textContent = tag;
      el.dataset.name = tag;
      if (priorityListEl) priorityListEl.appendChild(el);
    });

    this.updatePriorityBuilderAvailableTags();

    const dedupeToggle = document.getElementById('filter-dedupe-mode');
    if (!dedupeToggle) { console.error('filter-dedupe-mode not found'); return; }
    const dedupeOptions = dedupeToggle.querySelectorAll('.toggle-option');
    const currentDedupeMode = stateService.get('dedupeMode');

    dedupeOptions.forEach(option => {
      if (option.dataset.value === currentDedupeMode) {
        option.classList.add('active');
      }
      option.addEventListener('click', () => {
        dedupeOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        const newMode = option.dataset.value;
        stateService.set('dedupeMode', newMode);
        const priorityBuilderUi = document.getElementById('priority-builder-ui');
        if (priorityBuilderUi) priorityBuilderUi.classList.toggle('hidden', newMode !== 'priority');
      });
    });

    this.addInfoIconToElement('filter-dedupe-mode-label', 'dedupeMode');
    this.addInfoIconToElement('priority-list-label', 'priorityList');
    this.addInfoIconToElement('priority-available-label', 'availableTags');

    const priorityBuilderUi = document.getElementById('priority-builder-ui');
    if (priorityBuilderUi) priorityBuilderUi.classList.toggle('hidden', currentDedupeMode !== 'priority');

    this.refreshSearchPlaceholders();
  }

  /**
   * Populates the include/exclude lists for a specific tag category in the wizard.
   * @param {string} category The tag category (e.g., 'region', 'language').
   * @param {Array<string>} allCategoryTags All available tags for this category.
   * @param {Array<string>} currentIncludeTags The tags currently set to be included.
   * @param {Array<string>} currentExcludeTags The tags currently set to be excluded.
   */
  populateTagCategory(category, allCategoryTags, currentIncludeTags, currentExcludeTags) {
    const includeListEl = document.getElementById(`wizard-tags-list-${category}-include`);
    const excludeListEl = document.getElementById(`wizard-tags-list-${category}-exclude`);

    if (!includeListEl || !excludeListEl) return;

    includeListEl.innerHTML = '';
    excludeListEl.innerHTML = '';
    allCategoryTags.sort((a, b) => a.localeCompare(b));

    const renderTagItem = (tag, type) => {
      const isIncluded = currentIncludeTags.includes(tag);
      const isExcluded = currentExcludeTags.includes(tag);

      const el = document.createElement('label');
      el.className = 'flex items-center p-2 bg-neutral-900 rounded-md space-x-2 cursor-pointer border border-transparent hover:border-accent-500 hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-accent-500 select-none';
      el.dataset.name = tag;
      el.tabIndex = 0;

      let checkboxHtml = `<input type="checkbox" class="h-4 w-4" data-tag-type="${type}"`;
      if (type === 'include' && isIncluded) {
        checkboxHtml += ' checked';
      } else if (type === 'exclude' && isExcluded) {
        checkboxHtml += ' checked';
      }

      if ((type === 'include' && isExcluded) || (type === 'exclude' && isIncluded)) {
        checkboxHtml += ' disabled';
        el.classList.add('opacity-50', 'cursor-not-allowed');
        el.style.pointerEvents = 'none';
      }
      checkboxHtml += '>';
      el.innerHTML = `${checkboxHtml}<span class="text-neutral-300">${tag}</span>`;
      return el;
    };

    allCategoryTags.forEach(tag => {
      includeListEl.appendChild(renderTagItem(tag, 'include'));
      excludeListEl.appendChild(renderTagItem(tag, 'exclude'));
    });

    const handleTagClick = (e) => {
      if (e.target.type !== 'checkbox') return;

      const targetCheckbox = e.target;
      const tagName = targetCheckbox.parentElement.dataset.name;
      const tagType = targetCheckbox.dataset.tagType;
      const isChecked = targetCheckbox.checked;

      const includeTags = new Set(stateService.get('includeTags')[category]);
      const excludeTags = new Set(stateService.get('excludeTags')[category]);

      const opposingType = tagType === 'include' ? 'exclude' : 'include';
      const opposingListEl = document.getElementById(`wizard-tags-list-${category}-${opposingType}`);
      const opposingLabel = opposingListEl.querySelector(`[data-name="${tagName}"]`);
      const opposingCheckbox = opposingLabel?.querySelector('input');

      if (tagType === 'include') {
        if (isChecked) {
          includeTags.add(tagName);
          if (excludeTags.has(tagName)) {
            excludeTags.delete(tagName);
            if (opposingCheckbox) opposingCheckbox.checked = false;
          }
        } else {
          includeTags.delete(tagName);
        }
      } else {
        if (isChecked) {
          excludeTags.add(tagName);
          if (includeTags.has(tagName)) {
            includeTags.delete(tagName);
            if (opposingCheckbox) opposingCheckbox.checked = false;
          }
        } else {
          excludeTags.delete(tagName);
        }
      }

      stateService.get('includeTags')[category] = Array.from(includeTags);
      stateService.get('excludeTags')[category] = Array.from(excludeTags);

      if (opposingLabel && opposingCheckbox) {
        if (isChecked) {
          opposingCheckbox.disabled = true;
          opposingLabel.classList.add('opacity-50', 'cursor-not-allowed');
          opposingLabel.style.pointerEvents = 'none';
        } else {
          opposingCheckbox.disabled = false;
          opposingLabel.classList.remove('opacity-50', 'cursor-not-allowed');
          opposingLabel.style.pointerEvents = '';
        }
      }
      this.updatePriorityBuilderAvailableTags();
    };

    includeListEl.addEventListener('change', handleTagClick);
    excludeListEl.addEventListener('change', handleTagClick);

    const massUpdateTags = (type, shouldSelect) => {
      const listEl = document.getElementById(`wizard-tags-list-${category}-${type}`);
      const opposingType = type === 'include' ? 'exclude' : 'include';
      const opposingListEl = document.getElementById(`wizard-tags-list-${category}-${opposingType}`);

      const includeTags = new Set(stateService.get('includeTags')[category]);
      const excludeTags = new Set(stateService.get('excludeTags')[category]);

      listEl.querySelectorAll('label:not(.hidden) input[type=checkbox]').forEach(checkbox => {
        const tagName = checkbox.parentElement.dataset.name;
        const opposingLabel = opposingListEl.querySelector(`[data-name="${tagName}"]`);
        const opposingCheckbox = opposingLabel?.querySelector('input');

        if (shouldSelect) {
          if (type === 'include') {
            if (!excludeTags.has(tagName)) {
              includeTags.add(tagName);
              checkbox.checked = true;
            }
          } else {
            if (!includeTags.has(tagName)) {
              excludeTags.add(tagName);
              checkbox.checked = true;
            }
          }
        } else {
          checkbox.checked = false;
          if (type === 'include') {
            includeTags.delete(tagName);
          } else {
            excludeTags.delete(tagName);
          }
        }
        if (type === 'include' && includeTags.has(tagName) && excludeTags.has(tagName)) {
          excludeTags.delete(tagName);
          if (opposingCheckbox) opposingCheckbox.checked = false;
        } else if (type === 'exclude' && excludeTags.has(tagName) && includeTags.has(tagName)) {
          includeTags.delete(tagName);
          if (opposingCheckbox) opposingCheckbox.checked = false;
        }
      });
      listEl.querySelectorAll('label').forEach(label => {
        const tagName = label.dataset.name;
        const checkbox = label.querySelector('input');
        if ((type === 'include' && excludeTags.has(tagName)) || (type === 'exclude' && includeTags.has(tagName))) {
          checkbox.disabled = true;
          label.classList.add('opacity-50', 'cursor-not-allowed');
          label.style.pointerEvents = 'none';
        } else {
          checkbox.disabled = false;
          label.classList.remove('opacity-50', 'cursor-not-allowed');
          label.style.pointerEvents = '';
        }
      });
      opposingListEl.querySelectorAll('label').forEach(label => {
        const tagName = label.dataset.name;
        const checkbox = label.querySelector('input');
        if ((type === 'include' && includeTags.has(tagName)) || (type === 'exclude' && excludeTags.has(tagName))) {
          checkbox.disabled = true;
          label.classList.add('opacity-50', 'cursor-not-allowed');
          label.style.pointerEvents = 'none';
        } else {
          checkbox.disabled = false;
          label.classList.remove('opacity-50', 'cursor-not-allowed');
          label.style.pointerEvents = '';
        }
      });

      stateService.get('includeTags')[category] = Array.from(includeTags);
      stateService.get('excludeTags')[category] = Array.from(excludeTags);
      this.updatePriorityBuilderAvailableTags();
    };

    document.getElementById(`select-all-tags-${category}-include-btn`).addEventListener('click', () => massUpdateTags('include', true));
    document.getElementById(`deselect-all-tags-${category}-include-btn`).addEventListener('click', () => massUpdateTags('include', false));
    document.getElementById(`select-all-tags-${category}-exclude-btn`).addEventListener('click', () => massUpdateTags('exclude', true));
    document.getElementById(`deselect-all-tags-${category}-exclude-btn`).addEventListener('click', () => massUpdateTags('exclude', false));
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
   * Updates the list of available tags in the priority builder UI.
   * Available tags are derived from all tags currently in any 'include' list.
   * It also re-initializes the sortable functionality for the priority and available lists.
   */
  updatePriorityBuilderAvailableTags() {
    let availableTags = new Set();
    const includeTags = stateService.get('includeTags');

    Object.values(includeTags).forEach(tags => {
      tags.forEach(tag => availableTags.add(tag));
    });

    availableTags = Array.from(availableTags);
    availableTags.sort((a, b) => a.localeCompare(b));

    const priorityList = document.getElementById('priority-list');
    const priorityAvailable = document.getElementById('priority-available');

    const currentPriorityItems = Array.from(priorityList.children);

    const validPriorityTagsSet = new Set(
      currentPriorityItems.map(item => item.textContent)
    );

    const tagsForAvailableList = availableTags.filter(tag =>
      !validPriorityTagsSet.has(tag)
    );

    priorityList.innerHTML = '';
    priorityAvailable.innerHTML = '';

    currentPriorityItems.forEach(item => priorityList.appendChild(item));

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
        const includeTags = stateService.get('includeTags');
        const excludeTags = stateService.get('excludeTags');

        const allIncludeTags = Object.values(includeTags).flat();
        const allExcludeTags = Object.values(excludeTags).flat();

        const priorityList = Array.from(document.querySelectorAll('#priority-list .list-group-item')).map(el => el.textContent);

        const filters = {
          include_tags: allIncludeTags,
          exclude_tags: allExcludeTags,
          rev_mode: document.querySelector('#filter-revision-mode .toggle-option.active').dataset.value,
          dedupe_mode: document.querySelector('#filter-dedupe-mode .toggle-option.active').dataset.value,
          priority_list: priorityList,
        };

        try {
          this.showLoading('Filtering files...');
          await apiService.runFilter(filters);
          if (stateService.get('finalFileList').length === 0) {
            this.hideLoading();
            await this.showConfirmationModal('No files matched your filters. Please adjust your filter settings and try again.', {
              title: 'No Results',
              confirmText: 'OK',
              cancelText: null
            });
            return;
          }
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

      document.getElementById('reset-priorities-btn').addEventListener('click', () => {
        this.resetPriorityList();
      });

      const addAllPriorities = (sortFn) => {
        const availableList = document.getElementById('priority-available');
        const priorityList = document.getElementById('priority-list');
        const itemsToMove = Array.from(availableList.querySelectorAll('.list-group-item:not(.hidden)'));

        itemsToMove.sort(sortFn);
        itemsToMove.forEach(item => priorityList.appendChild(item));

        const updatedPriorityList = Array.from(priorityList.children).map(el => el.textContent);
        stateService.set('priorityList', updatedPriorityList);
        this.updatePriorityBuilderAvailableTags();
      };

      document.getElementById('add-all-shortest').addEventListener('click', () => {
        addAllPriorities((a, b) => a.textContent.length - b.textContent.length);
      });

      document.getElementById('add-all-longest').addEventListener('click', () => {
        addAllPriorities((a, b) => b.textContent.length - a.textContent.length);
      });
    } else if (viewId === 'results') {
      const createSubfolderCheckbox = document.getElementById('create-subfolder-checkbox');
      if (createSubfolderCheckbox) {
        createSubfolderCheckbox.checked = stateService.get('createSubfolder');
        createSubfolderCheckbox.addEventListener('change', (e) => {
          stateService.set('createSubfolder', e.target.checked);
        });
      }
      setTimeout(() => {
        this.addInfoIconToElement('maintain-folder-structure-label', 'maintainSiteFolderStructure');
        this.addInfoIconToElement('create-subfolder-label', 'createSubfolder');

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
            if (this.downloadUI && typeof this.downloadUI.updateScanButtonText === 'function') {
              this.downloadUI.updateScanButtonText();
            }
          });
          this.addInfoIconToElement('extract-archives-label', 'extractArchives');

          extractPreviouslyDownloadedCheckbox.addEventListener('change', (e) => {
            stateService.set('extractPreviouslyDownloaded', e.target.checked);
          });
          this.addInfoIconToElement('extract-previously-downloaded-label', 'extractPreviouslyDownloaded');
        }

        this.addInfoIconToElement('download-options-label', 'downloadOptions');

        this.addInfoIconToElement('overall-download-progress-label', 'overallDownloadProgress');
        this.addInfoIconToElement('file-download-progress-label', 'fileDownloadProgress');
        this.addInfoIconToElement('overall-extraction-progress-label', 'overallExtractionProgress');
        this.addInfoIconToElement('file-extraction-progress-label', 'fileExtractionProgress');
      }, 0);

      document.getElementById('download-dir-btn').addEventListener('click', async () => {
        const dir = await apiService.getDownloadDirectory();
        if (dir) {
          document.getElementById('download-dir-text').textContent = dir;
          stateService.set('downloadDirectory', dir);
          if (this.downloadUI && typeof this.downloadUI.updateScanButtonState === 'function') {
            this.downloadUI.updateScanButtonState();
          }
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
    this.searchInstances = {};
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
      'wizard': [
        {
          searchId: 'search-tags-region',
          includeListId: 'wizard-tags-list-region-include',
          excludeListId: 'wizard-tags-list-region-exclude',
          itemSelector: 'label',
          noResultsText: 'No region tags found matching your search.',
          noItemsText: 'No region tags available.',
          parentContainerId: 'tag-category-region-container'
        },
        {
          searchId: 'search-tags-language',
          includeListId: 'wizard-tags-list-language-include',
          excludeListId: 'wizard-tags-list-language-exclude',
          itemSelector: 'label',
          noResultsText: 'No language tags found matching your search.',
          noItemsText: 'No language tags available.',
          parentContainerId: 'tag-category-language-container'
        },
        {
          searchId: 'search-tags-other',
          includeListId: 'wizard-tags-list-other-include',
          excludeListId: 'wizard-tags-list-other-exclude',
          itemSelector: 'label',
          noResultsText: 'No other tags found matching your search.',
          noItemsText: 'No other tags available.',
          parentContainerId: 'tag-category-other-container'
        },
        {
          searchId: 'search-priority-tags',
          listId: 'priority-available',
          itemSelector: '.list-group-item',
          noResultsText: 'No tags found matching your search.',
          noItemsText: 'No tags have been selected.',
          parentContainerId: 'priority-available-container'
        }
      ],
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

    if (viewId === 'wizard') {
      const processedSearchIds = new Set();
      configs.forEach(config => {
        if (processedSearchIds.has(config.searchId)) return;
        processedSearchIds.add(config.searchId);

        const searchInput = document.getElementById(config.searchId);
        if (!searchInput) return;

        if (config.includeListId) {
          const includeListEl = document.getElementById(config.includeListId);
          if (includeListEl) {
            this.searchInstances[config.includeListId] = new Search(config.searchId, config.includeListId, config.itemSelector, config.noResultsText, config.noItemsText, `${config.searchId}-clear`);
          }
        }
        if (config.excludeListId) {
          const excludeListEl = document.getElementById(config.excludeListId);
          if (excludeListEl) {
            this.searchInstances[config.excludeListId] = new Search(config.searchId, config.excludeListId, config.itemSelector, config.noResultsText, config.noItemsText, `${config.searchId}-clear`);
          }
        }
        if (config.listId && !config.includeListId) {
          const listEl = document.getElementById(config.listId);
          if (listEl) {
            this.searchInstances[config.listId] = new Search(config.searchId, config.listId, config.itemSelector, config.noResultsText, config.noItemsText, `${config.searchId}-clear`);
          }
        }

        const parentContainer = document.getElementById(config.parentContainerId);
        if (parentContainer && searchInput) {
          const listContainers = [];
          if (config.includeListId) listContainers.push(document.getElementById(config.includeListId));
          if (config.excludeListId) listContainers.push(document.getElementById(config.excludeListId));
          if (config.listId && !config.includeListId) listContainers.push(document.getElementById(config.listId));

          const filteredListContainers = listContainers.filter(el => el !== null);

          const keyboardNavigator = new KeyboardNavigator(filteredListContainers, config.itemSelector, searchInput, this);
          parentContainer.addEventListener('keydown', keyboardNavigator.handleKeyDown.bind(keyboardNavigator));
          searchInput.addEventListener('keydown', keyboardNavigator.handleKeyDown.bind(keyboardNavigator));

          if (!firstSearchInputFocused) {
            searchInput.focus();
            firstSearchInputFocused = true;
          }
        }
      });
    } else {
      (Array.isArray(configs) ? configs : [configs]).forEach(config => {
        this.searchInstances[config.listId] = new Search(config.searchId, config.listId, config.itemSelector, config.noResultsText, config.noItemsText, `${config.searchId}-clear`);

        const listContainer = document.getElementById(config.listId);
        const searchInput = document.getElementById(config.searchId);
        if (listContainer && searchInput) {
          const keyboardNavigator = new KeyboardNavigator(listContainer, config.itemSelector, searchInput, this);
          listContainer.addEventListener('keydown', keyboardNavigator.handleKeyDown.bind(keyboardNavigator));
          searchInput.addEventListener('keydown', keyboardNavigator.handleKeyDown.bind(keyboardNavigator));
          if (!firstSearchInputFocused) {
            searchInput.focus();
            firstSearchInputFocused = true;
          }
        }
      });
    }
  }
}

export default UIManager;
