import { KEYS } from '../constants.js';

/**
 * Handles keyboard navigation for a set of lists, including moving between lists and within a list.
 */
class KeyboardNavigator {
  /**
   * Creates an instance of KeyboardNavigator.
   * @param {Array<HTMLElement>|HTMLElement} listContainers A DOM element or an array of DOM elements that contain the list items.
   * @param {string} itemSelector A CSS selector to identify the navigable items within the containers.
   * @param {HTMLElement} searchInput The search input element, used for focus management.
   * @param {object} uiManager The UIManager instance for interacting with UI-related actions.
   */
  constructor(listContainers, itemSelector, searchInput, uiManager, navigableElements = []) {
    this.listContainers = Array.isArray(listContainers) ? listContainers : [listContainers];
    this.itemSelector = itemSelector;
    this.searchInput = searchInput;
    this.uiManager = uiManager;
    this.navigableElements = navigableElements; // New property for direct elements
  }

  /**
   * Gets all visible items for a specific list container.
   * @param {HTMLElement} container The list container to query.
   * @returns {Array<HTMLElement>} An array of visible items in the specified container.
   */
  getVisibleItemsInContainer(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll(`${this.itemSelector}:not(.hidden)`));
  }

  /**
   * Finds the currently focused item among all managed list containers.
   * @returns {HTMLElement|null} The currently focused item, or null if none is focused.
   */
  getFocusedItem() {
    for (const container of this.listContainers) {
      const focused = container.querySelector(`${this.itemSelector}:focus`);
      if (focused) {
        return focused;
      }
    }
    return null;
  }

  /**
   * Handles keyboard events for navigation within a modal, specifically for left/right arrow keys.
   * @param {KeyboardEvent} e The keyboard event.
   */
  handleModalKeyDown(e) {
    if (this.navigableElements.length < 2) return; // Need at least two elements to navigate between

    const activeElement = document.activeElement;
    const currentIndex = this.navigableElements.indexOf(activeElement);

    if (currentIndex === -1) return;

    if (e.key === KEYS.ARROW_LEFT) {
      e.preventDefault();
      const nextIndex = (currentIndex - 1 + this.navigableElements.length) % this.navigableElements.length;
      this.navigableElements[nextIndex].focus();
    } else if (e.key === KEYS.ARROW_RIGHT) {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % this.navigableElements.length;
      this.navigableElements[nextIndex].focus();
    }
  }

  /**
   * Handles keyboard events for navigation.
   * @param {KeyboardEvent} e The keyboard event.
   */
  handleKeyDown(e) {
    if (document.activeElement === this.searchInput && e.key === KEYS.ARROW_DOWN) {
      e.preventDefault();
      e.stopPropagation();
      const firstContainer = this.listContainers[0];
      if (firstContainer) {
        const firstItem = this.getVisibleItemsInContainer(firstContainer)[0];
        if (firstItem) {
          firstItem.focus();
        }
      }
      return;
    }

    const activeElement = document.activeElement;
    const currentContainer = this.listContainers.find(c => c.contains(activeElement));

    if (!currentContainer) {
      return;
    }

    const visibleItems = this.getVisibleItemsInContainer(currentContainer);
    if (visibleItems.length === 0) return;

    const style = window.getComputedStyle(currentContainer);
    const gridTemplateColumns = style.getPropertyValue('grid-template-columns');
    const columnCount = gridTemplateColumns.split(' ').length;

    const focusedItemIndex = visibleItems.findIndex(item => item === activeElement);

    const isWizardTagList = currentContainer.id.startsWith('wizard-tags-list-');

    const keyActions = {
      [KEYS.ENTER]: () => this.handleEnterKey(visibleItems, focusedItemIndex, currentContainer),
      [KEYS.ARROW_DOWN]: () => this.handleArrowDownKey(visibleItems, focusedItemIndex, columnCount),
      [KEYS.ARROW_UP]: () => this.handleArrowUpKey(visibleItems, focusedItemIndex, columnCount),
      [KEYS.ARROW_RIGHT]: () => {
        if (isWizardTagList) {
          this.handleHorizontalNavigation(focusedItemIndex, currentContainer, 'right');
        } else {
          this.handleArrowRightKey(visibleItems, focusedItemIndex);
        }
      },
      [KEYS.ARROW_LEFT]: () => {
        if (isWizardTagList) {
          this.handleHorizontalNavigation(focusedItemIndex, currentContainer, 'left');
        } else {
          this.handleArrowLeftKey(visibleItems, focusedItemIndex);
        }
      },
    };

    if (keyActions[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      keyActions[e.key]();
    }
  }

  /**
   * Handles horizontal navigation between related include/exclude lists in the wizard.
   * @param {number} focusedItemIndex The index of the currently focused item.
   * @param {HTMLElement} currentContainer The container where the event originated.
   * @param {'left'|'right'} direction The direction of navigation.
   */
  handleHorizontalNavigation(focusedItemIndex, currentContainer, direction) {
    if (focusedItemIndex === -1) return;

    const isIncludeList = currentContainer.id.endsWith('-include');
    const isExcludeList = currentContainer.id.endsWith('-exclude');

    if (direction === 'right' && isIncludeList) {
      const category = currentContainer.id.replace('wizard-tags-list-', '').replace('-include', '');
      const targetListId = `wizard-tags-list-${category}-exclude`;
      this.focusItemInTargetList(targetListId, focusedItemIndex);
    } else if (direction === 'left' && isExcludeList) {
      const category = currentContainer.id.replace('wizard-tags-list-', '').replace('-exclude', '');
      const targetListId = `wizard-tags-list-${category}-include`;
      this.focusItemInTargetList(targetListId, focusedItemIndex);
    } else if (direction === 'left' && isIncludeList) {
      if (this.searchInput) {
        this.searchInput.focus();
      }
    }
  }

  /**
   * Finds and focuses an item in a target list, attempting to match by name or index.
   * @param {string} targetListId The ID of the target list container.
   * @param {number} sourceIndex The index of the item in the source list.
   */
  focusItemInTargetList(targetListId, sourceIndex) {
    const targetList = this.listContainers.find(c => c.id === targetListId);
    if (!targetList) return;

    const visibleItemsInTarget = this.getVisibleItemsInContainer(targetList);
    if (visibleItemsInTarget.length === 0) return;

    const currentItem = document.activeElement;
    const currentItemName = currentItem.dataset.name;
    const correspondingItem = visibleItemsInTarget.find(item => item.dataset.name === currentItemName);

    if (correspondingItem) {
      correspondingItem.focus();
    } else {
      const targetIndex = Math.min(sourceIndex, visibleItemsInTarget.length - 1);
      visibleItemsInTarget[targetIndex].focus();
    }
  }

  /**
   * Handles the Enter key press event.
   * @param {Array<HTMLElement>} visibleItems An array of currently visible and navigable items.
   * @param {number} focusedItemIndex The index of the currently focused item.
   * @param {HTMLElement} currentContainer The container where the event originated.
   */
  handleEnterKey(visibleItems, focusedItemIndex, currentContainer) {
    if (focusedItemIndex !== -1) {
      const item = visibleItems[focusedItemIndex];
      if (currentContainer.id === 'priority-available') {
        const tagName = item.dataset.name;
        if (tagName && this.uiManager) {
          this.uiManager.moveTagToPriorityList(tagName);
          const newVisibleItems = this.getVisibleItemsInContainer(currentContainer);
          if (newVisibleItems.length > 0) {
            const nextIndex = Math.min(focusedItemIndex, newVisibleItems.length - 1);
            newVisibleItems[nextIndex].focus();
          } else {
            this.searchInput.focus();
          }
        }
      } else if (item.tagName === 'LABEL') {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox && !checkbox.disabled) {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { tagName: item.dataset.name } }));
        }
        item.focus();
      } else {
        item.click();
      }
    } else if (visibleItems.length > 0) {
      visibleItems[0].focus();
    }
  }

  /**
   * Handles the Arrow Down key press event for navigation.
   * @param {Array<HTMLElement>} visibleItems An array of currently visible and navigable items.
   * @param {number} focusedItemIndex The index of the currently focused item.
   * @param {number} columnCount The number of columns in the grid layout.
   */
  handleArrowDownKey(visibleItems, focusedItemIndex, columnCount) {
    let nextIndex;
    if (focusedItemIndex === -1) {
      nextIndex = 0;
    } else {
      nextIndex = focusedItemIndex + columnCount;
      if (nextIndex >= visibleItems.length) {
        nextIndex = (focusedItemIndex + 1) % visibleItems.length;
      }
    }
    if (visibleItems[nextIndex]) {
      visibleItems[nextIndex].focus();
    }
  }

  /**
   * Handles the Arrow Up key press event for navigation.
   * @param {Array<HTMLElement>} visibleItems An array of currently visible and navigable items.
   * @param {number} focusedItemIndex The index of the currently focused item.
   * @param {number} columnCount The number of columns in the grid layout.
   */
  handleArrowUpKey(visibleItems, focusedItemIndex, columnCount) {
    if (focusedItemIndex === -1) {
      if (this.searchInput) {
        this.searchInput.focus();
      }
      return;
    }

    let nextIndex = focusedItemIndex - columnCount;
    if (nextIndex < 0) {
      if (this.searchInput) {
        this.searchInput.focus();
        return;
      }
      nextIndex = visibleItems.length - 1;
    }

    if (visibleItems[nextIndex]) {
      visibleItems[nextIndex].focus();
    }
  }

  /**
   * Handles the Arrow Right key press event for standard list navigation.
   * @param {Array<HTMLElement>} visibleItems An array of currently visible and navigable items.
   * @param {number} focusedItemIndex The index of the currently focused item.
   */
  handleArrowRightKey(visibleItems, focusedItemIndex) {
    if (focusedItemIndex !== -1) {
      const nextIndex = Math.min(focusedItemIndex + 1, visibleItems.length - 1);
      visibleItems[nextIndex].focus();
    }
  }

  /**
   * Handles the Arrow Left key press event for standard list navigation.
   * @param {Array<HTMLElement>} visibleItems An array of currently visible and navigable items.
   * @param {number} focusedItemIndex The index of the currently focused item.
   */
  handleArrowLeftKey(visibleItems, focusedItemIndex) {
    if (focusedItemIndex !== -1) {
      const nextIndex = Math.max(focusedItemIndex - 1, 0);
      visibleItems[nextIndex].focus();
    }
  }
}

export default KeyboardNavigator;
