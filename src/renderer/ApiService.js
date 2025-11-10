import stateService from './StateService.js';

/**
 * Provides a clean interface for the renderer process to communicate with the main process
 * via the `window.electronAPI`.
 */
class ApiService {
  /**
   * Retrieves the application version.
   * @returns {Promise<string>} A promise that resolves with the application version string.
   */
  async getAppVersion() {
    return await window.electronAPI.getAppVersion();
  }

  /**
   * Checks for application updates.
   * @returns {Promise<void>} A promise that resolves when the update check is complete.
   */
  async checkForUpdates() {
    return await window.electronAPI.checkForUpdates();
  }

  /**
   * Loads the main archives from the Myrient service.
   * @returns {Promise<Array<object>>} A promise that resolves with an array of archive objects.
   * @throws {Error} If there is an error fetching the archives.
   */
  async loadArchives() {
    const result = await window.electronAPI.getMainArchives();
    if (result.error) {
      throw new Error(result.error);
    }
    return result.data;
  }

  /**
   * Loads the directory list for the currently selected archive.
   * @returns {Promise<Array<object>>} A promise that resolves with an array of directory objects.
   * @throws {Error} If there is an error fetching the directory list.
   */
  async loadDirectories() {
    const archiveUrl = new URL(stateService.get('archive').href, stateService.get('baseUrl')).href;
    const result = await window.electronAPI.getDirectoryList(archiveUrl);
    if (result.error) {
      throw new Error(result.error);
    }
    return result.data;
  }

  /**
   * Scrapes and parses files from the currently selected directory.
   * Updates the state service with the `allFiles` and `allTags`.
   * @returns {Promise<void>}
   * @throws {Error} If there is an error scraping or parsing files.
   */
  async scrapeAndParseFiles() {
    const pageUrl = new URL(stateService.get('archive').href + stateService.get('directory').href, stateService.get('baseUrl')).href;
    const result = await window.electronAPI.scrapeAndParseFiles(pageUrl);
    if (result.error) {
      throw new Error(result.error);
    }
    stateService.set('allFiles', result.files);
    stateService.set('allTags', result.tags);
  }

  /**
   * Runs the file filtering process with the given filters.
   * Updates the state service with the `finalFileList`.
   * @param {object} filters The filter criteria to apply.
   * @returns {Promise<void>}
   * @throws {Error} If there is an error during filtering.
   */
  async runFilter(filters) {
    const result = await window.electronAPI.filterFiles(stateService.get('allFiles'), stateService.get('allTags'), filters);
    if (result.error) {
      throw new Error(result.error);
    }
    stateService.set('finalFileList', result.data);
  }

  /**
   * Prompts the user to select a download directory and updates the state service.
   * @returns {Promise<string|null>} A promise that resolves with the selected directory path, or null if canceled.
   */
  async getDownloadDirectory() {
    const dir = await window.electronAPI.getDownloadDirectory();
    if (dir) {
      stateService.set('downloadDirectory', dir);
    }
    return dir;
  }

  /**
   * Checks the structure of the specified download directory.
   * @param {string} downloadPath The path to the download directory.
   * @returns {Promise<string>} A promise that resolves with the detected directory structure.
   * @throws {Error} If there is an error checking the directory structure.
   */
  async checkDownloadDirectoryStructure(downloadPath) {
    const result = await window.electronAPI.checkDownloadDirectoryStructure(downloadPath);
    if (result.error) {
      throw new Error(result.error);
    }
    return result.data;
  }

  /**
   * Retrieves the DownloadDirectoryStructure enum from the main process.
   * @returns {Promise<object>} A promise that resolves with the DownloadDirectoryStructure enum.
   * @throws {Error} If there is an error retrieving the enum.
   */
  async getDownloadDirectoryStructureEnum() {
    const result = await window.electronAPI.getDownloadDirectoryStructureEnum();
    if (result.error) {
      throw new Error(result.error);
    }
    return result.data;
  }

  /**
   * Initiates the download process for the selected files.
   * @param {Array<object>} files An array of file objects to download.
   */
  startDownload(files) {
    const baseUrl = new URL(stateService.get('archive').href + stateService.get('directory').href, stateService.get('baseUrl')).href;
    const createSubfolder = stateService.get('createSubfolder');
    const extractAndDelete = stateService.get('extractAndDelete');
    const extractPreviouslyDownloaded = stateService.get('extractPreviouslyDownloaded');
    window.electronAPI.startDownload(baseUrl, files, stateService.get('downloadDirectory'), createSubfolder, extractAndDelete, extractPreviouslyDownloaded);
  }

  /**
   * Sends a request to the main process to cancel the current download.
   */
  cancelDownload() {
    window.electronAPI.cancelDownload();
  }

  /**
   * Sends a request to the main process to delete a file.
   * @param {string} filePath The path of the file to delete.
   * @returns {Promise<object>} A promise that resolves with the result of the delete operation.
   */
  deleteFile(filePath) {
    return window.electronAPI.deleteFile(filePath);
  }

  /**
   * Opens a URL in the user's default external browser.
   * @param {string} url The URL to open.
   */
  openExternal(url) {
    window.electronAPI.openExternal(url);
  }

  /**
   * Minimizes the application window.
   */
  minimizeWindow() {
    window.electronAPI.windowMinimize();
  }

  /**
   * Maximizes or restores the application window.
   */
  maximizeRestoreWindow() {
    window.electronAPI.windowMaximizeRestore();
  }

  /**
   * Closes the application window.
   */
  closeWindow() {
    window.electronAPI.windowClose();
  }


  /**
   * Resets the zoom factor of the web contents to default.
   */
  zoomReset() {
    window.electronAPI.zoomReset();
  }

  /**
   * Retrieves the current zoom factor of the web contents.
   * @returns {Promise<number>} A promise that resolves with the current zoom factor.
   */
  async getZoomFactor() {
    return await window.electronAPI.getZoomFactor();
  }

  /**
   * Sets the zoom factor of the web contents.
   * @param {number} factor The zoom factor to set.
   */
  setZoomFactor(factor) {
    window.electronAPI.setZoomFactor(factor);
  }
}

const apiService = new ApiService();
export default apiService;
