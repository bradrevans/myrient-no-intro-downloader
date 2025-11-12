class InfoIcon {
  constructor(tooltipText) {
    this.tooltipText = tooltipText;
    this.iconElement = this.createIconElement();
    this.tooltipElement = this.createTooltipElement();
    this.hideTimeout = null;
    this.isHovering = false;

    const showEvents = ['mouseenter', 'focus'];
    showEvents.forEach(event => {
      this.iconElement.addEventListener(event, this.handleEnter.bind(this));
      this.tooltipElement.addEventListener(event, this.handleEnter.bind(this));
    });

    const hideEvents = ['mouseleave', 'blur'];
    hideEvents.forEach(event => {
      this.iconElement.addEventListener(event, this.handleLeave.bind(this));
      this.tooltipElement.addEventListener(event, this.handleLeave.bind(this));
    });
  }

  createIconElement() {
    const icon = document.createElement('span');
    icon.className = 'info-icon relative inline-flex items-center justify-center w-4 h-4 rounded-full bg-accent-500 text-white text-xs font-bold cursor-help ml-2';
    icon.setAttribute('role', 'button');
    icon.setAttribute('tabindex', '0');
    icon.setAttribute('aria-label', 'Information');
    icon.textContent = 'i';
    return icon;
  }

  createTooltipElement() {
    const tooltip = document.createElement('div');
    tooltip.className = 'info-tooltip absolute z-50 px-3 py-2 text-sm font-medium text-white bg-neutral-700 rounded-lg shadow-sm opacity-0 invisible transition-opacity duration-300 max-w-sm';
    tooltip.textContent = this.tooltipText;
    return tooltip;
  }

  handleEnter() {
    clearTimeout(this.hideTimeout);
    this.isHovering = true;
    if (this.tooltipElement.parentNode !== document.body) {
      document.body.appendChild(this.tooltipElement);
    }
    this.positionTooltip();
    this.tooltipElement.classList.remove('invisible', 'opacity-0');
    this.tooltipElement.classList.add('visible', 'opacity-100');
  }

  handleLeave() {
    this.isHovering = false;
    clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => {
      if (!this.isHovering) {
        this.tooltipElement.classList.remove('visible', 'opacity-100');
        this.tooltipElement.classList.add('invisible', 'opacity-0');
      }
    }, 100);
  }

  positionTooltip() {
    const iconRect = this.iconElement.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();

    let top = iconRect.bottom + window.scrollY + 8;
    let left = iconRect.left + window.scrollX + (iconRect.width / 2) - (tooltipRect.width / 2);

    if (left + tooltipRect.width > window.innerWidth + window.scrollX - 10) {
      left = window.innerWidth + window.scrollX - tooltipRect.width - 10;
    }
    if (left < window.scrollX + 10) {
      left = window.scrollX + 10;
    }

    if (top + tooltipRect.height > window.innerHeight + window.scrollY - 10) {
      top = iconRect.top + window.scrollY - tooltipRect.height - 8;
    }

    this.tooltipElement.style.top = `${top}px`;
    this.tooltipElement.style.left = `${left}px`;
  }

  get element() {
    return this.iconElement;
  }
}

export default InfoIcon;
