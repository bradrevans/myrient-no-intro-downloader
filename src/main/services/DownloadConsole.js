class DownloadConsole {
  constructor(win) {
    this.win = win;
  }

  log(message) {
    this.win.webContents.send('download-log', message);
  }

  logDownloadComplete() {
    this.log('Download complete!');
  }

  logDownloadCancelled() {
    this.log('Download cancelled!');
  }

  logDownloadStartingExtraction() {
    this.log('Starting extraction...');
  }

  logError(message) {
    this.log(`ERROR: ${message}`);
  }

  logTotalDownloadSize(size) {
    this.log(`Total download size: ${size}.`);
  }

  logResumingDownload(filename, bytes) {
    this.log(`Resuming download for ${filename} from ${bytes} bytes.`);
  }

  logCreatingSubfolderError(folder, message) {
    this.log(`Error creating subfolder ${folder}: ${message}`);
  }

  logSkippingInvalidEntry(entry) {
    this.log(`Skipping invalid entry: ${JSON.stringify(entry)}`);
  }

  logExtractionError(filename, message) {
    this.log(`Error extracting ${filename}: ${message}`);
  }

  logNoArchivesToExtract() {
    this.log('No .zip archives found to extract.');
  }

  logFoundArchivesToExtract(count) {
    this.log(`Found ${count} archive${count > 1 ? 's' : ''} to extract.`);
  }

  logTotalUncompressedSize(size) {
    this.log(`Total uncompressed size for all archives: ${size}.`);
  }

  logExtractionProcessComplete() {
    this.log('Extraction complete!');
  }

  logScanSkipped(filename, message) {
    this.log(`SKIP: Could not get info for ${filename}. Error: ${message}`);
  }
}

export default DownloadConsole;
