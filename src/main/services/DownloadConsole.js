/**
 * Manages logging of download-related messages to the renderer process.
 */
class DownloadConsole {
  /**
   * Creates an instance of DownloadConsole.
   * @param {object} win The Electron BrowserWindow instance to send messages to.
   */
  constructor(win) {
    this.win = win;
  }

  /**
   * Sends a log message to the renderer process.
   * @param {string} message The message to log.
   */
  log(message) {
    this.win.webContents.send('download-log', message);
  }

  /**
   * Logs a message indicating that the download is complete.
   */
  logDownloadComplete() {
    this.log('Download complete!');
  }

  /**
   * Logs a message indicating that the download has been cancelled.
   */
  logDownloadCancelled() {
    this.log('Download cancelled!');
  }

  /**
   * Logs a message indicating that the extraction process is starting.
   */
  logDownloadStartingExtraction() {
    this.log('Starting extraction...');
  }

  /**
   * Logs an error message.
   * @param {string} message The error message to log.
   */
  logError(message) {
    this.log(`ERROR: ${message}`);
  }

  /**
   * Logs the total size of the download.
   * @param {string} size The formatted total download size.
   */
  logTotalDownloadSize(size) {
    this.log(`Total download size: ${size}.`);
  }

  /**
   * Logs a message indicating that a download is resuming.
   * @param {string} filename The name of the file being resumed.
   * @param {number} bytes The number of bytes already downloaded.
   */
  logResumingDownload(filename, bytes) {
    this.log(`Resuming download for ${filename} from ${bytes} bytes.`);
  }

  /**
   * Logs an error message when a subfolder cannot be created.
   * @param {string} folder The name of the subfolder that could not be created.
   * @param {string} message The error message.
   */
  logCreatingSubfolderError(folder, message) {
    this.log(`Error creating subfolder ${folder}: ${message}`);
  }

  /**
   * Logs a message indicating that an invalid entry is being skipped.
   * @param {object} entry The invalid entry that is being skipped.
   */
  logSkippingInvalidEntry(entry) {
    this.log(`Skipping invalid entry: ${JSON.stringify(entry)}`);
  }

  /**
   * Logs an error message during file extraction.
   * @param {string} filename The name of the file that caused the extraction error.
   * @param {string} message The error message.
   */
  logExtractionError(filename, message) {
    this.log(`Error extracting ${filename}: ${message}`);
  }

  /**
   * Logs a message indicating that the extraction process has been cancelled.
   */
  logExtractionCancelled() {
    this.log('Extraction cancelled!');
  }

  /**
   * Logs a message indicating that no archives were found for extraction.
   */
  logNoArchivesToExtract() {
    this.log('No .zip archives found to extract.');
  }

  /**
   * Logs the number of archives found for extraction.
   * @param {number} count The number of archives found.
   */
  logFoundArchivesToExtract(count) {
    this.log(`Found ${count} archive${count > 1 ? 's' : ''} to extract.`);
  }

  /**
   * Logs the total uncompressed size of all archives.
   * @param {string} size The formatted total uncompressed size.
   */
  logTotalUncompressedSize(size) {
    this.log(`Total uncompressed size for all archives: ${size}.`);
  }

  /**
   * Logs a message indicating that the extraction process is complete.
   */
  logExtractionProcessComplete() {
    this.log('Extraction complete!');
  }

  /**
   * Logs a message indicating that a scan was skipped for a file.
   * @param {string} filename The name of the file for which the scan was skipped.
   * @param {string} message The reason for skipping the scan.
   */
  logScanSkipped(filename, message) {
    this.log(`SKIP: Could not get info for ${filename}. Error: ${message}`);
  }
}

export default DownloadConsole;
