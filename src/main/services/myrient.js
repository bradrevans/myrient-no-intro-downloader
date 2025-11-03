const https = require('https');
const axios = require('axios');
const cheerio = require('cheerio');
const log = require('electron-log');

const httpAgent = new https.Agent({ keepAlive: true });
const scrapeClient = axios.create({
  httpsAgent: httpAgent,
  timeout: 15000,
});

const fileParser = require('./file-parser.js');

async function getPage(url) {
  try {
    const response = await scrapeClient.get(url);
    return response.data;
  } catch (err) {
    log.error(`Failed to fetch ${url}: ${err.message}`);
    throw new Error(`Failed to fetch directory. Please check your connection and try again.`);
  }
}

function parseLinks(html) {
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
  const links = parseLinks(html);
  return links.filter(link => link.isDir);
}

async function getDirectoryList(url) {
  const html = await getPage(url);
  const links = parseLinks(html).filter(link => link.isDir);
  return { data: links.sort((a, b) => a.name.localeCompare(b.name)) };
}

async function scrapeAndParseFiles(url) {
  const html = await getPage(url);
  const links = parseLinks(html);
  const files = links.filter(link => !link.isDir);

  const allFiles = [];
  const allTags = new Set();

  for (const file of files) {
    const parsed = fileParser.parseFilename(file.name);
    parsed.href = file.href;
    allFiles.push(parsed);
    for (const tag of parsed.tags) {
      allTags.add(tag);
    }
  }

  return { files: allFiles, tags: Array.from(allTags) };
}

module.exports = {
  getPage,
  parseLinks,
  getMainArchives,
  getDirectoryList,
  scrapeAndParseFiles,
};