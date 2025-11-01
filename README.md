Myrient Downloader
==================

This tool allows you to easily browse, filter, and download sets from any archive on Myrient (e.g., No-Intro, Redump, TOSEC). It turns a complex directory of thousands of files into a simple, step-by-step wizard.

Features
--------

- **Intelligent Platform Grouping**: Automatically cleans the platform/directory list, combining all variations (e.g., "Nintendo - GameCube" and "Redump - Nintendo - GameCube") into one "GameCube" option.

- **Searchable Menus**: All selection menus (Archive, Platform, Sub-category, and Tag Filtering) are fully searchable. Just type what you're looking for.

- **Advanced Filtering**: A powerful wizard helps you filter thousands of files down to *only* the ones you want.

  - **Region/Language**: Choose which regions to include (e.g., `(USA)`, `(Europe)`) or exclude (`(Japan)`, `(China)`).

  - **Revisions**: Automatically keep *only* the highest revision of each game (e.g., keep `(v1.1)` and discard `(v1.0)`).

  - **Priority De-duplication**: The core feature. Get just one copy of each game. Instead of getting `Game (USA)` and `Game (Europe)`, you can build a priority list (e.g., `1\. (USA)`, `2\. (World)`, `3\. (Europe)`) to get the single best version that matches your preferences.

- **Reliable Downloading**:

  - **Accurate Time Estimates**: Scans all files *before* downloading to get the total size (GB/MB), giving you a reliable ETA for the whole batch.

  - **Smart File Skipping**: Checks if you already have a file with the correct size in the download folder and skips it, allowing you to easily resume an interrupted batch.

  - **Dual Progress Bars**: An "Overall Progress" bar shows the total download status (and ETA), while a "Current File" bar shows the progress of the file being downloaded right now.

Requirements
------------

- Python 3.x

- Required Python libraries: `requests`, `beautifulsoup4`, `tqdm`

Installation
------------

1. Clone the repository.

2. Install the required libraries:

```shell
pip install requests beautifulsoup4 tqdm

```

User Guide
----------

Run the script from your terminal:

```shell
python3 myrient_downloader.py

```

### Step 1: Archive Selection

You will see a list of all top-level archives on Myrient (e.g., "No-Intro", "Redump").

- **To select**: Type the number of the archive and press **Enter**.

- **To search**: Type part of a name (e.g., `redump`) and press **Enter** to filter the list.

- **To clear search**: Press **Enter** with no text.

- **To quit**: Type `q` and press **Enter**.

### Step 2: Platform Selection

After picking an archive, you'll see all available platforms within it.

- **To select**: Type the number of the platform (e.g., `72` for "Nintendo GameCube") and press **Enter**.

- **To search**: Type part of a name (e.g., `gamecube`) and press **Enter** to filter the list.

- **To clear search**: Press **Enter** with no text.

- **To go back**: Type `b` and press **Enter**.

- **To quit**: Type `q` and press **Enter**.

### Step 3: Sub-Category Selection

After picking a platform, you'll see its sub-categories (e.g., `(Decrypted)`, `(Digital)`).

- **To select**: Type the number of the category and press **Enter**.

- **To search**: Type part of a name (e.g., `decrypted`) and press **Enter** to filter the list.

- **To clear search**: Press **Enter** with no text.

- **To go back**: Type `b` and press **Enter**.

- **To quit**: Type `q` and press **Enter**.

### Step 4: Filtering Wizard

This is the main filtering process.

**Step 4.1: Region/Language Filter** This lets you create the "pool" of files you're interested in.

- **[1] Keep ALL files**: Skips this step.

- **[2] Keep files that match an INCLUDE list**: (Recommended) This lets you select all the tags you want. A file will be kept if it has **at least one** of the tags you select.

  - **Example**: To get all English games, you would search for and select (`[*]`) all relevant tags, such as `(USA)`, `(Europe)`, `(UK)`, `(World)`, and `(En,Fr,De)`.

- **[3] Remove files that match an EXCLUDE list**: Lets you select tags to **remove**. A file will be thrown out if it has **any of the tags** you select.

**Step 4.2: Revision Filtering** This cleans your list of old versions.

- **[1] Keep ALL files**: Skips this step.

- **[2] Keep only the HIGHEST revision**: (Recommended) This automatically discards files like `(v1.0)` or `(Beta)` if a newer version like `(v1.1)` or `(Rev 1)` exists.

**Step 4.3: De-duplication** This is the final and most important step to ensure you only get one copy of each game.

- **[1] Keep ALL files**: Skips this step (you will get duplicates, e.g., both the USA and Europe version of a game).

- **[2] Keep ONE (Simple)**: Keeps the **first** version of a game it finds, at random. Fast, but you can't control which region you get.

- **[3] Keep ONE (Prioritized)**: (Recommended) This lets you build a ranked priority list.

    1. You will see a menu of all the tags you included in Step 4.1.

    2. Select tags in the order of your preference. The menu will show your list:

        ```shell
        --- Current Priority ---
          1. (USA)
          2. (World)
          3. (Europe)

        ```

    3. The script then "scores" every file. A file matching `(USA)` gets the highest score. If a game doesn't have a `(USA)` version, the script looks for a `(World)` version, and so on.

    4. This guarantees you get the single best version of each game according to your preferences.

### Step 5: Final Result

You will see a summary of your filtered list, including the total file count and a sample of files to be downloaded.

### Step 6: Download Location

The script will ask where to save the files.

- Press **Enter** to use the default (`./Downloads/` folder).

- Type a full path (e.g., `C:\roms\gc`) and press **Enter**.

- The script will offer to create the directory if it doesn't exist.

### Step 7: Downloading

The download will begin.

- **Overall Progress:** This bar tracks the total size (e.g., `10.5GB / 50GB`) and gives you a reliable ETA for the entire download batch.

- **Current File:** This bar tracks the individual file currently being downloaded.

If you stop and restart the script with the same settings, it will automatically skip any files you've already downloaded.

### Step 8: Done

Once complete, you can choose to `[R]estart` the script to grab another set or `[Q]uit`.

Disclaimer
----------

This is a web-scraping tool. Please be respectful of Myrient's bandwidth and service.
