const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { URL } = require('url');
const axios = require('axios');
const cheerio = require('cheerio');
const log = require('electron-log');

log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs/main.log');
log.info('App starting...');

let win;
let downloadCancelled = false;
let skippedFiles = [];

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

const httpAgent = new https.Agent({ keepAlive: true });
const scrapeClient = axios.create({
  httpsAgent: httpAgent,
  timeout: 15000,
});

async function getPage(url) {
  try {
    const response = await scrapeClient.get(url);
    return response.data;
  } catch (err) {
    log.error(`Failed to fetch ${url}: ${err.message}`);
    throw new Error(`Failed to fetch directory. Please check your connection and try again.`);
  }
}

function parseLinks(html, baseUrl) {
  const $ = cheerio.load(html);
  const links = [];
  $('a').each((i, el) => {
    const href = $(el).attr('href');
    if (href &&
      !href.startsWith('?') &&
      !href.startsWith('http') &&
      !href.startsWith('/') &&
      !href.includes('..') &&
      href !== './') {
      links.push({
        name: decodeURIComponent(href.replace(/\/$/, '')),
        href: href,
        isDir: href.endsWith('/')
      });
    }
  });
  return links;
}

async function getMainArchives(url) {
  const html = await getPage(url);
  const links = parseLinks(html, url);
  return links.filter(link => link.isDir);
}

async function getDirectoryList(url) {
  const html = await getPage(url);
  const links = parseLinks(html, url).filter(link => link.isDir);

  const dataList = links.sort((a, b) => a.name.localeCompare(b.name));
  return { data: dataList };
}


function parseFilename(filename) {
  const nameNoExt = path.parse(filename).name;
  const baseNameMatch = nameNoExt.split(/\s*\(/, 1);
  const baseName = baseNameMatch[0].trim();

  const tags = new Set();
  const tagRegex = /\((.*?)\)/g;
  let match;
  while ((match = tagRegex.exec(nameNoExt)) !== null) {
    tags.add(match[1].trim());
  }

  let revision = 0.0;
  const revMatch = nameNoExt.match(/\((?:v|Rev)\s*([\d\.]+)\)/i);
  if (revMatch && revMatch[1]) {
    try {
      revision = parseFloat(revMatch[1]);
    } catch (e) {
      revision = 0.0;
    }
  }

  return {
    name_raw: filename,
    base_name: baseName,
    tags: Array.from(tags),
    revision: revision
  };
}

async function scrapeAndParseFiles(url) {
  const html = await getPage(url);
  const links = parseLinks(html, url).filter(link => !link.isDir);

  const allFiles = [];
  const allTags = new Set();

  for (const link of links) {
    const parsedInfo = parseFilename(link.name);
    parsedInfo.href = link.href;
    allFiles.push(parsedInfo);
    parsedInfo.tags.forEach(tag => allTags.add(tag));
  }

  if (allFiles.length === 0) {
    throw new Error("No valid files found in this directory.");
  }

  return { files: allFiles, tags: Array.from(allTags).sort() };
}

function applyLanguageFilter(fileList, allTags, filters) {
  const mode = filters.lang_mode || 'all';
  if (mode === 'all') return [fileList, allTags];

  if (mode === 'include') {
    const includeTags = new Set(filters.lang_tags || []);
    if (includeTags.size === 0) return [fileList, allTags];

    const filteredList = fileList.filter(file =>
      file.tags.some(tag => includeTags.has(tag))
    );
    return [filteredList, Array.from(includeTags)];
  }

  if (mode === 'exclude') {
    const excludeTags = new Set(filters.lang_tags || []);
    if (excludeTags.size === 0) return [fileList, allTags];

    const filteredList = fileList.filter(file =>
      !file.tags.some(tag => excludeTags.has(tag))
    );
    return [filteredList, allTags];
  }
  return [fileList, allTags];
}

function applyRevisionFilter(fileList, filters) {
  const mode = filters.rev_mode || 'all';
  if (mode === 'all') return fileList;

  if (mode === 'highest') {
    const groupedGames = new Map();
    for (const fileInfo of fileList) {
      if (!groupedGames.has(fileInfo.base_name)) {
        groupedGames.set(fileInfo.base_name, []);
      }
      groupedGames.get(fileInfo.base_name).push(fileInfo);
    }

    const finalList = [];
    for (const [baseName, filesForGame] of groupedGames.entries()) {
      if (filesForGame.length === 0) continue;

      const maxRevision = Math.max(...filesForGame.map(f => f.revision));

      for (const f of filesForGame) {
        if (f.revision === maxRevision) {
          finalList.push(f);
        }
      }
    }
    return finalList;
  }
  return fileList;
}

function applyDedupeFilter(fileList, filters) {
  const mode = filters.dedupe_mode || 'all';
  if (mode === 'all') return fileList;

  if (mode === 'simple') {
    const seenBaseNames = new Set();
    const deduplicatedList = [];
    for (const fileInfo of fileList) {
      if (!seenBaseNames.has(fileInfo.base_name)) {
        deduplicatedList.push(fileInfo);
        seenBaseNames.add(fileInfo.base_name);
      }
    }
    return deduplicatedList;
  }

  if (mode === 'priority') {
    const priorityList = filters.priority_list || [];
    const keepFallbacks = filters.keep_fallbacks;

    const maxScore = priorityList.length;
    const priorityMap = new Map(priorityList.map((tag, i) => [tag, maxScore - i]));

    const groupedGames = new Map();
    for (const fileInfo of fileList) {
      if (!groupedGames.has(fileInfo.base_name)) {
        groupedGames.set(fileInfo.base_name, []);
      }
      groupedGames.get(fileInfo.base_name).push(fileInfo);
    }

    const finalList = [];
    for (const [baseName, gameVersions] of groupedGames.entries()) {
      let bestFile = null;
      let bestScore = -1;

      for (const fileInfo of gameVersions) {
        let currentScore = 0;
        for (const tag of fileInfo.tags) {
          currentScore += (priorityMap.get(tag) || 0);
        }

        if (currentScore > bestScore) {
          bestScore = currentScore;
          bestFile = fileInfo;
        }
      }

      if (bestScore > 0) {
        finalList.push(bestFile);
      } else if (keepFallbacks && bestFile) {
        finalList.push(bestFile);
      }
    }
    return finalList;
  }
  return fileList;
}

async function getDownloadInfo(baseUrl, files, targetDir) {
  let totalSize = 0;
  let skippedSize = 0;
  const filesToDownload = [];
  const session = axios.create({
    httpsAgent: httpAgent,
    timeout: 15000,
    headers: {
      'User-Agent': 'Wget/1.21.3 (linux-gnu)'
    }
  });

  for (let i = 0; i < files.length; i++) {
    if (downloadCancelled) throw new Error("CANCELLED_SCAN");

    const fileInfo = files[i];
    const filename = fileInfo.name_raw;
    const targetPath = path.join(targetDir, filename);
    const fileUrl = new URL(fileInfo.href, baseUrl).href;

    try {
      const response = await session.head(fileUrl, { timeout: 15000 });
      const remoteSize = parseInt(response.headers['content-length'] || '0', 10);

      fileInfo.size = remoteSize;
      totalSize += remoteSize;

      if (fs.existsSync(targetPath)) {
        const localSize = fs.statSync(targetPath).size;
        if (remoteSize > 0 && localSize === remoteSize) {
          fileInfo.skip = true;
          skippedSize += remoteSize;
        } else {
          fileInfo.skip = false;
          filesToDownload.push(fileInfo);
        }
      } else {
        fileInfo.skip = false;
        filesToDownload.push(fileInfo);
      }
    } catch (e) {
      const skipMsg = `SKIP: Could not get info for ${filename}. Error: ${e.message}`;
      log.warn(skipMsg);
      win.webContents.send('download-log', skipMsg);
      skippedFiles.push(`${filename} (Scan failed)`);
      fileInfo.skip = true;
    }
    win.webContents.send('download-scan-progress', { current: i + 1, total: files.length });
  }

  return { filesToDownload, totalSize, skippedSize };
}

async function downloadFiles(baseUrl, files, targetDir, totalSize, initialDownloadedSize = 0) {
  const session = axios.create({
    httpsAgent: httpAgent,
    timeout: 15000,
    headers: {
      'User-Agent': 'Wget/1.21.3 (linux-gnu)'
    }
  });

  let totalDownloaded = initialDownloadedSize;
  let currentFileError = null;

  for (const fileInfo of files) {
    if (downloadCancelled) {
      throw new Error("CANCELLED_BETWEEN_FILES");
    }

    if (fileInfo.skip) continue;

    const filename = fileInfo.name_raw;
    const targetPath = path.join(targetDir, filename);
    const fileUrl = new URL(fileInfo.href, baseUrl).href;
    const fileSize = fileInfo.size || 0;
    let fileDownloaded = 0;

    try {
      const response = await session.get(fileUrl, {
        responseType: 'stream',
        timeout: 30000
      });

      const writer = fs.createWriteStream(targetPath, {
        highWaterMark: 1024 * 1024
      });

      response.data.on('data', (chunk) => {
        if (downloadCancelled) {
          response.request.abort();
          writer.close();
          const err = new Error("CANCELLED_MID_FILE");
          err.partialFile = { path: targetPath, name: filename };
          currentFileError = err;
          return;
        }
        fileDownloaded += chunk.length;
        totalDownloaded += chunk.length;
        win.webContents.send('download-file-progress', {
          name: filename,
          current: fileDownloaded,
          total: fileSize
        });
        win.webContents.send('download-overall-progress', {
          current: totalDownloaded,
          total: totalSize,
          skippedSize: initialDownloadedSize
        });
      });

      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', () => {
          if (currentFileError) reject(currentFileError);
          else resolve();
        });
        writer.on('error', (err) => {
          log.error(`File write error for ${filename}: ${err.message}`);
          reject(err);
        });
        response.data.on('error', (err) => {
          log.error(`Download stream error for ${filename}: ${err.message}`);
          reject(err);
        });
      });

    } catch (e) {
      if (e.message.startsWith("CANCELLED_")) throw e;

      const errorMsg = `ERROR: Failed to download ${filename}. ${e.message}`;
      log.error(errorMsg);
      win.webContents.send('download-log', errorMsg);
      skippedFiles.push(`${filename} (Download failed)`);

      try {
        if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      } catch (fsErr) {
        log.error(`Failed to delete partial file ${targetPath}: ${fsErr.message}`);
      }
    }
  }

  return "Download complete!";
}

function setupIpcHandlers() {
  ipcMain.handle('get-main-archives', async () => {
    try {
      const data = await getMainArchives("https://myrient.erista.me/files/");
      return { data };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('get-directory-list', async (event, archiveUrl) => {
    try {
      const data = await getDirectoryList(archiveUrl);
      return data;
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('scrape-and-parse-files', async (event, pageUrl) => {
    try {
      const data = await scrapeAndParseFiles(pageUrl);
      return data;
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('filter-files', (event, allFiles, allTags, filters) => {
    try {
      const [listAfterLang,] = applyLanguageFilter(allFiles, allTags, filters);
      const listAfterRev = applyRevisionFilter(listAfterLang, filters);
      const finalList = applyDedupeFilter(listAfterRev, filters);
      return { data: finalList };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('get-download-directory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Select Download Directory',
      properties: ['openDirectory', 'createDirectory']
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  });

  ipcMain.on('cancel-download', () => {
    log.info('Received cancel signal from renderer.');
    downloadCancelled = true;
  });

  ipcMain.handle('delete-file', async (event, filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        log.info(`Deleted partial file: ${filePath}`);
        return { success: true };
      }
      return { success: false, error: 'File not found.' };
    } catch (e) {
      log.error(`Failed to delete partial file ${filePath}: ${e.message}`);
      return { success: false, error: e.message };
    }
  });

  ipcMain.on('open-external', (event, url) => {
    if (url.startsWith('https://github.com') || url.startsWith('https://myrient.erista.me')) {
      shell.openExternal(url);
    } else {
      log.warn(`Blocked attempt to open invalid external URL: ${url}`);
    }
  });

  ipcMain.on('window-minimize', () => {
    win.minimize();
  });

  ipcMain.on('window-maximize-restore', () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.on('window-close', () => {
    win.close();
  });

  ipcMain.handle('start-download', async (event, baseUrl, files, targetDir) => {
    downloadCancelled = false;
    skippedFiles = [];

    let filesToDownload = [];
    let totalSize = 0;
    let skippedSize = 0;
    let summaryMessage = "";
    let wasCancelled = false;
    let partialFile = null;

    try {
      const scanResult = await getDownloadInfo(baseUrl, files, targetDir);

      filesToDownload = scanResult.filesToDownload;
      totalSize = scanResult.totalSize;
      skippedSize = scanResult.skippedSize;

      if (filesToDownload.length === 0) {
        summaryMessage = "All matched files already exist locally. Nothing to download.";
      } else {
        win.webContents.send('download-log', `Total download size: ${(totalSize / (1024 ** 3)).toFixed(2)} GB (${filesToDownload.length} files)`);
        win.webContents.send('download-overall-progress', { current: skippedSize, total: totalSize, skippedSize: skippedSize });

        summaryMessage = await downloadFiles(baseUrl, filesToDownload, targetDir, totalSize, skippedSize);
      }

    } catch (e) {
      if (e.message.startsWith("CANCELLED_")) {
        log.warn("Download was cancelled by user.");
        summaryMessage = "Download cancelled by user.";
        wasCancelled = true;
        if (e.message === "CANCELLED_MID_FILE") {
          partialFile = e.partialFile || null;
        }
      } else {
        log.error(`[start-download] Unhandled Error: ${e.message}`);
        summaryMessage = `Error: ${e.message}`;
        win.webContents.send('download-log', summaryMessage);
      }
    }

    win.webContents.send('download-complete', {
      message: summaryMessage,
      skippedFiles: skippedFiles,
      wasCancelled: wasCancelled,
      partialFile: partialFile
    });

    return { success: true };
  });

  ipcMain.on('log-message', (event, level, message) => {
    log[level](message);
  });
}

setupIpcHandlers();