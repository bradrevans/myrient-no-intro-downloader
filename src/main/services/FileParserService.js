import path from 'path';

/**
 * Service responsible for parsing filenames and extracting relevant information.
 */
class FileParserService {
  /**
   * Parses a given filename to extract its base name, tags, and revision.
   * @param {string} filename The full filename to parse (e.g., "Game Name (USA) (Rev 1).zip").
   * @returns {{name_raw: string, base_name: string, tags: Array<string>, revision: number}} An object containing the parsed information.
   */
  parseFilename(filename) {
    const nameNoExt = path.parse(filename).name;
    const baseNameMatch = nameNoExt.split(/\s*\(|\[/, 1);
    const baseName = baseNameMatch[0].trim();

    const tags = new Set();
    const tagRegex = /[\[(](.*?)[\])]/g;
    let match;
    while ((match = tagRegex.exec(nameNoExt)) !== null) {
      tags.add(match[1].trim());
    }

    const revision = this._parseRevision(nameNoExt);

    const categorizedTags = {};
    for (const tag of tags) {
      const category = this.categorizeTag(tag);
      if (!categorizedTags[category]) {
        categorizedTags[category] = [];
      }
      categorizedTags[category].push(tag);
    }

    return {
      name_raw: filename,
      base_name: baseName,
      tags: Array.from(tags),
      categorizedTags: categorizedTags,
      revision: revision,
    };
  }

  /**
   * Parses the revision from a filename.
   * The revision is parsed in a specific order of priority:
   * 1. Numbered releases (e.g., v1.2.3, Rev 2)
   * 2. Numbered Beta releases (e.g., Beta 2)
   * 3. Simple Beta releases (e.g., Beta)
   * 4. Numbered Alpha releases (e.g., Alpha 1)
   * 5. Simple Alpha releases (e.g., Alpha)
   * 6. Prototypes with a date (e.g., Proto 2022-12-25)
   * 7. Prototypes without a date (e.g., Proto)
   * @param {string} nameNoExt The filename without the extension.
   * @returns {number} The parsed revision number. Higher numbers indicate higher revisions. Pre-release versions are negative.
   * @private
   */
  _parseRevision(nameNoExt) {
    const lowerCaseName = nameNoExt.toLowerCase();

    const versionMatch = lowerCaseName.match(/(?:\(v|ver|version|rev|revision)\.?\s*([\d\.]+)\)/);
    if (versionMatch && versionMatch[1]) {
      const parts = versionMatch[1].split('.').map(p => parseInt(p, 10) || 0);
      let num = 0;
      if (parts.length > 0) num += parts[0];
      if (parts.length > 1) num += parts[1] / 1000;
      if (parts.length > 2) num += parts[2] / 1000000;
      return num;
    }

    const betaNumMatch = lowerCaseName.match(/(?:\(beta)\s*(\d+)\)/);
    if (betaNumMatch && betaNumMatch[1]) {
      const num = parseInt(betaNumMatch[1], 10);
      return -1 + num / 100;
    }

    if (lowerCaseName.includes('(beta)')) {
      return -2;
    }

    const alphaNumMatch = lowerCaseName.match(/(?:\(alpha)\s*(\d+)\)/);
    if (alphaNumMatch && alphaNumMatch[1]) {
      const num = parseInt(alphaNumMatch[1], 10);
      return -3 + num / 100;
    }

    if (lowerCaseName.includes('(alpha)')) {
      return -4;
    }

    if (lowerCaseName.includes('(proto)')) {
      const dateMatch = lowerCaseName.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch && dateMatch[1]) {
        const dateAsNum = parseInt(dateMatch[1].replace(/-/g, ''), 10);
        return -5 + dateAsNum / 100000000;
      }
      return -6;
    }

    return 0.0;
  }

  /**
   * Categorizes a tag into a specific group.
   * @param {string} tag The tag to categorize.
   * @returns {string} The category of the tag.
   */
  categorizeTag(tag) {
    const trimmedTag = tag.trim();

    const parts = trimmedTag.split(/[,\+]/).map(p => p.trim());
    const lowerParts = parts.map(p => p.toLowerCase());

    const regionKeywords = ['usa', 'japan', 'europe', 'world', 'asia', 'australia', 'brazil', 'canada', 'china', 'denmark', 'finland', 'france', 'germany', 'greece', 'hong kong', 'israel', 'italy', 'korea', 'netherlands', 'norway', 'poland', 'portugal', 'russia', 'spain', 'sweden', 'taiwan', 'uk', 'united kingdom'];
    const regionSet = new Set(regionKeywords);
    const regionCount = lowerParts.filter(p => regionSet.has(p)).length;
    if (regionCount > 0 && (regionCount / parts.length) >= 0.5) {
      return 'Region';
    }

    const langKeywords = ['en', 'ja', 'fr', 'de', 'es', 'it', 'nl', 'pt', 'sv', 'no', 'da', 'fi', 'zh', 'ko', 'pl', 'ru', 'he', 'ca', 'ar', 'tr', 'zh-hant', 'zh-hans'];
    const langSet = new Set(langKeywords);
    const langCount = lowerParts.filter(p => langSet.has(p)).length;
    if (langCount > 0 && (langCount / parts.length) >= 0.5) {
      return 'Language';
    }

    return 'Other';
  }

  /**
   * Parses a list of file objects to extract information for each and aggregates all unique tags.
   * @param {Array<object>} files An array of file objects, each with a `name` and `href` property.
   * @returns {{files: Array<object>, tags: object}} An object containing an array of parsed file objects and an object of all unique tags found, categorized.
   */
  parseFiles(files) {
    const allFiles = [];
    const allTags = {};

    for (const file of files) {
      const parsed = this.parseFilename(file.name);
      parsed.href = file.href;
      allFiles.push(parsed);
      for (const category in parsed.categorizedTags) {
        if (!allTags[category]) {
          allTags[category] = new Set();
        }
        for (const tag of parsed.categorizedTags[category]) {
          allTags[category].add(tag);
        }
      }
    }

    const allTagsAsArrays = {};
    for (const category in allTags) {
      allTagsAsArrays[category] = Array.from(allTags[category]);
    }

    return { files: allFiles, tags: allTagsAsArrays };
  }
}

export default FileParserService;
