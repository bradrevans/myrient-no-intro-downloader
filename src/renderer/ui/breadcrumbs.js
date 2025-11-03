import { state, breadcrumbs } from '../state.js';

export function updateBreadcrumbs() {
  let html = `<span class="cursor-pointer hover:text-orange-500 transition-all duration-200" data-view="archives" data-step="0">Myrient Downloader</span>`;
  if (state.archive.name) {
    html += ` <span class="mx-2">&gt;</span> <span class="cursor-pointer hover:text-orange-500 transition-all duration-200" data-view="directories" data-step="1">${state.archive.name}</span>`;
  }
  if (state.directory.name) {
    html += ` <span class="mx-2">&gt;</span> <span class="hover:text-orange-500 transition-all duration-200">${state.directory.name}</span>`;
  }
  breadcrumbs.innerHTML = html;
}
