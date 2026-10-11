/*
 * Tudo o que fica salvo no navegador (localStorage): chave da API, cache,
 * marcações faceless, favoritos e contador de cota.
 */
(function (root) {
  'use strict';

  var PREFIX = 'mo:';
  var CACHE_PREFIX = PREFIX + 'cache:';

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      // Navegador cheio: apaga o cache (que pode ser refeito) e tenta de novo.
      clearCache();
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch (e2) {
        return false;
      }
    }
  }

  /* ---------- Cache com validade ---------- */

  function cacheGet(key) {
    try {
      var raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      var entry = JSON.parse(raw);
      if (Date.now() > entry.expires) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }
      return entry.value;
    } catch (e) {
      return null;
    }
  }

  function cacheSet(key, value, ttlHours) {
    var entry = JSON.stringify({ expires: Date.now() + ttlHours * 36e5, value: value });
    try {
      localStorage.setItem(CACHE_PREFIX + key, entry);
    } catch (e) {
      clearExpiredCache();
      try { localStorage.setItem(CACHE_PREFIX + key, entry); } catch (e2) { /* sem espaço: segue sem cache */ }
    }
  }

  function cacheKeys() {
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(CACHE_PREFIX) === 0) keys.push(k);
    }
    return keys;
  }

  function clearExpiredCache() {
    cacheKeys().forEach(function (k) {
      try {
        var entry = JSON.parse(localStorage.getItem(k));
        if (!entry || Date.now() > entry.expires) localStorage.removeItem(k);
      } catch (e) { localStorage.removeItem(k); }
    });
  }

  function clearCache() {
    cacheKeys().forEach(function (k) { localStorage.removeItem(k); });
  }

  function cacheSizeKB() {
    var total = 0;
    cacheKeys().forEach(function (k) { total += (localStorage.getItem(k) || '').length; });
    return Math.round(total * 2 / 1024);
  }

  /* ---------- Cota diária ---------- */

  // A cota do YouTube zera à meia-noite no horário do Pacífico (Califórnia).
  function quotaDay() {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function quotaUsed() {
    var q = read('quota', null);
    return q && q.day === quotaDay() ? q.used : 0;
  }

  function addQuota(units) {
    write('quota', { day: quotaDay(), used: quotaUsed() + units });
  }

  /* ---------- Chave da API e preferências ---------- */

  function getApiKey() { return read('apiKey', ''); }
  function setApiKey(k) { write('apiKey', String(k || '').trim()); }

  function getSettings() {
    return Object.assign({ baselineSize: 30, theme: 'auto' }, read('settings', {}));
  }
  function setSettings(s) { write('settings', Object.assign(getSettings(), s)); }

  /* ---------- Marcações faceless (manuais) ---------- */

  function getFacelessMarks() { return read('faceless', {}); }
  function setFacelessMark(channelId, value) {
    var marks = getFacelessMarks();
    if (value) marks[channelId] = value; else delete marks[channelId];
    write('faceless', marks);
  }

  /* ---------- Favoritos ---------- */

  function getFavorites() { return read('favorites', []); }
  function saveFavorites(list) { write('favorites', list); }

  root.Store = {
    read: read, write: write,
    cacheGet: cacheGet, cacheSet: cacheSet, clearCache: clearCache,
    clearExpiredCache: clearExpiredCache, cacheSizeKB: cacheSizeKB,
    quotaUsed: quotaUsed, addQuota: addQuota,
    getApiKey: getApiKey, setApiKey: setApiKey,
    getSettings: getSettings, setSettings: setSettings,
    getFacelessMarks: getFacelessMarks, setFacelessMark: setFacelessMark,
    getFavorites: getFavorites, saveFavorites: saveFavorites
  };
})(self);
