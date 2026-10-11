/*
 * Comunicação com a YouTube Data API v3, com cache e contagem de cota.
 *
 * Custos oficiais (unidades):
 *   search.list ........ 100 por página (até 50 vídeos)
 *   videos.list ........ 1 por chamada (até 50 vídeos)
 *   channels.list ...... 1 por chamada (até 50 canais)
 *   playlistItems.list . 1 por chamada (até 50 vídeos)
 */
(function (root) {
  'use strict';

  var BASE = 'https://www.googleapis.com/youtube/v3/';
  var COST = { search: 100, videos: 1, channels: 1, playlistItems: 1, i18nRegions: 1 };
  var TTL = { search: 12, channel: 24, uploads: 24 }; // horas

  function ApiError(message, reason) {
    var e = new Error(message);
    e.reason = reason;
    return e;
  }

  var FRIENDLY = {
    quotaExceeded: 'A cota diária da sua chave acabou. Ela é renovada à meia-noite no horário do Pacífico (por volta das 4h ou 5h da manhã no Brasil). Enquanto isso, os resultados em cache continuam disponíveis.',
    dailyLimitExceeded: 'A cota diária da sua chave acabou. Tente novamente amanhã.',
    API_KEY_INVALID: 'A chave da API é inválida. Confira se copiou a chave inteira (começa com "AIza") na tela de Configurações.',
    keyInvalid: 'A chave da API parece inválida. Confira se copiou a chave inteira na tela de Configurações.',
    badRequest: 'A chave da API parece inválida ou a busca tem algum parâmetro inválido.',
    accessNotConfigured: 'A "YouTube Data API v3" não está ativada no seu projeto do Google Cloud. Veja o passo 1 do README.',
    SERVICE_DISABLED: 'A "YouTube Data API v3" não está ativada no seu projeto do Google Cloud. Veja o passo 1 do README.',
    ipRefererBlocked: 'Sua chave tem restrição de site e não aceita este endereço. Ajuste a restrição no Google Cloud (veja o README).',
    API_KEY_HTTP_REFERRER_BLOCKED: 'Sua chave tem restrição de site e não aceita este endereço. Ajuste a restrição no Google Cloud (veja o README).',
    API_KEY_SERVICE_BLOCKED: 'Sua chave está restrita a outras APIs. Libere a "YouTube Data API v3" nas restrições da chave.'
  };

  function chunk(arr, size) {
    var out = [];
    for (var i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  /** Faz uma chamada à API e soma o custo no contador. */
  function call(endpoint, params, tracker) {
    var key = Store.getApiKey();
    if (!key) return Promise.reject(ApiError('Cadastre sua chave da API na aba Configurações antes de buscar.', 'noKey'));

    var qs = new URLSearchParams();
    Object.keys(params).forEach(function (k) {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') qs.set(k, params[k]);
    });
    qs.set('key', key);

    var cost = COST[endpoint] || 1;
    Store.addQuota(cost);
    if (tracker) tracker.units += cost;

    return fetch(BASE + endpoint + '?' + qs.toString()).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.ok) return data;
        var err = data && data.error;
        var reason = err && err.errors && err.errors[0] && err.errors[0].reason;
        var detailReason = err && err.details && err.details[0] && err.details[0].reason;
        var msg = FRIENDLY[detailReason] || FRIENDLY[reason] ||
          ('Erro da API do YouTube: ' + ((err && err.message) || res.status));
        throw ApiError(msg, detailReason || reason || 'http' + res.status);
      });
    }, function () {
      throw ApiError('Sem conexão com a internet ou o YouTube não respondeu. Tente novamente.', 'network');
    });
  }

  function bestThumb(t) {
    t = t || {};
    return (t.high || t.medium || t.default || {}).url || '';
  }

  /** Detalhes (views, duração...) de uma lista de IDs de vídeo. */
  function fetchVideoDetails(ids, tracker) {
    var groups = chunk(ids, 50);
    return Promise.all(groups.map(function (g) {
      return call('videos', { part: 'snippet,statistics,contentDetails', id: g.join(','), maxResults: 50 }, tracker);
    })).then(function (responses) {
      var out = [];
      responses.forEach(function (r) {
        (r.items || []).forEach(function (v) {
          var s = v.statistics || {};
          var sn = v.snippet || {};
          out.push({
            id: v.id,
            title: sn.title || '',
            description: (sn.description || '').slice(0, 400),
            channelId: sn.channelId,
            channelTitle: sn.channelTitle || '',
            publishedAt: sn.publishedAt,
            thumb: bestThumb(sn.thumbnails),
            views: Number(s.viewCount || 0),
            likes: s.likeCount === undefined ? null : Number(s.likeCount),
            comments: s.commentCount === undefined ? null : Number(s.commentCount),
            durationSeconds: Outlier.parseDuration((v.contentDetails || {}).duration),
            live: sn.liveBroadcastContent && sn.liveBroadcastContent !== 'none'
          });
        });
      });
      return out;
    });
  }

  /** Dados de canais, com cache individual de 24h. */
  function fetchChannels(ids, tracker) {
    var result = {};
    var missing = [];
    ids.forEach(function (id) {
      var c = Store.cacheGet('ch:' + id);
      if (c) result[id] = c; else missing.push(id);
    });
    return Promise.all(chunk(missing, 50).map(function (g) {
      return call('channels', { part: 'snippet,statistics,contentDetails', id: g.join(','), maxResults: 50 }, tracker);
    })).then(function (responses) {
      responses.forEach(function (r) {
        (r.items || []).forEach(function (c) {
          var s = c.statistics || {};
          var sn = c.snippet || {};
          var ch = {
            id: c.id,
            title: sn.title || '',
            description: (sn.description || '').slice(0, 600),
            customUrl: sn.customUrl || '',
            publishedAt: sn.publishedAt,
            country: sn.country || '',
            thumb: bestThumb(sn.thumbnails),
            subscribers: s.hiddenSubscriberCount ? null : Number(s.subscriberCount || 0),
            totalViews: Number(s.viewCount || 0),
            videoCount: Number(s.videoCount || 0),
            uploadsPlaylist: ((c.contentDetails || {}).relatedPlaylists || {}).uploads || ''
          };
          result[c.id] = ch;
          Store.cacheSet('ch:' + c.id, ch, TTL.channel);
        });
      });
      return result;
    });
  }

  /** Últimos N vídeos do canal (com views), para calcular a mediana. Cache de 24h. */
  function fetchChannelRecentVideos(channel, n, tracker) {
    var cacheKey = 'up:' + channel.id + ':' + n;
    var cached = Store.cacheGet(cacheKey);
    if (cached) return Promise.resolve(cached);
    if (!channel.uploadsPlaylist) return Promise.resolve([]);

    return call('playlistItems', {
      part: 'contentDetails', playlistId: channel.uploadsPlaylist, maxResults: Math.min(n, 50)
    }, tracker).then(function (r) {
      var ids = (r.items || []).map(function (i) { return (i.contentDetails || {}).videoId; }).filter(Boolean);
      if (!ids.length) return [];
      return fetchVideoDetails(ids, tracker);
    }).then(function (videos) {
      var slim = videos.filter(function (v) { return !v.live; }).map(function (v) {
        return { id: v.id, title: v.title, views: v.views, publishedAt: v.publishedAt, durationSeconds: v.durationSeconds };
      });
      Store.cacheSet(cacheKey, slim, TTL.uploads);
      return slim;
    }).catch(function (e) {
      // Playlist inexistente/privada: segue sem mediana para este canal.
      if (e.reason === 'playlistNotFound' || e.reason === 'http404') return [];
      throw e;
    });
  }

  /** Busca por palavra-chave (search.list) + detalhes dos vídeos. Cache de 12h. */
  function searchVideos(p, tracker, onProgress) {
    var cacheKey = 'search:' + JSON.stringify([p.q, p.lang, p.region, p.days, p.type, p.pages, p.order]);
    var cached = Store.cacheGet(cacheKey);
    if (cached) { tracker.fromCache = true; return Promise.resolve(cached); }

    var publishedAfter = new Date(Date.now() - p.days * 864e5).toISOString().replace(/\.\d{3}Z$/, 'Z');
    var ids = [];
    var pageToken = '';

    function nextPage(i) {
      if (i >= p.pages) return Promise.resolve();
      onProgress('Buscando vídeos (página ' + (i + 1) + ' de ' + p.pages + ')…');
      return call('search', {
        part: 'snippet', type: 'video', q: p.q, maxResults: 50, order: p.order,
        publishedAfter: publishedAfter, regionCode: p.region, relevanceLanguage: p.lang,
        // 'short' = menos de 4 min; o filtro exato (até 3 min) é aplicado depois.
        videoDuration: p.type === 'shorts' ? 'short' : undefined,
        pageToken: pageToken || undefined
      }, tracker).then(function (r) {
        (r.items || []).forEach(function (it) {
          var id = it.id && it.id.videoId;
          if (id && ids.indexOf(id) === -1) ids.push(id);
        });
        pageToken = r.nextPageToken;
        if (pageToken) return nextPage(i + 1);
      });
    }

    return nextPage(0).then(function () {
      onProgress('Carregando estatísticas de ' + ids.length + ' vídeos…');
      return fetchVideoDetails(ids, tracker);
    }).then(function (videos) {
      videos = videos.filter(function (v) { return !v.live; });
      Store.cacheSet(cacheKey, videos, TTL.search);
      return videos;
    });
  }

  /** Estimativa de custo de uma busca, mostrada antes de clicar em "Buscar". */
  function estimateCost(p) {
    var cacheKey = 'search:' + JSON.stringify([p.q, p.lang, p.region, p.days, p.type, p.pages, p.order]);
    var searchCached = !!Store.cacheGet(cacheKey);
    var searchPart = searchCached ? 0 : p.pages * 101; // 100 da busca + 1 dos detalhes
    // Pior caso: cada vídeo de um canal diferente, nenhum em cache.
    var maxChannels = p.pages * 50;
    var channelPart = Math.ceil(maxChannels / 50) + maxChannels * 2;
    return { searchCached: searchCached, min: searchPart, max: searchPart + channelPart };
  }

  /** Testa a chave gastando só 1 unidade. */
  function testKey() {
    return call('i18nRegions', { part: 'snippet', hl: 'pt_BR' }, null);
  }

  root.YT = {
    COST: COST,
    searchVideos: searchVideos,
    fetchChannels: fetchChannels,
    fetchChannelRecentVideos: fetchChannelRecentVideos,
    estimateCost: estimateCost,
    testKey: testKey
  };
})(self);
