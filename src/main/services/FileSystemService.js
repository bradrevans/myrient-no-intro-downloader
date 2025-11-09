import fs from 'fs';
import { DOWNLOAD_DIRECTORY_STRUCTURE } from '../constants.js';

/**
 * Service responsible for file system interactions, particularly for managing download directories.
 */
class FileSystemService {
  /**
   * Checks the structure of a given download directory.
   * @param {string} downloadPath The absolute path to the download directory.
   * @returns {Promise<DownloadDirectoryStructure>} A promise that resolves with the detected directory structure.
   * @throws {Error} If an error occurs during file system access, other than the directory not existing.
   */
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
        return DOWNLOAD_DIRECTORY_STRUCTURE.EMPTY;
      } else if (hasFiles && !hasDirectories) {
        return DOWNLOAD_DIRECTORY_STRUCTURE.FLAT;
      } else if (!hasFiles && hasDirectories) {
        return DOWNLOAD_DIRECTORY_STRUCTURE.SUBFOLDERS;
      } else {
        return DOWNLOAD_DIRECTORY_STRUCTURE.MIXED;
      }
    } catch (e) {
      if (e.code === 'ENOENT') {
        return DOWNLOAD_DIRECTORY_STRUCTURE.EMPTY;
      }
      throw e;
    }
  }
}

export default FileSystemService;
