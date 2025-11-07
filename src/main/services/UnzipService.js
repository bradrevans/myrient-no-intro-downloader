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

      // Create a temporary directory for extraction
      const tempDir = path.join(targetDir, 'temp_extract');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
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
        let totalEntries = 0;
        let extractedEntries = 0;

        // Get total number of entries
        zipfile.on('entry', () => {
          totalEntries++;
        });

        zipfile.on('end', () => {
          // All entries processed
          if (this.isCancelled()) {
            // Clean up temp directory
            try {
              if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true });
              }
            } catch (cleanupErr) {
              win.webContents.send('download-log', `Warning: Failed to clean up temp directory: ${cleanupErr.message}`);
            }
            reject(new Error("CANCELLED_UNZIP"));
            return;
          }

          // Move files from temp to target directory
          try {
            const files = fs.readdirSync(tempDir);
            files.forEach(file => {
              const sourcePath = path.join(tempDir, file);
              const destPath = path.join(targetDir, file);
              fs.renameSync(sourcePath, destPath);
              extractedFiles.push(file);
            });
            
            // Clean up temp directory
            fs.rmSync(tempDir, { recursive: true });
            
            win.webContents.send('download-log', `Successfully extracted ${extractedEntries} files from ${path.basename(zipFilePath)}`);
            resolve({ message: `Successfully extracted ${extractedEntries} files`, files: extractedFiles });
          } catch (moveErr) {
            win.webContents.send('download-log', `Error moving extracted files: ${moveErr.message}`);
            reject(moveErr);
          }
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

          // Extract file
          const targetPath = path.join(tempDir, entry.fileName);
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
          // Clean up temp directory
          try {
            if (fs.existsSync(tempDir)) {
              fs.rmSync(tempDir, { recursive: true });
            }
          } catch (cleanupErr) {
            win.webContents.send('download-log', `Warning: Failed to clean up temp directory: ${cleanupErr.message}`);
          }
          reject(err);
        });
      });
    });
  }
}

module.exports = UnzipService;