/*
 * Minerador de Outliers — interface.
 */
(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var state = {
    items: [],        // [{video, channel, score, auto}]
    meta: null,       // {query, units, fromCache, at, analyzedChannels, skippedChannels}
    busy: false
  };

  /* ================= Utilidades de formatação ================= */

  var compactFmt = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  var fullFmt = new Intl.NumberFormat('pt-BR');

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function num(n) { return n === null || n === undefined ? '—' : compactFmt.format(n); }
  function fullNum(n) { return n === null || n === undefined ? '—' : fullFmt.format(n); }
  function multText(m) {
    if (m === null || m === undefined) return '—';
    return (m >= 10 ? Math.round(m) : m.toFixed(1).replace('.', ',')) + 'x';
  }
  function multLevel(m) {
    if (m === null || m === undefined) return 'none';
    if (m >= 10) return 'hot';
    if (m >= 5) return 'high';
    if (m >= 3) return 'mid';
    return 'low';
  }
  function dateText(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function relTime(iso) {
    if (!iso) return '';
    var days = Math.floor((Date.now() - new Date(iso)) / 864e5);
    if (days < 1) return 'hoje';
    if (days === 1) return 'há 1 dia';
    if (days < 31) return 'há ' + days + ' dias';
    var months = Math.floor(days / 30.4);
    if (months < 12) return 'há ' + months + (months === 1 ? ' mês' : ' meses');
    var years = Math.floor(days / 365);
    return 'há ' + years + (years === 1 ? ' ano' : ' anos');
  }
  function durText(sec) {
    if (!sec) return '';
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var pad = function (x) { return (x < 10 ? '0' : '') + x; };
    return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
  }
  function videoUrl(v) {
    return Outlier.isShort(v.durationSeconds)
      ? 'https://www.youtube.com/shorts/' + v.id
      : 'https://www.youtube.com/watch?v=' + v.id;
  }
  function channelUrl(c) {
    if (c && c.customUrl) return 'https://www.youtube.com/' + (c.customUrl[0] === '@' ? c.customUrl : '@' + c.customUrl);
    return 'https://www.youtube.com/channel/' + (c ? c.id : '');
  }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  /** Executa tarefas assíncronas com no máximo `limit` ao mesmo tempo. */
  function mapLimit(items, limit, fn) {
    var i = 0, results = new Array(items.length), failed = null;
    function worker() {
      if (failed || i >= items.length) return Promise.resolve();
      var idx = i++;
      return fn(items[idx], idx).then(function (r) { results[idx] = r; return worker(); },
        function (e) { failed = e; throw e; });
    }
    var workers = [];
    for (var w = 0; w < Math.min(limit, items.length); w++) workers.push(worker());
    return Promise.all(workers).then(function () { return results; });
  }

  /* ================= Abas e tema ================= */

  function showTab(name) {
    $$('.tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
    $$('.panel').forEach(function (p) { p.classList.toggle('active', p.id === 'tab-' + name); });
    if (name === 'favorites') renderFavorites();
    if (name === 'settings') renderSettings();
    window.scrollTo(0, 0);
  }

  function applyTheme(theme) {
    if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }

  function currentTheme() {
    var t = document.documentElement.dataset.theme;
    if (t) return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /* ================= Formulário de busca ================= */

  function readForm() {
    return {
      q: $('#q').value.trim(),
      lang: $('#lang').value,
      region: $('#region').value,
      days: Number($('#days').value),
      type: $('#type').value,
      order: $('#order').value,
      pages: Number($('#pages').value),
      maxSubs: $('#maxSubs').value ? Number($('#maxSubs').value) : null,
      maxAgeMonths: $('#maxAge').value ? Number($('#maxAge').value) : null,
      minVideos: $('#minVideos').value !== '' ? Number($('#minVideos').value) : null,
      maxVideos: $('#maxVideos').value !== '' ? Number($('#maxVideos').value) : null
    };
  }

  function updateCostEstimate() {
    var p = readForm();
    var el = $('#costEstimate');
    if (!p.q) {
      el.innerHTML = 'Digite palavras-chave para ver quanto a busca vai custar.';
      return;
    }
    var est = YT.estimateCost(p);
    var left = Math.max(0, 10000 - Store.quotaUsed());
    var html = est.searchCached
      ? '💾 Essa busca já está no cache (<strong>0 unidades</strong>). Só canais novos gastam: até ~<strong>' + fullNum(est.max) + '</strong> unidades.'
      : '💰 Custo estimado: <strong>' + fullNum(est.min) + '</strong> a <strong>' + fullNum(est.max) + '</strong> unidades';
    html += ' <span class="muted">· restam ~' + fullNum(left) + ' hoje</span>';
    el.innerHTML = html;
    el.title = 'O valor mínimo é a busca em si. O máximo considera que cada vídeo é de um canal diferente e nenhum está no cache (2 unidades por canal para calcular a mediana).';
  }

  function passesChannelFilters(ch, p) {
    if (!ch) return false;
    if (p.maxSubs !== null && (ch.subscribers === null || ch.subscribers > p.maxSubs)) return false;
    if (p.maxAgeMonths !== null) {
      var ageMonths = (Date.now() - new Date(ch.publishedAt)) / (30.4 * 864e5);
      if (ageMonths > p.maxAgeMonths) return false;
    }
    if (p.minVideos !== null && ch.videoCount < p.minVideos) return false;
    if (p.maxVideos !== null && ch.videoCount > p.maxVideos) return false;
    return true;
  }

  function setProgress(text) {
    if (text) {
      $('#progress').classList.remove('hidden');
      $('#progressText').textContent = text;
    } else {
      $('#progress').classList.add('hidden');
    }
  }

  function showError(msg) {
    var el = $('#searchError');
    if (!msg) { el.classList.add('hidden'); el.textContent = ''; return; }
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function runSearch(e) {
    e.preventDefault();
    if (state.busy) return;
    var p = readForm();
    if (!p.q) return;
    if (!Store.getApiKey()) {
      showError('Cadastre sua chave da API na aba Configurações antes de buscar.');
      return;
    }
    if (p.minVideos !== null && p.maxVideos !== null && p.minVideos > p.maxVideos) {
      showError('O mínimo de vídeos do canal está maior que o máximo.');
      return;
    }

    state.busy = true;
    $('#searchBtn').disabled = true;
    showError('');
    var tracker = { units: 0, fromCache: false };
    var baselineSize = Number(Store.getSettings().baselineSize) || 30;
    var videos, channels, kept, partialError = null;
    var recentByChannel = {};

    YT.searchVideos(p, tracker, setProgress).then(function (vs) {
      // Filtra o formato já aqui, para não gastar cota com canais que não interessam.
      videos = vs.filter(function (v) {
        if (p.type === 'shorts') return Outlier.isShort(v.durationSeconds);
        if (p.type === 'long') return !Outlier.isShort(v.durationSeconds);
        return true;
      });
      var ids = [];
      videos.forEach(function (v) { if (ids.indexOf(v.channelId) === -1) ids.push(v.channelId); });
      setProgress('Carregando dados de ' + ids.length + ' canais…');
      return YT.fetchChannels(ids, tracker);
    }).then(function (chs) {
      channels = chs;
      var okIds = Object.keys(channels).filter(function (id) { return passesChannelFilters(channels[id], p); });
      kept = okIds;
      var done = 0;
      setProgress('Calculando a mediana de ' + okIds.length + ' canais…');
      return mapLimit(okIds, 5, function (id) {
        return YT.fetchChannelRecentVideos(channels[id], baselineSize, tracker).then(function (list) {
          recentByChannel[id] = list;
          done++;
          setProgress('Calculando a mediana dos canais (' + done + ' de ' + okIds.length + ')…');
        });
      }).catch(function (err) {
        // Se a cota acabar no meio, mostramos o que já deu para calcular.
        partialError = err;
      });
    }).then(function () {
      var autoCache = {};
      var items = [];
      videos.forEach(function (v) {
        var ch = channels[v.channelId];
        if (!ch || kept.indexOf(v.channelId) === -1) return;
        var recent = recentByChannel[v.channelId];
        if (!recent) return; // canal não analisado (cota acabou)
        var score = Outlier.scoreVideo(v, recent); // o próprio vídeo é excluído da mediana
        if (!autoCache[ch.id]) {
          autoCache[ch.id] = Outlier.facelessHeuristic(
            [ch.title, ch.description].concat(recent.slice(0, 15).map(function (r) { return r.title; })));
        }
        items.push({ video: v, channel: ch, score: score, auto: autoCache[ch.id] });
      });

      state.items = items;
      state.meta = {
        query: p.q, units: tracker.units, fromCache: tracker.fromCache, at: Date.now(),
        found: videos.length, channelsTotal: Object.keys(channels).length,
        channelsKept: kept.length
      };
      Store.write('last', { items: state.items, meta: state.meta });
      if (partialError) showError(partialError.message + ' (Mostrando resultados parciais.)');
      renderResults();
      toast('Busca concluída · ' + fullNum(tracker.units) + ' unidades gastas');
    }).catch(function (err) {
      showError(err.message || String(err));
    }).then(function () {
      state.busy = false;
      $('#searchBtn').disabled = false;
      setProgress('');
      updateCostEstimate();
    });
  }

  /* ================= Resultados ================= */

  function facelessStatus(item, marks) {
    var mark = marks[item.channel.id];
    if (mark === 'faceless') return { faceless: true, manual: true };
    if (mark === 'face') return { faceless: false, manual: true };
    return { faceless: item.auto && item.auto.isFaceless, manual: false };
  }

  function filteredItems() {
    var minMult = Number($('#minMult').value);
    var ff = $('#facelessFilter').value;
    var rt = $('#resultType').value;
    var sort = $('#sortBy').value;
    var marks = Store.getFacelessMarks();

    var list = state.items.filter(function (it) {
      var m = it.score.multiplier;
      if (minMult > 0 && (m === null || m < minMult)) return false;
      var short = Outlier.isShort(it.video.durationSeconds);
      if (rt === 'shorts' && !short) return false;
      if (rt === 'long' && short) return false;
      var mark = marks[it.channel.id];
      if (ff === 'faceless' && !facelessStatus(it, marks).faceless) return false;
      if (ff === 'manual' && mark !== 'faceless') return false;
      if (ff === 'hideFace' && mark === 'face') return false;
      return true;
    });

    var by = {
      mult: function (a, b) { return (b.score.multiplier || 0) - (a.score.multiplier || 0); },
      views: function (a, b) { return b.video.views - a.video.views; },
      date: function (a, b) { return new Date(b.video.publishedAt) - new Date(a.video.publishedAt); },
      subs: function (a, b) {
        var sa = a.channel.subscribers === null ? Infinity : a.channel.subscribers;
        var sb = b.channel.subscribers === null ? Infinity : b.channel.subscribers;
        return sa - sb;
      }
    };
    return list.sort(by[sort] || by.mult);
  }

  function renderResults() {
    if (!state.meta) return;
    $('#resultsArea').classList.remove('hidden');
    var list = filteredItems();
    var m = state.meta;
    $('#resultsSummary').innerHTML =
      '<strong>' + list.length + '</strong> de ' + state.items.length + ' vídeos analisados aparecem com os filtros atuais · ' +
      'busca: “' + esc(m.query) + '” · ' + m.channelsKept + ' de ' + m.channelsTotal + ' canais passaram nos filtros de canal · ' +
      (m.fromCache ? 'busca vinda do cache, ' : '') + fullNum(m.units) + ' unidades gastas';

    var favKeys = Store.getFavorites().map(function (f) { return f.key; });
    var marks = Store.getFacelessMarks();

    if (!list.length) {
      $('#results').innerHTML = '<div class="empty">Nenhum vídeo com esses filtros. Tente diminuir o multiplicador mínimo ou mudar o filtro faceless.</div>';
      return;
    }

    $('#results').innerHTML = list.map(function (it) {
      var v = it.video, c = it.channel, s = it.score;
      var short = Outlier.isShort(v.durationSeconds);
      var fs = facelessStatus(it, marks);
      var mark = marks[c.id];
      var facelessBadge = fs.faceless
        ? '<span class="badge faceless" title="' + (fs.manual ? 'Marcado por você' : 'Palpite automático: ' + esc((it.auto.reasons || []).join(', '))) + '">🙈 Faceless' + (fs.manual ? '' : ' (auto)') + '</span>'
        : (mark === 'face' ? '<span class="badge face">🙂 Com rosto</span>' : '');
      var lvl = multLevel(s.multiplier);
      var multTitle = s.baselineMedian === null
        ? 'Sem vídeos suficientes no canal para comparar'
        : 'Mediana do canal: ' + fullNum(Math.round(s.baselineMedian)) + ' views (' + s.sampleSize + ' vídeos' + (s.sameFormat ? ', mesmo formato' : '') + ')';

      return '<article class="card result" data-vid="' + esc(v.id) + '">' +
        '<a class="thumb" href="' + videoUrl(v) + '" target="_blank" rel="noopener">' +
          '<img loading="lazy" src="' + esc(v.thumb) + '" alt="">' +
          '<span class="duration">' + (short ? 'Short · ' : '') + durText(v.durationSeconds) + '</span>' +
          '<span class="mult ' + lvl + '" title="' + esc(multTitle) + '">' + multText(s.multiplier) + '</span>' +
        '</a>' +
        '<div class="info">' +
          '<a class="title" href="' + videoUrl(v) + '" target="_blank" rel="noopener">' + esc(v.title) + '</a>' +
          '<a class="channel" href="' + channelUrl(c) + '" target="_blank" rel="noopener">' + esc(c.title) + '</a>' +
          '<div class="stats">' +
            '<span title="' + fullNum(v.views) + ' visualizações">👁 <strong>' + num(v.views) + '</strong> views</span>' +
            '<span title="' + (c.subscribers === null ? 'Canal oculta o número de inscritos' : fullNum(c.subscribers) + ' inscritos') + '">👥 ' + num(c.subscribers) + ' inscritos</span>' +
            '<span title="' + esc(multTitle) + '">📊 mediana ' + num(s.baselineMedian === null ? null : Math.round(s.baselineMedian)) + '</span>' +
            '<span title="' + dateText(v.publishedAt) + '">📅 ' + dateText(v.publishedAt) + ' <span class="muted">(' + relTime(v.publishedAt) + ')</span></span>' +
            '<span title="Canal criado em ' + dateText(c.publishedAt) + '">🎬 ' + fullNum(c.videoCount) + ' vídeos · canal ' + relTime(c.publishedAt).replace('há ', 'de ') + '</span>' +
          '</div>' +
          '<div class="badges">' + facelessBadge + '</div>' +
          '<div class="actions">' +
            '<button class="chip' + (favKeys.indexOf('v:' + v.id) > -1 ? ' on' : '') + '" data-act="favVideo">⭐ Vídeo</button>' +
            '<button class="chip' + (favKeys.indexOf('c:' + c.id) > -1 ? ' on' : '') + '" data-act="favChannel">⭐ Canal</button>' +
            '<button class="chip' + (mark === 'faceless' ? ' on' : '') + '" data-act="markFaceless" title="Marcar este canal como faceless">🙈 Faceless</button>' +
            '<button class="chip' + (mark === 'face' ? ' on' : '') + '" data-act="markFace" title="Marcar este canal como com rosto">🙂 Com rosto</button>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function findItem(videoId) {
    for (var i = 0; i < state.items.length; i++) if (state.items[i].video.id === videoId) return state.items[i];
    return null;
  }

  function onResultClick(e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var card = btn.closest('[data-vid]');
    var it = findItem(card.dataset.vid);
    if (!it) return;
    var act = btn.dataset.act;
    if (act === 'favVideo') toggleFavorite(videoFavorite(it));
    if (act === 'favChannel') toggleFavorite(channelFavorite(it));
    if (act === 'markFaceless' || act === 'markFace') {
      var value = act === 'markFaceless' ? 'faceless' : 'face';
      var cur = Store.getFacelessMarks()[it.channel.id];
      Store.setFacelessMark(it.channel.id, cur === value ? null : value);
      toast(cur === value ? 'Marcação removida' : (value === 'faceless' ? 'Canal marcado como faceless' : 'Canal marcado como com rosto'));
    }
    renderResults();
  }

  /* ================= Favoritos ================= */

  function videoFavorite(it) {
    var v = it.video, c = it.channel;
    return {
      key: 'v:' + v.id, type: 'video', id: v.id, title: v.title, url: videoUrl(v), thumb: v.thumb,
      channelId: c.id, channelTitle: c.title, channelUrl: channelUrl(c),
      subscribers: c.subscribers, views: v.views, multiplier: it.score.multiplier,
      median: it.score.baselineMedian, publishedAt: v.publishedAt,
      format: Outlier.isShort(v.durationSeconds) ? 'Short' : 'Longo',
      query: state.meta ? state.meta.query : '', note: '', savedAt: new Date().toISOString()
    };
  }

  function channelFavorite(it) {
    var c = it.channel;
    return {
      key: 'c:' + c.id, type: 'channel', id: c.id, title: c.title, url: channelUrl(c), thumb: c.thumb,
      channelId: c.id, channelTitle: c.title, channelUrl: channelUrl(c),
      subscribers: c.subscribers, views: c.totalViews, videoCount: c.videoCount,
      multiplier: it.score.multiplier, median: it.score.baselineMedian, publishedAt: c.publishedAt,
      exampleVideo: it.video.title, exampleUrl: videoUrl(it.video),
      query: state.meta ? state.meta.query : '', note: '', savedAt: new Date().toISOString()
    };
  }

  function toggleFavorite(fav) {
    var list = Store.getFavorites();
    var idx = list.findIndex(function (f) { return f.key === fav.key; });
    if (idx > -1) { list.splice(idx, 1); toast('Removido dos favoritos'); }
    else { list.unshift(fav); toast((fav.type === 'video' ? 'Vídeo' : 'Canal') + ' salvo nos favoritos'); }
    Store.saveFavorites(list);
    updateFavCount();
  }

  function updateFavCount() {
    var n = Store.getFavorites().length;
    $('#favCount').textContent = n ? n : '';
  }

  function facelessLabel(channelId) {
    var m = Store.getFacelessMarks()[channelId];
    return m === 'faceless' ? 'faceless' : (m === 'face' ? 'com rosto' : '');
  }

  function renderFavorites() {
    var filter = $('#favFilter').value;
    var list = Store.getFavorites().filter(function (f) { return filter === 'all' || f.type === filter; });
    if (!list.length) {
      $('#favList').innerHTML = '<div class="empty">Nada salvo ainda. Nos resultados da busca, clique em <strong>⭐ Vídeo</strong> ou <strong>⭐ Canal</strong>.</div>';
      return;
    }
    $('#favList').innerHTML = list.map(function (f) {
      var isVideo = f.type === 'video';
      var fl = facelessLabel(f.channelId);
      return '<article class="card fav" data-key="' + esc(f.key) + '">' +
        '<a class="fav-thumb ' + (isVideo ? '' : 'round') + '" href="' + esc(f.url) + '" target="_blank" rel="noopener"><img loading="lazy" src="' + esc(f.thumb) + '" alt=""></a>' +
        '<div class="info">' +
          '<span class="badge type">' + (isVideo ? '🎞 Vídeo' : '📺 Canal') + '</span>' +
          (fl ? ' <span class="badge ' + (fl === 'faceless' ? 'faceless' : 'face') + '">' + fl + '</span>' : '') +
          '<a class="title" href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.title) + '</a>' +
          (isVideo ? '<a class="channel" href="' + esc(f.channelUrl) + '" target="_blank" rel="noopener">' + esc(f.channelTitle) + '</a>' : '') +
          '<div class="stats">' +
            '<span>👥 ' + num(f.subscribers) + ' inscritos</span>' +
            '<span>👁 ' + num(f.views) + (isVideo ? ' views' : ' views no total') + '</span>' +
            (f.multiplier !== null && f.multiplier !== undefined ? '<span>📊 ' + multText(f.multiplier) + (isVideo ? '' : ' (vídeo de exemplo)') + '</span>' : '') +
            '<span>📅 ' + dateText(f.publishedAt) + '</span>' +
          '</div>' +
          '<textarea class="note" placeholder="Suas anotações (ideias, padrão do título, estilo da thumbnail…)" rows="2">' + esc(f.note) + '</textarea>' +
          '<div class="actions"><button class="chip danger" data-act="remove">🗑 Remover</button></div>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  var noteTimers = {};
  function onFavInput(e) {
    if (!e.target.classList.contains('note')) return;
    var key = e.target.closest('[data-key]').dataset.key;
    var value = e.target.value;
    clearTimeout(noteTimers[key]);
    noteTimers[key] = setTimeout(function () {
      var list = Store.getFavorites();
      list.forEach(function (f) { if (f.key === key) f.note = value; });
      Store.saveFavorites(list);
    }, 400);
  }

  function onFavClick(e) {
    var btn = e.target.closest('button[data-act="remove"]');
    if (!btn) return;
    var key = btn.closest('[data-key]').dataset.key;
    if (!confirm('Remover este item dos favoritos? A anotação também será apagada.')) return;
    Store.saveFavorites(Store.getFavorites().filter(function (f) { return f.key !== key; }));
    updateFavCount();
    renderFavorites();
  }

  function csvCell(v) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCsv() {
    var list = Store.getFavorites();
    if (!list.length) { toast('Não há favoritos para exportar'); return; }
    var header = ['Tipo', 'Título', 'Canal', 'Link', 'Link do canal', 'Inscritos', 'Views',
      'Multiplicador', 'Mediana do canal', 'Formato', 'Data de publicação', 'Faceless',
      'Vídeos no canal', 'Busca de origem', 'Anotação', 'Salvo em'];
    var rows = list.map(function (f) {
      return [
        f.type === 'video' ? 'Vídeo' : 'Canal', f.title, f.channelTitle, f.url, f.channelUrl,
        f.subscribers, f.views,
        f.multiplier === null || f.multiplier === undefined ? '' : f.multiplier.toFixed(1).replace('.', ','),
        f.median === null || f.median === undefined ? '' : Math.round(f.median),
        f.format || '', f.publishedAt ? f.publishedAt.slice(0, 10) : '', facelessLabel(f.channelId),
        f.videoCount === undefined ? '' : f.videoCount, f.query || '', f.note || '',
        f.savedAt ? f.savedAt.slice(0, 10) : ''
      ].map(csvCell).join(',');
    });
    // O "﻿" no início faz acentos aparecerem certos no Excel e no Google Planilhas.
    var csv = '﻿' + [header.map(csvCell).join(',')].concat(rows).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'minerador-favoritos-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('CSV exportado');
  }

  /* ================= Configurações ================= */

  function renderSettings() {
    var used = Store.quotaUsed();
    var pct = Math.min(100, used / 100);
    $('#quotaFill').style.width = pct + '%';
    $('#quotaFill').className = pct > 90 ? 'danger' : (pct > 70 ? 'warn' : '');
    $('#quotaText').innerHTML = '<strong>' + fullNum(used) + '</strong> de 10.000 unidades usadas hoje (estimativa) · restam ~' + fullNum(Math.max(0, 10000 - used));
    $('#cacheSize').textContent = 'Ocupando agora: ~' + Store.cacheSizeKB() + ' KB.';
    var s = Store.getSettings();
    $('#baselineSize').value = String(s.baselineSize);
    $('#themeSelect').value = s.theme;
  }

  function refreshKeyBanner() {
    $('#noKeyBanner').classList.toggle('hidden', !!Store.getApiKey());
  }

  function keyStatus(msg, kind) {
    var el = $('#keyStatus');
    el.textContent = msg;
    el.className = 'status ' + (kind || '');
  }

  function bindSettings() {
    $('#apiKey').value = Store.getApiKey();
    $('#toggleKey').addEventListener('click', function () {
      var i = $('#apiKey');
      i.type = i.type === 'password' ? 'text' : 'password';
      this.textContent = i.type === 'password' ? 'Mostrar' : 'Ocultar';
    });
    $('#saveKey').addEventListener('click', function () {
      var k = $('#apiKey').value.trim();
      if (!k) { keyStatus('Cole a chave no campo acima.', 'error'); return; }
      Store.setApiKey(k);
      refreshKeyBanner();
      keyStatus('Chave salva neste navegador. Clique em "Testar chave" para confirmar que funciona.', 'ok');
    });
    $('#testKey').addEventListener('click', function () {
      var k = $('#apiKey').value.trim();
      if (!k) { keyStatus('Cole a chave no campo acima.', 'error'); return; }
      Store.setApiKey(k);
      refreshKeyBanner();
      keyStatus('Testando…');
      YT.testKey().then(function () {
        keyStatus('✅ Tudo certo! A chave está funcionando.', 'ok');
      }, function (err) {
        keyStatus('❌ ' + err.message, 'error');
      }).then(renderSettings);
    });
    $('#removeKey').addEventListener('click', function () {
      if (!confirm('Apagar a chave salva neste navegador?')) return;
      Store.setApiKey('');
      $('#apiKey').value = '';
      refreshKeyBanner();
      keyStatus('Chave apagada.');
    });
    $('#baselineSize').addEventListener('change', function () {
      Store.setSettings({ baselineSize: Number(this.value) });
      toast('Vale a partir da próxima busca');
    });
    $('#themeSelect').addEventListener('change', function () {
      Store.setSettings({ theme: this.value });
      applyTheme(this.value);
    });
    $('#clearCache').addEventListener('click', function () {
      Store.clearCache();
      renderSettings();
      updateCostEstimate();
      toast('Cache limpo');
    });
  }

  /* ================= Início ================= */

  function init() {
    Store.clearExpiredCache();

    $$('.tab').forEach(function (b) {
      b.addEventListener('click', function () { showTab(b.dataset.tab); });
    });
    $$('[data-goto]').forEach(function (b) {
      b.addEventListener('click', function () { showTab(b.dataset.goto); });
    });
    $('#themeToggle').addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      Store.setSettings({ theme: next });
      applyTheme(next);
    });

    $('#searchForm').addEventListener('submit', runSearch);
    $('#searchForm').addEventListener('input', updateCostEstimate);
    $('#searchForm').addEventListener('change', updateCostEstimate);
    ['#minMult', '#facelessFilter', '#resultType', '#sortBy'].forEach(function (s) {
      $(s).addEventListener('change', renderResults);
    });
    $('#results').addEventListener('click', onResultClick);

    $('#favList').addEventListener('input', onFavInput);
    $('#favList').addEventListener('click', onFavClick);
    $('#favFilter').addEventListener('change', renderFavorites);
    $('#exportCsv').addEventListener('click', exportCsv);

    bindSettings();
    refreshKeyBanner();
    updateFavCount();
    updateCostEstimate();

    // Mostra a última busca feita (sem gastar cota).
    var last = Store.read('last', null);
    if (last && last.items && last.meta) {
      state.items = last.items;
      state.meta = last.meta;
      $('#q').value = last.meta.query || '';
      updateCostEstimate();
      renderResults();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
