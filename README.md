Myrient Downloader (Electron Version)
=====================================

This is a desktop application for browsing and downloading from the Myrient archive, built with Electron and Node.js.

This version is a **complete rewrite in JavaScript** and **does not require Python.**

Features
--------

- **Intelligent Platform Grouping**: Automatically cleans the platform/directory list.

- **Searchable Menus**: All selection menus (Archive, Platform, Sub-category, and Tag Filtering) are fully searchable.

- **Advanced Filtering Wizard**:

  - **Region/Language**: Include/Exclude files based on tags.

  - **Revisions**: Automatically keep *only* the highest revision of each game.

  - **Priority De-duplication**: Build a ranked priority list (e.g., `1\. (USA)`, `2\. (World)`) to get the single best version of each game.

- **Reliable Downloading**:

  - **Accurate Time Estimates**: Scans all files *before* downloading to get the total size (GB/MB), providing a reliable ETA.

  - **Smart File Skipping**: Checks for existing files (with correct size) and skips them.

  - **Dual Progress Bars**: An "Overall Progress" bar for the total batch and a "Current File" bar for the active download.

Requirements
------------

- [Node.js](https://nodejs.org/ "null") (which includes `npm`)

Installation & Run
------------------

1. **Clone/Download:** Get all the files from this project.

2. **Install Dependencies:** Open a terminal in the project's root folder (where `package.json` is) and run:

    ```
    npm install

    ```

    This will install `electron`, `axios`, `cheerio`, and other required packages.

3. **Run the App:**

    ```
    npm start

    ```

Project Structure
-----------------

```
/
├── package.json        # Node.js app definition and dependencies
├── main.js             # Electron main process (Node.js backend, scraping, filtering, downloading)
├── preload.js          # Secure bridge between main process and renderer
├── index.html          # The application UI (HTML & Tailwind CSS)
└── renderer.js         # Frontend logic (JS, handles UI state and events)

```
