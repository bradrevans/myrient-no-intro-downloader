const path = require('path');

class FileParserService {
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

module.exports = FileParserService;
