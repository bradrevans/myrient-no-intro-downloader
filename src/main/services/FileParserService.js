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
}

module.exports = FileParserService;
