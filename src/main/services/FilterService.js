class FilterService {
  applyFilters(allFiles, allTags, filters) {
    const [listAfterLang,] = this._applyLanguageFilter(allFiles, allTags, filters);
    const listAfterRev = this._applyRevisionFilter(listAfterLang, filters);
    const finalList = this._applyDedupeFilter(listAfterRev, filters);
    return finalList;
  }

  _applyLanguageFilter(fileList, allTags, filters) {
    const mode = filters.lang_mode || 'all';
    if (mode === 'all') return [fileList, allTags];

    if (mode === 'include') {
      const includeTags = new Set(filters.lang_tags || []);
      if (includeTags.size === 0) return [fileList, allTags];

      const filteredList = fileList.filter(file =>
        file.tags.some(tag => includeTags.has(tag))
      );
      return [filteredList, Array.from(includeTags)];
    }

    if (mode === 'exclude') {
      const excludeTags = new Set(filters.lang_tags || []);
      if (excludeTags.size === 0) return [fileList, allTags];

      const filteredList = fileList.filter(file =>
        !file.tags.some(tag => excludeTags.has(tag))
      );
      return [filteredList, allTags];
    }
    return [fileList, allTags];
  }

  _applyRevisionFilter(fileList, filters) {
    const mode = filters.rev_mode || 'all';
    if (mode === 'all') return fileList;

    if (mode === 'highest') {
      const groupedGames = new Map();
      for (const fileInfo of fileList) {
        if (!groupedGames.has(fileInfo.base_name)) {
          groupedGames.set(fileInfo.base_name, []);
        }
        groupedGames.get(fileInfo.base_name).push(fileInfo);
      }

      const finalList = [];
      for (const [baseName, filesForGame] of groupedGames.entries()) {
        if (filesForGame.length === 0) continue;

        const maxRevision = Math.max(...filesForGame.map(f => f.revision));

        for (const f of filesForGame) {
          if (f.revision === maxRevision) {
            finalList.push(f);
          }
        }
      }
      return finalList;
    }
    return fileList;
  }

  _applyDedupeFilter(fileList, filters) {
    const mode = filters.dedupe_mode || 'all';
    if (mode === 'all') return fileList;

    if (mode === 'simple') {
      const seenBaseNames = new Set();
      const deduplicatedList = [];
      for (const fileInfo of fileList) {
        if (!seenBaseNames.has(fileInfo.base_name)) {
          deduplicatedList.push(fileInfo);
          seenBaseNames.add(fileInfo.base_name);
        }
      }
      return deduplicatedList;
    }

    if (mode === 'priority') {
      const priorityList = filters.priority_list || [];
      const keepFallbacks = filters.keep_fallbacks;

      const maxScore = priorityList.length;
      const priorityMap = new Map(priorityList.map((tag, i) => [tag, maxScore - i]));

      const groupedGames = new Map();
      for (const fileInfo of fileList) {
        if (!groupedGames.has(fileInfo.base_name)) {
          groupedGames.set(fileInfo.base_name, []);
        }
        groupedGames.get(fileInfo.base_name).push(fileInfo);
      }

      const finalList = [];
      for (const [baseName, gameVersions] of groupedGames.entries()) {
        let bestFile = null;
        let bestScore = -1;

        for (const fileInfo of gameVersions) {
          let currentScore = 0;
          for (const tag of fileInfo.tags) {
            currentScore += (priorityMap.get(tag) || 0);
          }

          if (currentScore > bestScore) {
            bestScore = currentScore;
            bestFile = fileInfo;
          }
        }

        if (bestScore > 0) {
          finalList.push(bestFile);
        } else if (keepFallbacks && bestFile) {
          finalList.push(bestFile);
        }
      }
      return finalList;
    }
    return fileList;
  }
}

module.exports = FilterService;
