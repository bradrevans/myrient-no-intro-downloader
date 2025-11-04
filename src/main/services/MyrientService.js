const https = require('https');
const axios = require('axios');
const cheerio = require('cheerio');
const FileParserService = require('./FileParserService.js');

class MyrientService {
  constructor() {
    this.fileParser = new FileParserService();
    this.httpAgent = new https.Agent({ keepAlive: true });
    this.scrapeClient = axios.create({
      httpsAgent: this.httpAgent,
      timeout: 15000,
    });
  }

  async getPage(url) {
    try {
      const response = await this.scrapeClient.get(url);
      return response.data;
    } catch (err) {
      throw new Error(`Failed to fetch directory. Please check your connection and try again.`);
    }
  }

  parseLinks(html) {
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

  async getMainArchives(url) {
    const html = await this.getPage(url);
    const links = this.parseLinks(html);
    return links.filter(link => link.isDir);
  }

  async getDirectoryList(url) {
    const html = await this.getPage(url);
    const links = this.parseLinks(html).filter(link => link.isDir);
    return { data: links.sort((a, b) => a.name.localeCompare(b.name)) };
  }

  async scrapeAndParseFiles(url) {
    const html = await this.getPage(url);
    const links = this.parseLinks(html);
    const files = links.filter(link => !link.isDir);

    const allFiles = [];
    const allTags = new Set();

    for (const file of files) {
      const parsed = this.fileParser.parseFilename(file.name);
      parsed.href = file.href;
      allFiles.push(parsed);
      for (const tag of parsed.tags) {
        allTags.add(tag);
      }
    }

    return { files: allFiles, tags: Array.from(allTags) };
  }
}

module.exports = MyrientService;
