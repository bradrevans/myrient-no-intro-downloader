import { state, views, headerBackButton, loadingSpinner, loadingText } from '../state.js';
import { updateBreadcrumbs } from './breadcrumbs.js';

export function showView(viewId) {
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

export function showLoading(text = 'Loading...') {
  loadingText.textContent = text;
  loadingSpinner.classList.remove('hidden');
}

export function hideLoading() {
  loadingSpinner.classList.add('hidden');
}

export function populateList(listId, items, clickHandler) {
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

export function updatePriorityBuilderAvailableTags() {
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

export function setupWizard() {
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
