/**
 * The base URL for Myrient.
 * @type {string}
 */
export const MYRIENT_BASE_URL = 'https://myrient.erista.me/files/';
/**
 * Defines the possible directory structures for downloaded files.
 * @readonly
 * @enum {string}
 */
export const DOWNLOAD_DIRECTORY_STRUCTURE = {
  /** No subfolders, all files in the root download directory. */
  EMPTY: 'empty',
  /** Files organized in a flat structure within subfolders based on their original path. */
  FLAT: 'flat',
  /** Files organized in subfolders mirroring their original path. */
  SUBFOLDERS: 'subfolders',
  /** A mixed structure, typically combining elements of flat and subfolders. */
  MIXED: 'mixed',
};
