import { state } from './state.js';

export async function loadArchives() {
  const result = await window.electronAPI.getMainArchives();
  if (result.error) {
    throw new Error(result.error);
  }
  return result.data;
}

export async function loadDirectories() {
  const archiveUrl = new URL(state.archive.href, state.baseUrl).href;
  const result = await window.electronAPI.getDirectoryList(archiveUrl);
  if (result.error) {
    throw new Error(result.error);
  }
  return result.data;
}

export async function scrapeAndParseFiles() {
  const pageUrl = new URL(state.archive.href + state.directory.href, state.baseUrl).href;
  const result = await window.electronAPI.scrapeAndParseFiles(pageUrl);
  if (result.error) {
    throw new Error(result.error);
  }
  state.allFiles = result.files;
  state.allTags = result.tags.filter(tag => !/^(v|Rev)\s*[\d\.]+$/i.test(tag));
}

export async function runFilter(filters) {
  const result = await window.electronAPI.filterFiles(state.allFiles, state.allTags, filters);
  if (result.error) {
    throw new Error(result.error);
  }
  state.finalFileList = result.data;
}

export async function getDownloadDirectory() {
  const dir = await window.electronAPI.getDownloadDirectory();
  if (dir) {
    state.downloadDirectory = dir;
  }
  return dir;
}

export function startDownload() {
  const baseUrl = new URL(state.archive.href + state.directory.href, state.baseUrl).href;
  window.electronAPI.startDownload(baseUrl, state.finalFileList, state.downloadDirectory);
}

export function cancelDownload() {
  window.electronAPI.cancelDownload();
}

export function deleteFile(filePath) {
  return window.electronAPI.deleteFile(filePath);
}

export function openExternal(url) {
  window.electronAPI.openExternal(url);
}

export function minimizeWindow() {
  window.electronAPI.windowMinimize();
}

export function maximizeRestoreWindow() {
  window.electronAPI.windowMaximizeRestore();
}

export function closeWindow() {
  window.electronAPI.windowClose();
}