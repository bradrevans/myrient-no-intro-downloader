/**
 * Manages the application's state, providing methods to get and set state properties.
 */
class StateService {
  /**
   * Creates an instance of StateService and initializes the default state.
   */
  constructor() {
    this.state = {
      currentView: 'archives',
      baseUrl: null,
      archive: { name: '', href: '' },
      directory: { name: '', href: '' },
      allFiles: [],
      allTags: [],
      finalFileList: [],
      selectedResults: [],
      downloadDirectory: null,
      prioritySortable: null,
      availableSortable: null,
      isDownloading: false,
      downloadStartTime: 0,
      totalBytesDownloadedThisSession: 0,
      includeTags: {
        region: [],
        language: [],
        other: [],
      },
      excludeTags: {
        region: [],
        language: [],
        other: [],
      },
      priorityList: [],
      revisionMode: 'highest',
      dedupeMode: 'priority',
      createSubfolder: false,
      extractAndDelete: false,
      extractPreviouslyDownloaded: false,
      wizardSkipped: false,
      isThrottlingEnabled: false,
      throttleSpeed: 100,
      throttleUnit: 'KB/s',
    };
  }

  /**
   * Initializes the state service by fetching the Myrient base URL.
   * @returns {Promise<void>}
   */
  async init() {
    this.state.baseUrl = await window.electronAPI.getMyrientBaseUrl();
  }

  /**
   * Resets the state related to the wizard filtering process.
   */
  resetWizardState() {
    this.state.selectedResults = [];
    this.state.includeTags = {
      region: [],
      language: [],
      other: [],
    };
    this.state.excludeTags = {
      region: [],
      language: [],
      other: [],
    };
    this.state.priorityList = [];
    this.state.revisionMode = 'highest';
    this.state.dedupeMode = 'priority';
  }

  /**
   * Retrieves the value of a specified state property.
   * @param {string} key The key of the state property to retrieve.
   * @returns {*} The value of the state property.
   */
  get(key) {
    return this.state[key];
  }

  /**
   * Sets the value of a specified state property.
   * @param {string} key The key of the state property to set.
   * @param {*} value The new value for the state property.
   */
  set(key, value) {
    this.state[key] = value;
  }
}

const stateService = new StateService();
export default stateService;
