const fs = require('fs');
const path = require('path');
const yauzl = require('yauzl');

class UnzipService {
  constructor() {
    this.unzipCancelled = false;
  }

  cancel() {
    this.unzipCancelled = true;
  }

  isCancelled() {
    return this.unzipCancelled;
  }

  reset() {
    this.unzipCancelled = false;
  }

  async unzipFile(win, zipFilePath, targetDir) {
    return new Promise((resolve, reject) => {
      if (this.isCancelled()) {
        reject(new Error("CANCELLED_UNZIP"));
        return;
      }

      // Check if the zip file exists
      if (!fs.existsSync(zipFilePath)) {
        reject(new Error(`Zip file not found: ${zipFilePath}`));
        return;
      }


      // Open the zip file
      yauzl.open(zipFilePath, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          reject(err);
          return;
        }

        if (!zipfile) {
          reject(new Error("Failed to open zip file"));
          return;
        }

        const extractedFiles = [];
        let extractedEntries = 0;

        zipfile.on('end', () => {
          // All entries processed
          if (this.isCancelled()) {
            reject(new Error("CANCELLED_UNZIP"));
            return;
          }

          resolve({ message: `Successfully extracted ${extractedEntries} files`, files: extractedFiles });
        });

        zipfile.readEntry();

        zipfile.on('entry', (entry) => {
          if (this.isCancelled()) {
            zipfile.close();
            reject(new Error("CANCELLED_UNZIP"));
            return;
          }

          if (entry.isDirectory) {
            // Create directory
            const dirPath = path.join(targetDir, entry.fileName);
            if (!fs.existsSync(dirPath)) {
              fs.mkdirSync(dirPath, { recursive: true });
            }
            zipfile.readEntry();
            return;
          }

          // Extract file directly to target directory
          const targetPath = path.join(targetDir, entry.fileName);
          const dirPath = path.dirname(targetPath);
          
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
          }

          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              zipfile.close();
              reject(err);
              return;
            }

            const writeStream = fs.createWriteStream(targetPath);
            readStream.pipe(writeStream);

            writeStream.on('close', () => {
              extractedEntries++;
              zipfile.readEntry();
            });

            writeStream.on('error', (writeErr) => {
              zipfile.close();
              reject(writeErr);
            });
          });
        });

        zipfile.on('error', (err) => {
          reject(err);
        });
      });
    });
  }
}

module.exports = UnzipService;