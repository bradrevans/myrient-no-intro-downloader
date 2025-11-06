export function setupSearch(inputId, listContainerId, itemSelector, noResultsText, noItemsText) {
  const listContainer = document.getElementById(listContainerId);
  const searchInput = document.getElementById(inputId);

  const handleSearch = () => {
    const allItems = listContainer.querySelectorAll(itemSelector);
    const query = searchInput.value.toLowerCase();
    const searchTerms = query.split(' ').filter(term => term.length > 0);
    let visibleCount = 0;

    allItems.forEach(item => {
      const name = (item.dataset.name || item.textContent).toLowerCase();
      const isMatch = searchTerms.every(term => name.includes(term));
      item.classList.toggle('js-hidden', !isMatch);
      if (isMatch) {
        visibleCount++;
      }
    });

    let noResultsEl = listContainer.querySelector('.no-results');
    if (noResultsEl) {
      noResultsEl.remove();
    }

    let message = '';
    if (allItems.length === 0) {
      message = (listContainer && listContainer.dataset.noItemsText) || noItemsText;
    } else if (visibleCount === 0 && query.length > 0) {
      message = noResultsText;
    }

    if (message) {
      noResultsEl = document.createElement('div');
      noResultsEl.className = 'no-results col-span-full text-center text-neutral-500';
      noResultsEl.textContent = message;
      listContainer.appendChild(noResultsEl);
    }
  };

  searchInput.addEventListener('input', handleSearch);
  handleSearch();
}

export function setupSearchClearButton(inputId, clearId) {
  const input = document.getElementById(inputId);
  const clearBtn = document.getElementById(clearId);

  if (input && clearBtn) {
    clearBtn.classList.toggle('js-hidden', input.value.length === 0);

    input.addEventListener('input', () => {
      clearBtn.classList.toggle('js-hidden', input.value.length === 0);
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.classList.add('js-hidden');
      input.dispatchEvent(new Event('input'));
      input.focus();
    });
  }
}
