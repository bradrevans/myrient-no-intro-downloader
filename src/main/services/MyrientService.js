import https from 'https';
import axios from 'axios';
import * as cheerio from 'cheerio';
import FileParserService from './FileParserService.js';

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

    return this.fileParser.parseFiles(files);
  }
}

export default MyrientService;
