export function setupSearch(inputId, listContainerId, itemSelector) {
  document.getElementById(inputId).addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const searchTerms = query.split(' ').filter(term => term.length > 0);

    document.querySelectorAll(`#${listContainerId} ${itemSelector}`).forEach(item => {
      const name = (item.dataset.name || item.textContent).toLowerCase();
      const isMatch = searchTerms.every(term => name.includes(term));
      item.classList.toggle('js-hidden', !isMatch);
    });
  });
}

export function clearSearchAndTrigger(inputId) {
  const input = document.getElementById(inputId);
  if (input && input.value) {
    input.value = '';
    input.dispatchEvent(new Event('input'));

    const clearBtn = document.getElementById(inputId + '-clear');
    if (clearBtn) {
      clearBtn.classList.add('js-hidden');
    }
  }
}

export function setupSearchClearButton(inputId, clearId) {
  const input = document.getElementById(inputId);
  const clearBtn = document.getElementById(clearId);

  if (input && clearBtn) {
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
