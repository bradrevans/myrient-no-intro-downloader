import stateService from '../StateService.js';
import apiService from '../ApiService.js';
import { populateResults, startDownload, logDownload } from './download-ui.js';
import { setupSearch, setupSearchClearButton } from './search.js';

class UIManager {
    constructor(viewContainer, loadArchivesCallback) {
        this.viewContainer = viewContainer;
        this.views = {};
        this.currentView = null;
        this.loadArchivesCallback = loadArchivesCallback;
    }

    async loadViews() {
        const viewFiles = ['archives', 'directories', 'wizard', 'results'];
        for (const view of viewFiles) {
            const response = await fetch(`./views/${view}.html`);
            this.views[view] = await response.text();
        }
    }

    showView(viewId) {
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
        }
    }

    showLoading(text = 'Loading...') {
        document.getElementById('loading-text').textContent = text;
        document.getElementById('loading-spinner').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading-spinner').classList.add('hidden');
    }

    updateBreadcrumbs() {
        let html = `<span class="cursor-pointer hover:text-orange-500 transition-all duration-200" data-view="archives" data-step="0">Myrient Downloader</span>`;
        if (stateService.get('archive').name) {
            html += ` <span class="mx-2">&gt;</span> <span class="cursor-pointer hover:text-orange-500 transition-all duration-200" data-view="directories" data-step="1">${stateService.get('archive').name}</span>`;
        }
        if (stateService.get('directory').name) {
            html += ` <span class="mx-2">&gt;</span> <span class="hover:text-orange-500 transition-all duration-200">${stateService.get('directory').name}</span>`;
        }
        document.getElementById('breadcrumbs').innerHTML = html;
    }

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
            el.addEventListener('click', () => clickHandler(item));
            listEl.appendChild(el);
        });
    }

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
        stateService.get('allTags').forEach(tag => {
            const el = document.createElement('label');
            el.className = 'flex items-center p-2 bg-neutral-900 rounded-md space-x-2 cursor-pointer hover:bg-neutral-700';
            el.dataset.name = tag;
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

        langTagList.addEventListener('click', (e) => {
            if (e.target.type === 'checkbox') {
                const updatedSelectedTags = Array.from(document.querySelectorAll('#wizard-tags-list input[type=checkbox]:checked')).map(cb => cb.parentElement.dataset.name);
                stateService.set('selectedTags', updatedSelectedTags);
                this.updatePriorityBuilderAvailableTags();
            }
        });

        document.getElementById('select-all-tags-btn').addEventListener('click', () => {
            document.querySelectorAll('#wizard-tags-list label').forEach(label => {
                if (!label.classList.contains('js-hidden')) {
                    label.querySelector('input[type=checkbox]').checked = true;
                }
            });
            const updatedSelectedTags = Array.from(document.querySelectorAll('#wizard-tags-list input[type=checkbox]:checked')).map(cb => cb.parentElement.dataset.name);
            stateService.set('selectedTags', updatedSelectedTags);
            this.updatePriorityBuilderAvailableTags();
        });

        document.getElementById('deselect-all-tags-btn').addEventListener('click', () => {
            document.querySelectorAll('#wizard-tags-list label').forEach(label => {
                if (!label.classList.contains('js-hidden')) {
                    label.querySelector('input[type=checkbox]').checked = false;
                }
            });
            stateService.set('selectedTags', []);
            this.updatePriorityBuilderAvailableTags();
        });

        const priorityList = document.getElementById('priority-list');

        function getVisibleAvailableItems() {
            return Array.from(document.querySelectorAll('#priority-available .list-group-item'))
                .filter(el => !el.classList.contains('js-hidden'))
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
            stateService.set('langMode', e.target.value);
            document.getElementById('lang-tag-ui').classList.toggle('js-hidden', e.target.value === 'all');
            this.updatePriorityBuilderAvailableTags();
        });
        document.getElementById('filter-revision-mode').addEventListener('change', (e) => {
            stateService.set('revisionMode', e.target.value);
        });
        document.getElementById('filter-dedupe-mode').addEventListener('change', (e) => {
            stateService.set('dedupeMode', e.target.value);
            document.getElementById('priority-builder-ui').classList.toggle('js-hidden', e.target.value !== 'priority');
        });

        document.getElementById('filter-lang-mode').dispatchEvent(new Event('change'));
        document.getElementById('filter-dedupe-mode').dispatchEvent(new Event('change'));

        document.getElementById('filter-keep-fallbacks').addEventListener('change', (e) => {
            stateService.set('keepFallbacks', e.target.checked);
        });
    }

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

        if (stateService.get('prioritySortable')) stateService.get('prioritySortable').destroy();
        if (stateService.get('availableSortable')) stateService.get('availableSortable').destroy();

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
            },
            onUpdate: () => {
                const updatedPriorityList = Array.from(priorityList.children).map(el => el.textContent);
                stateService.set('priorityList', updatedPriorityList);
            }
        }));

        stateService.set('prioritySortable', new Sortable(priorityList, {
            group: 'shared',
            animation: 150,
            onAdd: () => {
                const updatedPriorityList = Array.from(priorityList.children).map(el => el.textContent);
                stateService.set('priorityList', updatedPriorityList);
            },
            onUpdate: () => {
                const updatedPriorityList = Array.from(priorityList.children).map(el => el.textContent);
                stateService.set('priorityList', updatedPriorityList);
            }
        }));
    }

    addEventListeners(viewId) {
        if (viewId === 'archives') {
            setupSearch('search-archives', 'list-archives', '.list-item');
            setupSearchClearButton('search-archives', 'search-archives-clear');
        } else if (viewId === 'directories') {
            setupSearch('search-directories', 'list-directories', '.list-item');
            setupSearchClearButton('search-directories', 'search-directories-clear');
        } else if (viewId === 'wizard') {
            setupSearch('search-tags', 'wizard-tags-list', 'label');
            setupSearchClearButton('search-tags', 'search-tags-clear');
            setupSearch('search-priority-tags', 'priority-available', '.list-group-item');
            setupSearchClearButton('search-priority-tags', 'search-priority-tags-clear');

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
                    populateResults();
                } catch (e) {
                    alert(`Error during filtering: ${e.message}`);
                } finally {
                    this.hideLoading();
                }
            });
        } else if (viewId === 'results') {
            setupSearch('search-results', 'results-list', '.p-1.text-sm.truncate');
            setupSearchClearButton('search-results', 'search-results-clear');

            document.getElementById('download-dir-btn').addEventListener('click', async () => {
                const dir = await apiService.getDownloadDirectory();
                if (dir) {
                    document.getElementById('download-dir-text').textContent = dir;
                    document.getElementById('download-scan-btn').disabled = false;
                }
            });

            document.getElementById('download-scan-btn').addEventListener('click', () => startDownload());

            document.getElementById('download-cancel-btn').addEventListener('click', () => {
                logDownload('Cancelling download, please wait...');
                document.getElementById('download-cancel-btn').disabled = true;
                apiService.cancelDownload();
            });

            document.getElementById('download-restart-btn').addEventListener('click', () => {
                stateService.set('archive', { name: '', href: '' });
                stateService.set('directory', { name: '', href: '' });
                stateService.resetWizardState();

                this.loadArchivesCallback();
            });
        }
    }
}

export default UIManager;