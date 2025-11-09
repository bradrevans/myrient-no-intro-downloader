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

  /**
   * Parses a list of file objects to extract information for each and aggregates all unique tags.
   * @param {Array<object>} files An array of file objects, each with a `name` and `href` property.
   * @returns {{files: Array<object>, tags: Array<string>}} An object containing an array of parsed file objects and an array of all unique tags found.
   */
  parseFiles(files) {
    const allFiles = [];
    const allTags = new Set();

    for (const file of files) {
      const parsed = this.parseFilename(file.name);
      parsed.href = file.href;
      allFiles.push(parsed);
      for (const tag of parsed.tags) {
        allTags.add(tag);
      }
    }

    return { files: allFiles, tags: Array.from(allTags) };
  }
}

export default FileParserService;
