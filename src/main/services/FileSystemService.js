import fs from 'fs';
import { DownloadDirectoryStructure } from '../constants.js';

class FileSystemService {
  async checkDownloadDirectoryStructure(downloadPath) {
    try {
      const entries = await fs.promises.readdir(downloadPath, { withFileTypes: true });

      let hasFiles = false;
      let hasDirectories = false;

      for (const entry of entries) {
        if (entry.isFile()) {
          hasFiles = true;
        } else if (entry.isDirectory()) {
          hasDirectories = true;
        }
      }

      if (!hasFiles && !hasDirectories) {
        return DownloadDirectoryStructure.EMPTY;
      } else if (hasFiles && !hasDirectories) {
        return DownloadDirectoryStructure.FLAT;
      } else if (!hasFiles && hasDirectories) {
        return DownloadDirectoryStructure.SUBFOLDERS;
      } else {
        return DownloadDirectoryStructure.MIXED;
      }
    } catch (e) {
      if (e.code === 'ENOENT') {
        return DownloadDirectoryStructure.EMPTY;
      }
      throw e;
    }
  }
}

export default FileSystemService;
