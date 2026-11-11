/* Run before CSS to apply the saved appearance without a light-theme flash.
 * Only a non-sensitive theme preference is persisted. No account or key data.
 */
"use strict";
(() => {
  const STORAGE_KEY = 'ota-station-theme';
  const allowed = new Set(['system', 'light', 'dark']);
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';
  const read = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return allowed.has(saved) ? saved : 'system';
    } catch {
      return 'system';
    }
  };
  const apply = () => {
    document.documentElement.dataset.theme = preference === 'system'
      ? (system.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.themePreference = preference;
    document.querySelectorAll('[data-theme-select]').forEach(select => {
      select.value = preference;
    });
  };
  preference = read();
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelectorAll('[data-theme-select]').forEach(select => {
      select.addEventListener('change', () => {
        preference = allowed.has(select.value) ? select.value : 'system';
        try { localStorage.setItem(STORAGE_KEY, preference); } catch { /* Optional preference. */ }
        apply();
      });
    });
  });
  system.addEventListener('change', () => { if (preference === 'system') apply(); });
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY || event.key === null) {
      preference = read();
      apply();
    }
  });
})();
