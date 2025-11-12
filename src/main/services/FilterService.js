/**
 * Service responsible for applying various filters to a list of files.
 */
class FilterService {
  /**
   * Applies a series of filters (tag, revision, deduplication) to a list of files.
   * @param {Array<object>} allFiles The initial list of files to filter.
   * @param {Array<string>} allTags All available tags across all files.
   * @param {object} filters An object containing the filter criteria.
   * @returns {Array<object>} The filtered list of files.
   */
  applyFilters(allFiles, allTags, filters) {
    const listAfterTags = this._applyTagFilter(allFiles, filters.include_tags, filters.exclude_tags);
    const listAfterRev = this._applyRevisionFilter(listAfterTags, filters);
    const finalList = this._applyDedupeFilter(listAfterRev, filters);
    return finalList;
  }

  /**
   * Applies include/exclude tag filtering to a list of files.
   * @param {Array<object>} fileList The list of files to filter.
   * @param {Array<string>} includeTags Tags that must be present (if any are specified).
   * @param {Array<string>} excludeTags Tags that must not be present.
   * @returns {Array<object>} The filtered file list.
   * @private
   */
  _applyTagFilter(fileList, includeTags, excludeTags) {
    const includeTagsSet = new Set(includeTags || []);
    const excludeTagsSet = new Set(excludeTags || []);

    if (includeTagsSet.size === 0 && excludeTagsSet.size === 0) {
      return fileList;
    }

    return fileList.filter(file => {
      const fileHasIncludeTag = includeTagsSet.size === 0 || file.tags.some(tag => includeTagsSet.has(tag));
      const fileHasNoExcludeTag = excludeTagsSet.size === 0 || !file.tags.some(tag => excludeTagsSet.has(tag));
      return fileHasIncludeTag && fileHasNoExcludeTag;
    });
  }

  /**
   * Applies revision-based filtering to a list of files, typically keeping only the highest revision.
   * @param {Array<object>} fileList The list of files to filter.
   * @param {object} filters The filter criteria, including `rev_mode`.
   * @returns {Array<object>} The filtered list of files.
   * @private
   */
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

  /**
   * Applies deduplication filtering to a list of files, based on different modes.
   * @param {Array<object>} fileList The list of files to filter.
   * @param {object} filters The filter criteria, including `dedupe_mode`, `priority_list`, and `keep_fallbacks`.
   * @returns {Array<object>} The deduplicated list of files.
   * @private
   */
  _applyDedupeFilter(fileList, filters) {
    const mode = filters.dedupe_mode || 'all';
    if (mode === 'all') return fileList;

    if (mode === 'priority') {
      const { priority_list: priorityList = [] } = filters;

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
        if (gameVersions.length === 0) continue;

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

        if (!bestFile) {
          bestFile = gameVersions[0];
        }

        const hasDiscTag = (file) => file.tags.some(t => /^(Disc|Cart|Side) /.test(t));

        const allFilesWithBestScore = gameVersions.filter(f => {
          let currentScore = 0;
          for (const tag of f.tags) {
            currentScore += (priorityMap.get(tag) || 0);
          }
          return currentScore === bestScore;
        });

        const discFilesWithBestScore = allFilesWithBestScore.filter(hasDiscTag);

        if (discFilesWithBestScore.length > 0) {
          finalList.push(...discFilesWithBestScore);
        } else {
          finalList.push(bestFile);
        }
      }
      return [...new Set(finalList)];
    }
    return fileList;
  }
}

export default FilterService;
