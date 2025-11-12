import https from 'https';
import axios from 'axios';
import * as cheerio from 'cheerio';
import FileParserService from './FileParserService.js';

/**
 * Service responsible for interacting with the Myrient website to fetch directory listings and file information.
 */
class MyrientService {
  /**
   * Creates an instance of MyrientService.
   */
  constructor() {
    this.fileParser = new FileParserService();
    this.httpAgent = new https.Agent({ keepAlive: true });
    this.scrapeClient = axios.create({
      httpsAgent: this.httpAgent,
      timeout: 15000,
    });
  }

  /**
   * Fetches the content of a given URL.
   * @param {string} url The URL to fetch.
   * @returns {Promise<string>} A promise that resolves with the HTML content of the page.
   * @throws {Error} If the page fails to fetch.
   */
  async getPage(url) {
    if (typeof url !== 'string' || !url) {
      throw new Error(`Invalid URL provided to getPage: ${url}`);
    }
    try {
      const response = await this.scrapeClient.get(url);
      return response.data;
    } catch (err) {
      throw new Error(`Failed to fetch directory. Please check your connection and try again.`);
    }
  }

  /**
   * Parses HTML content to extract relevant links.
   * @param {string} html The HTML content to parse.
   * @returns {Array<object>} An array of link objects, each with `name`, `href`, and `isDir` properties.
   */
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

  /**
   * Fetches and parses the main archive directories from a given URL.
   * @param {string} url The URL of the Myrient base page.
   * @returns {Promise<Array<object>>} A promise that resolves with an array of archive directory link objects.
   */
  async getMainArchives(url) {
    const html = await this.getPage(url);
    const links = this.parseLinks(html);
    return links.filter(link => link.isDir);
  }

  /**
   * Fetches and parses the list of directories within a given archive URL.
   * @param {string} url The URL of the archive directory.
   * @returns {Promise<{data: Array<object>}>} A promise that resolves with an object containing a sorted array of directory link objects.
   */
  async getDirectoryList(url) {
    const html = await this.getPage(url);
    const links = this.parseLinks(html).filter(link => link.isDir);
    return { data: links.sort((a, b) => a.name.localeCompare(b.name)) };
  }

  /**
   * Recursively scrapes a given URL for file and directory links and collects all raw file link objects.
   * @param {string} url The URL of the page containing file and directory links.
   * @param {string} baseUrl The initial URL from which the scraping started, used to construct full relative paths.
   * @returns {Promise<Array<object>>} A promise that resolves with an array of raw file link objects.
   * @private
   */
  async _scrapeRawFileLinks(url, baseUrl) {
    if (typeof url !== 'string' || !url) {
      throw new Error(`Invalid URL provided to _scrapeRawFileLinks: ${url}`);
    }
    if (typeof baseUrl !== 'string' || !baseUrl) {
      throw new Error(`Invalid baseUrl provided to _scrapeRawFileLinks: ${baseUrl}`);
    }
    let allRawFileLinks = [];
    const html = await this.getPage(url);
    const links = this.parseLinks(html);

    const currentLevelFiles = [];
    const subdirectories = [];

    links.forEach(link => {
      if (link.isDir) {
        subdirectories.push(link);
      } else {
        const absoluteFileUrl = new URL(link.href, url).toString();
        const relativeHref = absoluteFileUrl.replace(baseUrl, '');
        currentLevelFiles.push({ ...link, href: relativeHref, type: 'file' });
      }
    });

    allRawFileLinks = [...currentLevelFiles];

    for (const dir of subdirectories) {
      const subdirectoryUrl = new URL(dir.href, url).toString();
      const subDirRawFileLinks = await this._scrapeRawFileLinks(subdirectoryUrl, baseUrl);
      allRawFileLinks = [...allRawFileLinks, ...subDirRawFileLinks];
    }

    return allRawFileLinks;
  }

  /**
   * Scrapes a given URL for file and directory links, recursively collects all files, and parses their information.
   * @param {string} url The URL of the page containing file and directory links.
   * @returns {Promise<{files: Array<object>, tags: object}>} A promise that resolves with an object containing parsed file information and unique tags (from files).
   */
  async scrapeAndParseFiles(url) {
    const allRawFileLinks = await this._scrapeRawFileLinks(url, url);
    const { files: parsedItems, tags: parsedTags } = this.fileParser.parseFiles(allRawFileLinks);
    return { files: parsedItems, tags: parsedTags };
  }
}

export default MyrientService;
