class StateService {
    constructor() {
        this.state = {
            currentView: 'archives',
            baseUrl: null,
            archive: { name: '', href: '' },
            directory: { name: '' , href: '' },
            allFiles: [],
            allTags: [],
            finalFileList: [],
            downloadDirectory: null,
            prioritySortable: null,
            availableSortable: null,
            isDownloading: false,
            downloadStartTime: 0,
            totalBytesDownloadedThisSession: 0,
            selectedTags: [],
            priorityList: [],
            langMode: 'include',
            revisionMode: 'highest',
            dedupeMode: 'priority',
            keepFallbacks: true,
        };
    }

    async init() {
        this.state.baseUrl = await window.electronAPI.getMyrientBaseUrl();
    }

    resetWizardState() {
        this.state.selectedTags = [];
        this.state.priorityList = [];
        this.state.langMode = 'include';
        this.state.revisionMode = 'highest';
        this.state.dedupeMode = 'priority';
        this.state.keepFallbacks = true;
    }

    get(key) {
        return this.state[key];
    }

    set(key, value) {
        this.state[key] = value;
    }
}

const stateService = new StateService();
export default stateService;
