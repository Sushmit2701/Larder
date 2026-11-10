// Larder: storage. Everything is kept in this browser's localStorage under one key.
// Swap this file for IndexedDB or native storage later; the rest of the app only calls load/save/clear.
window.Larder = window.Larder || {};

Larder.storage = (function () {
  const KEY = 'larder.v1';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }
  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* storage blocked */ }
  }
  function getPref(name, fallback) {
    try { return localStorage.getItem('larder.pref.' + name) ?? fallback; } catch (e) { return fallback; }
  }
  function setPref(name, value) {
    try { localStorage.setItem('larder.pref.' + name, value); } catch (e) { /* storage blocked */ }
  }

  return { KEY, load, save, clear, getPref, setPref };
})();
