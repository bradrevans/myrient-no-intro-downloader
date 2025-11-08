export default class Search {
  constructor(inputId, listContainerId, itemSelector, noResultsText, noItemsText, clearId) {
    this.searchInput = document.getElementById(inputId);
    this.listContainer = document.getElementById(listContainerId);
    this.itemSelector = itemSelector;
    this.noResultsText = noResultsText;
    this.noItemsText = noItemsText;
    this.clearBtn = document.getElementById(clearId);

    if (this.searchInput && this.listContainer) {
      this.searchInput.addEventListener('input', this.handleSearch.bind(this));
      this.handleSearch();
    }

    if (this.searchInput && this.clearBtn) {
      this.clearBtn.classList.toggle('hidden', this.searchInput.value.length === 0);
      this.searchInput.addEventListener('input', () => {
        this.clearBtn.classList.toggle('hidden', this.searchInput.value.length === 0);
      });

      this.clearBtn.addEventListener('click', () => {
        this.searchInput.value = '';
        this.clearBtn.classList.add('hidden');
        this.searchInput.dispatchEvent(new Event('input'));
        this.searchInput.focus();
      });
    }
  }

  handleSearch() {
    const allItems = this.listContainer.querySelectorAll(this.itemSelector);
    const query = this.searchInput.value.toLowerCase();
    const searchTerms = query.split(' ').filter(term => term.length > 0);
    let visibleCount = 0;

    allItems.forEach(item => {
      const name = (item.dataset.name || item.textContent).toLowerCase();
      const isMatch = searchTerms.every(term => name.includes(term));
      item.classList.toggle('hidden', !isMatch);
      if (isMatch) {
        visibleCount++;
      }
    });

    let noResultsEl = this.listContainer.querySelector('.no-results');
    if (noResultsEl) {
      noResultsEl.remove();
    }

    let message = '';
    if (allItems.length === 0) {
      message = (this.listContainer && this.listContainer.dataset.noItemsText) || this.noItemsText;
    } else if (visibleCount === 0 && query.length > 0) {
      message = this.noResultsText;
    }

    if (message) {
      noResultsEl = document.createElement('div');
      noResultsEl.className = 'no-results col-span-full text-center text-neutral-500';
      noResultsEl.textContent = message;
      this.listContainer.appendChild(noResultsEl);
    }
  }
}
