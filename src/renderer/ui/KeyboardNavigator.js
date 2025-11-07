import { KEYS } from '../constants.js';

class KeyboardNavigator {
  constructor(listContainer, itemSelector, searchInput, uiManager) {
    this.listContainer = listContainer;
    this.itemSelector = itemSelector;
    this.searchInput = searchInput;
    this.uiManager = uiManager;
  }

  handleKeyDown(e) {
    const visibleItems = Array.from(this.listContainer.querySelectorAll(`${this.itemSelector}:not(.hidden)`));
    if (visibleItems.length === 0) return;

    const style = window.getComputedStyle(this.listContainer);
    const matrix = new WebKitCSSMatrix(style.transform);
    const gridTemplateColumns = style.getPropertyValue('grid-template-columns');
    const columnCount = gridTemplateColumns.split(' ').length;

    const focusedItemIndex = visibleItems.findIndex(item => item === document.activeElement);

    const keyActions = {
      [KEYS.ENTER]: () => this.handleEnterKey(visibleItems, focusedItemIndex),
      [KEYS.ARROW_DOWN]: () => this.handleArrowDownKey(visibleItems, focusedItemIndex, columnCount),
      [KEYS.ARROW_UP]: () => this.handleArrowUpKey(visibleItems, focusedItemIndex, columnCount),
      [KEYS.ARROW_RIGHT]: () => this.handleArrowRightKey(visibleItems, focusedItemIndex),
      [KEYS.ARROW_LEFT]: () => this.handleArrowLeftKey(visibleItems, focusedItemIndex),
    };

    if (keyActions[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      keyActions[e.key]();
    }
  }

  handleEnterKey(visibleItems, focusedItemIndex) {
    if (focusedItemIndex !== -1) {
      const item = visibleItems[focusedItemIndex];
      if (this.listContainer.id === 'priority-available') {
        const tagName = item.dataset.name;
        if (tagName && this.uiManager) {
          this.uiManager.moveTagToPriorityList(tagName);
          const newVisibleItems = Array.from(this.listContainer.querySelectorAll(`${this.itemSelector}:not(.hidden)`));
          if (newVisibleItems.length > 0) {
            const nextIndex = Math.min(focusedItemIndex, newVisibleItems.length - 1);
            newVisibleItems[nextIndex].focus();
          } else {
            this.searchInput.focus();
          }
        }
      } else if (item.tagName === 'LABEL') {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
        item.focus();
      } else {
        item.click();
      }
    } else {
      visibleItems[0].focus();
    }
  }

  handleArrowDownKey(visibleItems, focusedItemIndex, columnCount) {
    let nextIndex;
    if (focusedItemIndex === -1) {
      nextIndex = 0;
    } else {
      nextIndex = focusedItemIndex + columnCount;
      if (nextIndex >= visibleItems.length) {
        if (focusedItemIndex < visibleItems.length - 1) {
          nextIndex = focusedItemIndex + 1;
        } else {
          nextIndex = 0;
        }
      }
    }
    visibleItems[nextIndex].focus();
  }

  handleArrowUpKey(visibleItems, focusedItemIndex, columnCount) {
    let nextIndex;
    if (focusedItemIndex === -1) {
      nextIndex = visibleItems.length - 1;
    } else {
      nextIndex = focusedItemIndex - columnCount;
      if (nextIndex < 0) {
        if (focusedItemIndex > 0) {
          nextIndex = focusedItemIndex - 1;
        } else {
          nextIndex = visibleItems.length - 1;
        }
        if (this.searchInput) {
          this.searchInput.focus();
          return;
        }
      }
    }
    visibleItems[nextIndex].focus();
  }

  handleArrowRightKey(visibleItems, focusedItemIndex) {
    if (focusedItemIndex !== -1) {
      const nextIndex = Math.min(focusedItemIndex + 1, visibleItems.length - 1);
      visibleItems[nextIndex].focus();
    }
  }

  handleArrowLeftKey(visibleItems, focusedItemIndex) {
    if (focusedItemIndex !== -1) {
      const nextIndex = Math.max(focusedItemIndex - 1, 0);
      visibleItems[nextIndex].focus();
    }
  }
}

export default KeyboardNavigator;
