#!/usr/bin/env python3

import os
import sys
import requests
import re
from collections import defaultdict
from urllib.parse import urlparse, urljoin, unquote

try:
    import requests
    from bs4 import BeautifulSoup
    from tqdm import tqdm
except ImportError:
    print("Error: Required libraries not found.")
    print("Please run: pip install requests beautifulsoup4 tqdm")
    sys.exit(1)

def print_splash_screen(title="Platform Selection"):
    """
    Displays the splash screen.
    """
    os.system('cls' if os.name == 'nt' else 'clear')
    
    print(r"""
___  ___           _            _    ______                    _                 _           
|  \/  |          (_)          | |   |  _  \                  | |               | |          
| .  . |_   _ _ __ _  ___ _ __ | |_  | | | |_____      ___ __ | | ___   __ _  __| | ___ _ __ 
| |\/| | | | | '__| |/ _ \ '_ \| __| | | | / _ \ \ /\ / / '_ \| |/ _ \ / _` |/ _` |/ _ \ '__|
| |  | | |_| | |  | |  __/ | | | |_  | |/ / (_) \ V  V /| | | | | (_) | (_| | (_| |  __/ |   
\_|  |_/\__, |_|  |_|\___|_| |_|\__| |___/ \___/ \_/\_/ |_| |_|_|\___/ \__,_|\__,_|\___|_|   
         __/ |                                                                               
        |___/                                                                                
""")

    print("=" * 64)
    print(f" Myrient No-Intro Downloader - {title}")
    print("=" * 64 + "\n")

def get_platform_groups(root_url):
    """
    Scrapes the root Myrient URL, groups platforms, and returns a dictionary.
    """
    print("Loading main directory... (this may take a moment)")
    
    try:
        response = requests.get(root_url)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
    except requests.exceptions.RequestException as e:
        print(f"Error: Failed to fetch directory data. {e}")
        return None

    all_links = []
    for link in soup.find_all('a'):
        href = link.get('href')
        
        if (href and 
            href.endswith('/') and 
            not href.startswith('?') and 
            not href.startswith('http') and
            not href.startswith('/') and
            '..' not in href and
            href != './'):
            
            all_links.append(link)
    
    if not all_links:
        print("Error: Scraper found no valid directory links. Page structure may have changed.")
        return None

    final_grouped_platforms = defaultdict(list)
    normalized_to_pretty_map = {}

    for link in all_links:
        dir_name = unquote(link.get('href')).strip('/')
        
        base_name = dir_name.split(' (', 1)[0].strip()
        
        split_list = re.split(r'\s*[-–—]\s*', base_name)
        
        platform_key_raw = split_list[-1].strip()

        platform_key_norm = platform_key_raw.lower()

        if platform_key_norm not in normalized_to_pretty_map:
            normalized_to_pretty_map[platform_key_norm] = platform_key_raw
        
        pretty_key = normalized_to_pretty_map[platform_key_norm]

        final_grouped_platforms[pretty_key].append({
            'name': dir_name,
            'href': link.get('href')
        })

    return final_grouped_platforms

def platform_selection_loop(grouped_platforms):
    """
    Manages the interactive menu for searching and selecting a platform.
    """
    all_platform_keys = sorted(grouped_platforms.keys())
    display_platforms = all_platform_keys
    
    while True:
        print_splash_screen("Step 1: Platform Selection")
        print("Please select a platform:")
        
        for platform_name in display_platforms:
            original_index = all_platform_keys.index(platform_name)
            print(f"  [{original_index+1}] {platform_name}")
        
        print("\n   [q] Quit")
        
        print(f"\nDisplaying {len(display_platforms)} of {len(all_platform_keys)} platforms.")
        print("(Enter a number, search, [Enter] to clear, or 'q' to quit)")
        choice = input("\nChoice: ").lower()

        if choice == 'q':
            return None
        
        if choice == '':
            display_platforms = all_platform_keys
            continue

        try:
            choice_num = int(choice)
            if 1 <= choice_num <= len(all_platform_keys):
                selected_key = all_platform_keys[choice_num - 1]
                if selected_key not in display_platforms:
                     print(f"Number {choice_num} is not in the current filtered list.")
                     print("Clear the search [Enter] to see all options.")
                     input("Press Enter to continue...")
                     continue
                
                return grouped_platforms[selected_key]
            else:
                print("Invalid number. Please try again.")
                input("Press Enter to continue...")
        
        except ValueError:
            query = choice
            filtered_list = [p for p in all_platform_keys if query in p.lower()]
            
            if not filtered_list:
                print(f"No results found for '{query}'.")
                input("Press Enter to continue...")
            else:
                display_platforms = filtered_list

def sub_category_selection_loop(sub_dirs):
    """
    Manages the menu for selecting a sub-category.
    """
    if len(sub_dirs) == 1:
        print(f"\nAuto-selecting only available sub-category: {sub_dirs[0]['name']}")
        input("Press Enter to continue...")
        return sub_dirs[0]['href']

    all_sub_dirs = sub_dirs
    display_dirs = all_sub_dirs

    while True:
        key_name = all_sub_dirs[0]['name'].split(' (', 1)[0].strip()
        
        split_list = re.split(r'\s*[-–—]\s*', key_name)
        key_name_clean = split_list[-1].strip()
            
        print_splash_screen(f"Step 2: Sub-Category for {key_name_clean}")
        print("Please select a sub-category:\n")
        
        print("   [b] .. (Go Back)")
        
        for dir_info in display_dirs:
            original_index = all_sub_dirs.index(dir_info)
            print(f"   [{original_index+1}] {dir_info['name']}")

        print("\n   [q] Quit")

        print(f"\nDisplaying {len(display_dirs)} of {len(all_sub_dirs)} sub-categories.")
        print("(Enter a number, search, [Enter] to clear, 'b' for back, or 'q' to quit)")
        choice = input("\nChoice: ").lower()
        
        if choice == 'q':
            return None
        if choice == 'b':
            return "GO_BACK"
            
        if choice == '':
            display_dirs = all_sub_dirs
            continue

        try:
            choice_num = int(choice)
            
            if 1 <= choice_num <= len(all_sub_dirs):
                selected_dir = all_sub_dirs[choice_num - 1]
                if selected_dir not in display_dirs:
                     print(f"Number {choice_num} is not in the current filtered list.")
                     print("Clear the search [Enter] to see all options.")
                     input("Press Enter to continue...")
                     continue
                
                return selected_dir['href']
            else:
                print("Invalid number. Please try again.")
                input("Press Enter to continue...")
        
        except ValueError:
            query = choice
            filtered_list = [d for d in all_sub_dirs if query in d['name'].lower()]
            
            if not filtered_list:
                print(f"No results found for '{query}'.")
                input("Press Enter to continue...")
            else:
                display_dirs = filtered_list

def parse_filename(filename):
    """
    Intelligently parses a No-Intro filename.
    """
    name_no_ext, _ = os.path.splitext(filename)
    
    base_name_match = re.split(r'\s*\(', name_no_ext, 1)
    base_name = base_name_match[0].strip()
    
    tags = set(t.strip() for t in re.findall(r'\((.*?)\)', name_no_ext))
    
    revision = 0.0
    rev_match = re.search(r'\((?:v|Rev)\s*([\d\.]+)\)', name_no_ext, re.IGNORECASE)
    if rev_match:
        try:
            revision = float(rev_match.group(1))
        except ValueError:
            revision = 0.0 
    
    return {
        'name_raw': filename,
        'base_name': base_name,
        'tags': tags,
        'revision': revision
    }

def scrape_and_parse_files(page_url):
    """
    Scrapes the sub-category URL, parses all filenames, and finds all tags.
    """
    print("\nScanning and parsing file list... (this may take a moment)")
    try:
        response = requests.get(page_url)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
    except requests.exceptions.RequestException as e:
        print(f"Error: Failed to fetch file list. {e}")
        return None, None

    all_files = []
    all_tags = set()
    
    for link in soup.find_all('a'):
        href = link.get('href')
        
        if href and (href.lower().endswith('.zip') or href.lower().endswith('.7z')):
            filename = unquote(href)
            
            parsed_info = parse_filename(filename)
            parsed_info['href'] = href
            
            all_files.append(parsed_info)
            all_tags.update(parsed_info['tags'])
                
    if not all_files:
        print("Error: No .zip or .7z files found in this directory.")
        return None, None
        
    print(f"Parsed {len(all_files)} files and found {len(all_tags)} unique tags.")
    input("Press Enter to continue to the filtering wizard...")
    return all_files, all_tags

def tag_selection_menu(all_tags, title, prompt, list_name):
    """
    A generic, reusable, searchable menu for building a list of tags.
    This version uses STABLE numbering and a minimal [*] marker.
    """
    selected_set = set()
    master_available_tags = sorted([t for t in all_tags if not re.match(r'^(v|Rev)\s*[\d\.]+$', t, re.IGNORECASE)])
    
    current_query = ""

    while True:
        print_splash_screen(title)
        print(prompt + "\n")

        display_available_tags = [t for t in master_available_tags if current_query in t.lower()]

        print(f"--- Available Tags (Toggle to {list_name}) ---")
        if not display_available_tags and current_query:
             print(f"  (No tags match '{current_query}')")
        elif not master_available_tags:
            print(f"  (No tags available)")
        else:
            for tag in display_available_tags:
                original_index = master_available_tags.index(tag)
                status = "[*]" if tag in selected_set else "[ ]"
                print(f"   [{original_index+1:>3}] {status} {tag}")

        print("\n" + "="*64)
        print("   [D] Done - Continue")
        print("   [C] Clear selection")
        print("   [A] Select all (displayed)")
        print("   [B] Back / Cancel")
        print("="*64)
        print(f"Displaying {len(display_available_tags)} of {len(master_available_tags)} available tags.")
        print(f"Enter number(s) to toggle (e.g. '1 5 10'), a search term,")
        print(" [Enter] to clear search, or a command (D, C, A, B):")
        
        choice = input("\nChoice: ").lower().strip()

        if choice == 'd':
            return selected_set
        if choice == 'b':
            return None
        if choice == 'c':
            selected_set.clear()
            current_query = ""
            print("Selection cleared.")
            input("Press Enter to continue...")
            
        elif choice == 'a':
            for tag in display_available_tags:
                selected_set.add(tag)
            print(f"Added all {len(display_available_tags)} displayed tags to selection.")
            input("Press Enter to continue...")
            
        elif choice == '':
            current_query = ""
            continue
            
        elif choice:
            try:
                nums_to_toggle = choice.split()
                toggled_any = False
                for num_str in nums_to_toggle:
                    num = int(num_str)
                    if 1 <= num <= len(master_available_tags):
                        tag = master_available_tags[num - 1]
                        
                        if tag in selected_set:
                            selected_set.remove(tag)
                        else:
                            selected_set.add(tag)
                        toggled_any = True
                            
                    else:
                        print(f"Warning: '{num}' is not a valid number. Ignoring.")

                if toggled_any:
                    continue 
                else:
                    pass

            except ValueError:
                current_query = choice
                continue 

            current_query = choice
        else:
            print("Invalid input.")
            input("Press Enter to continue...")

def language_filter_menu(file_list, all_tags):
    """
    Step 3.1: Asks user how to filter by tags (region/language).
    """
    while True:
        print_splash_screen("Step 3.1: Region/Language Filter")
        print("First, select the broad pool of files you are interested in.\n")
        print("Tip: To get 'all English games', choose [2] and select all tags")
        print("that contain English, e.g. (USA), (Europe), (UK), (World), (En,Fr,De), etc.\n")
        
        print("   [1] Keep ALL files (No tag filter)")
        print("   [2] Keep files that match an INCLUDE list (Recommended)")
        print("   [3] Remove files that match an EXCLUDE list")
        print("\n   [b] Back to sub-category selection")

        choice = input("\nChoice: ").lower().strip()
        
        if choice == 'b':
            return None, None
            
        if choice == '1':
            return file_list, all_tags

        elif choice == '2':
            include_tags = tag_selection_menu(
                all_tags, 
                "Step 3.1: INCLUDE Tags",
                "Select tags to INCLUDE. A file will be KEPT if it has AT LEAST ONE of these tags.",
                "INCLUDE"
            )
            if include_tags is None: continue
            
            if not include_tags:
                print("No tags selected. Keeping all files for this step.")
                input("Press Enter to continue...")
                return file_list, all_tags

            filtered_list = []
            for file_info in file_list:
                if not file_info['tags'].isdisjoint(include_tags):
                    filtered_list.append(file_info)
            
            print(f"Filter applied: {len(file_list)} -> {len(filtered_list)} files.")
            input("Press Enter to continue...")
            return filtered_list, include_tags

        elif choice == '3':
            exclude_tags = tag_selection_menu(
                all_tags, 
                "Step 3.1: EXCLUDE Tags",
                "Select tags to EXCLUDE. A file will be REMOVED if it has AT LEAST ONE of these tags.",
                "EXCLUDE"
            )
            if exclude_tags is None: continue
            
            if not exclude_tags:
                print("No tags selected. Keeping all files for this step.")
                input("Press Enter to continue...")
                return file_list, all_tags

            filtered_list = []
            for file_info in file_list:
                if file_info['tags'].isdisjoint(exclude_tags):
                    filtered_list.append(file_info)
            
            print(f"Filter applied: {len(file_list)} -> {len(filtered_list)} files.")
            input("Press Enter to continue...")
            return filtered_list, all_tags

        else:
            print("Invalid choice. Please enter 1, 2, 3, or b.")
            input("Press Enter to continue...")

def revision_filter_menu(file_list):
    """
    Step 3.2: Asks user how to handle game revisions.
    """
    while True:
        print_splash_screen("Step 3.2: Revision Filtering")
        print(f"You have {len(file_list)} files remaining.")
        print("This step handles multiple versions (e.g., (v1.1), (Rev 1)).\n")

        print("   [1] Keep ALL files (Keep all revisions)")
        print("   [2] Keep only the HIGHEST revision of each game (Recommended)")
        print("\n   [b] Back to previous step")
        
        choice = input("\nChoice: ").lower().strip()
        
        if choice == 'b':
            return None
            
        if choice == '1':
            return file_list

        if choice == '2':
            grouped_games = defaultdict(list)
            for file_info in file_list:
                grouped_games[file_info['base_name']].append(file_info)
            
            final_list = []
            for base_name, files_for_game in grouped_games.items():
                if not files_for_game:
                    continue
                
                max_revision = max(f['revision'] for f in files_for_game)
                
                for f in files_for_game:
                    if f['revision'] == max_revision:
                        final_list.append(f)
            
            print(f"Filter applied: {len(file_list)} -> {len(final_list)} files.")
            input("Press Enter to continue...")
            return final_list
        
        else:
            print("Invalid choice. Please enter 1, 2, or b.")
            input("Press Enter to continue...")

def build_priority_list_menu(all_tags):
    """
    A sub-menu for Step 3.3 to create an ordered list of priority tags.
    This menu is searchable AND uses stable numbering.
    """
    priority_list = []
    master_available_tags = sorted([t for t in all_tags if not re.match(r'^(v|Rev)\s*[\d\.]+$', t, re.IGNORECASE)])
    
    current_query = ""

    while True:
        print_splash_screen("Step 3.3: Build Priority List")
        print("Create your ranked priority list. The order you select tags is their priority.\n")
        
        print("--- Current Priority ---")
        if not priority_list:
            print("  (Empty)")
        else:
            for i, tag in enumerate(priority_list):
                print(f"  {i+1}. {tag}")
        
        display_available_tags = [t for t in master_available_tags if current_query in t.lower()]

        print("\n--- Available Tags ---")
        if not display_available_tags and current_query:
             print(f"  (No tags match '{current_query}')")
        elif not master_available_tags:
            print("  (No tags available)")
        else:
            for tag in display_available_tags:
                original_index = master_available_tags.index(tag)
                
                status = "[ ]"
                if tag in priority_list:
                    status = f"[{priority_list.index(tag) + 1}]"
                    
                print(f"   [{original_index+1:>3}] {status} {tag}")

        print("\n" + "="*64)
        print("   [D] Done - Use this priority list")
        print("   [C] Clear priority list")
        print("   [L+] Add remaining (displayed, longest first)")
        print("   [S+] Add remaining (displayed, shortest first)")
        print("   [B] Back / Cancel")
        print("="*64)
        print(f"Displaying {len(display_available_tags)} of {len(master_available_tags)} available tags.")
        print("Enter number(s) to toggle, a search term, [Enter] to clear search,")
        print("or a command (D, C, L+, S+, B):")
        choice = input("\nChoice: ").lower().strip()

        if choice == 'd':
            return priority_list
        if choice == 'b':
            return None
        if choice == 'c':
            priority_list = []
            current_query = ""
            
        elif choice == 'l+':
            sorted_tags = sorted(display_available_tags, key=len, reverse=True)
            for tag in sorted_tags:
                if tag not in priority_list:
                    priority_list.append(tag)
        elif choice == 's+':
            sorted_tags = sorted(display_available_tags, key=len)
            for tag in sorted_tags:
                if tag not in priority_list:
                    priority_list.append(tag)
        
        elif choice == '':
            current_query = ""
            continue
            
        elif choice:
            try:
                nums_to_toggle = choice.split()
                toggled_any = False
                for num_str in nums_to_toggle:
                    num = int(num_str)
                    if 1 <= num <= len(master_available_tags):
                        tag = master_available_tags[num - 1]
                        
                        if tag in priority_list:
                            priority_list.remove(tag)
                        else:
                            priority_list.append(tag)
                        toggled_any = True
                            
                    else:
                        print(f"Warning: '{num}' is not a valid number. Ignoring.")
                
                if toggled_any:
                    continue

            except ValueError:
                current_query = choice
                continue
                
            current_query = choice
        else:
            print("Invalid input.")
            input("Press Enter to continue...")

def priority_deduplication_menu(file_list, all_tags, tags_for_priority_menu):
    """
    Step 3.3: The de-duplication menu with prioritization.
    """
    while True:
        print_splash_screen("Step 3.3: De-duplication")
        print(f"You have {len(file_list)} files remaining.")
        print("This final step ensures you only get ONE copy of each game.\n")

        print("   [1] Keep ALL files (No de-duplication)")
        print("   [2] Keep ONE (Simple) - (Fast, but keeps a random region)")
        print("   [3] Keep ONE (Prioritized) - (Build a ranked list of tags) (Recommended)")
        print("\n   [b] Back to previous step")
        
        choice = input("\nChoice: ").lower().strip()

        if choice == 'b':
            return None
        
        if choice == '1':
            return file_list

        if choice == '2':
            seen_base_names = set()
            deduplicated_list = []
            
            for file_info in file_list:
                if file_info['base_name'] not in seen_base_names:
                    deduplicated_list.append(file_info)
                    seen_base_names.add(file_info['base_name'])
            
            print(f"Filter applied: {len(file_list)} -> {len(deduplicated_list)} files.")
            input("Press Enter to continue...")
            return deduplicated_list

        if choice == '3':
            priority_list = build_priority_list_menu(tags_for_priority_menu)
            if priority_list is None:
                continue
            
            print_splash_screen("Step 3.3: De-duplication")
            print("What about games that do NOT match any of your priority tags?")
            print(f"Example: You prioritized (USA), but a game only exists as (Japan).")
            print("\n   [1] Keep them (Keeps the best-scoring version, even if 0)")
            print("   [2] Discard them (Only keep games that matched your list)")
            
            fallback_choice = ""
            while fallback_choice not in ('1', '2'):
                fallback_choice = input("\nChoice: ").lower().strip()
            keep_fallbacks = (fallback_choice == '1')
            
            max_score = len(priority_list)
            priority_map = {tag: max_score - i for i, tag in enumerate(priority_list)}
            
            grouped_games = defaultdict(list)
            for file_info in file_list:
                grouped_games[file_info['base_name']].append(file_info)

            final_list = []
            for base_name, game_versions in grouped_games.items():
                
                best_file = None
                best_score = -1
                
                for file_info in game_versions:
                    current_score = 0
                    for tag in file_info['tags']:
                        current_score += priority_map.get(tag, 0)
                    
                    if current_score > best_score:
                        best_score = current_score
                        best_file = file_info
                
                if best_score > 0:
                    final_list.append(best_file)
                elif keep_fallbacks:
                    final_list.append(best_file)

            print(f"Filter applied: {len(file_list)} -> {len(final_list)} files.")
            input("Press Enter to continue...")
            return final_list

        else:
            print("Invalid choice. Please enter 1, 2, 3, or b.")
            input("Press Enter to continue...")

def get_download_directory():
    """
    Step 5: Asks for and validates a target download directory.
    """
    print("\n" + "="*64)
    print_splash_screen("Step 5: Download Location")
    print("Where would you like to save the files?")
    print("Default: ./Downloads\n")
    print("   [c] Cancel (return to main menu)")
    
    while True:
        path_input = input("\nEnter target directory: ").strip()
        
        if path_input.lower() == 'c':
            return None
        
        if path_input == '':
            target_dir = os.path.join(os.getcwd(), "Downloads")
        else:
            target_dir = os.path.abspath(path_input)

        try:
            if not os.path.exists(target_dir):
                choice = input(f"Directory not found:\n{target_dir}\nCreate it? (y/n): ").lower()
                if choice == 'y':
                    os.makedirs(target_dir, exist_ok=True)
                else:
                    print("Please enter a new path.")
                    continue
            
            if os.access(target_dir, os.W_OK):
                print(f"Files will be saved to: {target_dir}")
                return target_dir
            else:
                print(f"Error: No write permissions for {target_dir}")
                print("Please enter a different path.")
        
        except Exception as e:
            print(f"An error occurred: {e}")
            print("Please enter a valid path.")

def get_download_info(file_list, base_url, target_dir, session):
    """
    Pre-scan all files to get their total size and check for existing files.
    """
    total_size = 0
    files_to_download = []
    
    print("\nScanning file sizes and checking for existing files...")
    
    for file_info in tqdm(file_list, desc="Scanning files", unit="file", dynamic_ncols=True):
        filename = file_info['name_raw']
        file_href = file_info['href']
        target_path = os.path.join(target_dir, filename)
        file_url = urljoin(base_url, file_href)
        
        try:
            response = session.head(file_url, timeout=5, allow_redirects=True)
            response.raise_for_status()
            remote_size = int(response.headers.get('content-length', 0))
            
            file_info['size'] = remote_size
            
            if os.path.exists(target_path):
                local_size = os.path.getsize(target_path)
                if remote_size > 0 and local_size == remote_size:
                    file_info['skip'] = True
                    tqdm.write(f"Skipping (exists): {filename}")
                    continue
            
            file_info['skip'] = False
            total_size += remote_size
            files_to_download.append(file_info)

        except requests.exceptions.RequestException as e:
            tqdm.write(f"\nWarning: Could not get info for {filename}. It will be skipped. (Error: {e})")
            file_info['skip'] = True
    
    return files_to_download, total_size


def download_files(file_list, base_url, target_dir, total_size):
    """
    Step 6: Downloads all files in the list with nested progress bars.
    """
    print("\n" + "="*64)
    print("Step 6: Downloading Files...")
    
    session = requests.Session()
    
    with tqdm(
        total=total_size, 
        desc="Overall Progress", 
        unit='B', 
        unit_scale=True, 
        unit_divisor=1024, 
        dynamic_ncols=True,
        smoothing=0.1
    ) as outer_pbar:
        
        with tqdm(
            total=0, 
            desc="Current File", 
            unit='B', 
            unit_scale=True, 
            unit_divisor=1024, 
            leave=False, 
            dynamic_ncols=True,
            position=1,
            smoothing=0.1
        ) as inner_pbar:
            
            for file_info in file_list:
                if file_info.get('skip', True):
                    continue
                
                filename = file_info['name_raw']
                file_href = file_info['href']
                target_path = os.path.join(target_dir, filename)
                file_url = urljoin(base_url, file_href)
                file_size = file_info.get('size', 0)
                
                inner_pbar.reset(total=file_size)
                inner_pbar.set_description(f"{filename[:40]}")
                
                try:
                    with session.get(file_url, stream=True, timeout=10) as r:
                        r.raise_for_status()
                        
                        with open(target_path, 'wb') as f:
                            for chunk in r.iter_content(chunk_size=8192):
                                f.write(chunk)
                                inner_pbar.update(len(chunk))
                                outer_pbar.update(len(chunk))
                
                except requests.exceptions.RequestException as e:
                    tqdm.write(f"\nError downloading {filename}: {e}")
                    if os.path.exists(target_path): os.remove(target_path)
                except IOError as e:
                    tqdm.write(f"\nError writing file {filename}: {e} (Disk full?)")
                    if os.path.exists(target_path): os.remove(target_path)
                except Exception as e:
                    tqdm.write(f"\nAn unexpected error occurred with {filename}: {e}")
                    if os.path.exists(target_path): os.remove(target_path)

if __name__ == "__main__":
    
    ROOT_URL = "https://myrient.erista.me/files/No-Intro/"
    
    try:
        print_splash_screen()
        platform_groups = get_platform_groups(ROOT_URL)
        
        if not platform_groups:
            print("Could not find any platforms. Exiting.")
            sys.exit(1)
            
        while True: 
            selected_subdirs = platform_selection_loop(platform_groups)
            if not selected_subdirs:
                print("Exiting.")
                sys.exit(0)
            
            selected_href = sub_category_selection_loop(selected_subdirs)
            if selected_href == "GO_BACK":
                continue
            if not selected_href:
                print("Exiting.")
                sys.exit(0)
            
            FINAL_URL = urljoin(ROOT_URL, selected_href)
            
            all_files_info, all_tags = scrape_and_parse_files(FINAL_URL)
            if not all_files_info:
                print("Returning to main menu.")
                input("Press Enter to continue...")
                continue
            
            list_after_lang = None
            tags_for_priority = None
            list_after_rev = None
            final_list = None
            
            while True: 
                if list_after_lang is None:
                    list_after_lang, tags_for_priority = language_filter_menu(all_files_info, all_tags)
                if list_after_lang is None:
                    break
                
                if list_after_rev is None:
                    list_after_rev = revision_filter_menu(list_after_lang)
                if list_after_rev is None:
                    list_after_lang = None
                    continue

                if final_list is None:
                    current_tags = set().union(*[f['tags'] for f in list_after_rev])
                    final_list = priority_deduplication_menu(list_after_rev, current_tags, tags_for_priority)
                if final_list is None:
                    list_after_rev = None
                    continue

                break 
            
            if final_list is None:
                continue

            
            print_splash_screen("Step 4: Final Result")
            print(f"Selected Directory: {unquote(FINAL_URL)}")
            print(f"Found {len(final_list)} matching files out of {len(all_files_info)} total.\n")
            
            if final_list:
                print("--- Filtered File List (Sample) ---")
                for file_info in final_list[:20]:
                    print(f"  {file_info['name_raw']}")
                if len(final_list) > 20:
                    print(f"  ...and {len(final_list) - 20} more.")
                
                target_dir = get_download_directory()
                
                if target_dir:
                    session = requests.Session()
                    files_to_download, total_size = get_download_info(final_list, FINAL_URL, target_dir, session)
                    
                    if not files_to_download:
                        print("\nAll matched files already exist locally. Nothing to download.")
                    else:
                        print(f"\nTotal download size: {total_size / (1024**3):.2f} GB ({len(files_to_download)} files)")
                        input("Press Enter to begin downloading...")
                        download_files(files_to_download, FINAL_URL, target_dir, total_size)
                        print("\nAll downloads complete!")
                else:
                    print("\nDownload cancelled.")
                
            else:
                print("No files matched your filters.")
            
            print("\n" + "="*64)
            print("\n([R]estart, [Q]uit)")
            
            choice = ""
            while choice not in ('r', 'q'):
                choice = input("Choice: ").lower().strip()

            if choice == 'r':
                continue
            else:
                print("Exiting.")
                sys.exit(0)
            
    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user. Exiting.")
    except Exception as e:
        print(f"\nAn unexpected error occurred: {e}")
