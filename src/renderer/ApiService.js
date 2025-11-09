import stateService from './StateService.js';

class ApiService {
  async getAppVersion() {
    return await window.electronAPI.getAppVersion();
  }

  async checkForUpdates() {
    return await window.electronAPI.checkForUpdates();
  }

  async loadArchives() {
    const result = await window.electronAPI.getMainArchives();
    if (result.error) {
      throw new Error(result.error);
    }
    return result.data;
  }

  async loadDirectories() {
    const archiveUrl = new URL(stateService.get('archive').href, stateService.get('baseUrl')).href;
    const result = await window.electronAPI.getDirectoryList(archiveUrl);
    if (result.error) {
      throw new Error(result.error);
    }
    return result.data;
  }

  async scrapeAndParseFiles() {
    const pageUrl = new URL(stateService.get('archive').href + stateService.get('directory').href, stateService.get('baseUrl')).href;
    const result = await window.electronAPI.scrapeAndParseFiles(pageUrl);
    if (result.error) {
      throw new Error(result.error);
    }
    stateService.set('allFiles', result.files);
    stateService.set('allTags', result.tags.filter(tag => !/^(v|Rev)\s*[\d\.]+$/i.test(tag)));
  }

  async runFilter(filters) {
    const result = await window.electronAPI.filterFiles(stateService.get('allFiles'), stateService.get('allTags'), filters);
    if (result.error) {
      throw new Error(result.error);
    }
    stateService.set('finalFileList', result.data);
  }

  async getDownloadDirectory() {
    const dir = await window.electronAPI.getDownloadDirectory();
    if (dir) {
      stateService.set('downloadDirectory', dir);
    }
    return dir;
  }

  async checkDownloadDirectoryStructure(downloadPath) {
    const result = await window.electronAPI.checkDownloadDirectoryStructure(downloadPath);
    if (result.error) {
      throw new Error(result.error);
    }
    return result.data;
  }

  async getDownloadDirectoryStructureEnum() {
    const result = await window.electronAPI.getDownloadDirectoryStructureEnum();
    if (result.error) {
      throw new Error(result.error);
    }
    return result.data;
  }

  startDownload(files) {
    const baseUrl = new URL(stateService.get('archive').href + stateService.get('directory').href, stateService.get('baseUrl')).href;
    const createSubfolder = stateService.get('createSubfolder');
    const extractAndDelete = stateService.get('extractAndDelete');
    const extractPreviouslyDownloaded = stateService.get('extractPreviouslyDownloaded');
    window.electronAPI.startDownload(baseUrl, files, stateService.get('downloadDirectory'), createSubfolder, extractAndDelete, extractPreviouslyDownloaded);
  }

  cancelDownload() {
    window.electronAPI.cancelDownload();
  }

  deleteFile(filePath) {
    return window.electronAPI.deleteFile(filePath);
  }

  openExternal(url) {
    window.electronAPI.openExternal(url);
  }

  minimizeWindow() {
    window.electronAPI.windowMinimize();
  }

  maximizeRestoreWindow() {
    window.electronAPI.windowMaximizeRestore();
  }

  closeWindow() {
    window.electronAPI.windowClose();
  }


  zoomReset() {
    window.electronAPI.zoomReset();
  }

  async getZoomFactor() {
    return await window.electronAPI.getZoomFactor();
  }

  setZoomFactor(factor) {
    window.electronAPI.setZoomFactor(factor);
  }
}

const apiService = new ApiService();
export default apiService;
