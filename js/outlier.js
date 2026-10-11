/*
 * Minerador de Outliers — funções de cálculo (sem dependência do navegador).
 * Este arquivo funciona tanto no navegador quanto no Node.js (para os testes).
 */
(function (root) {
  'use strict';

  // Vídeos com até 3 minutos são considerados Shorts (regra atual do YouTube).
  var SHORTS_MAX_SECONDS = 180;
  // Vídeos muito recentes ainda não acumularam views; ignoramos na mediana.
  var MIN_AGE_HOURS_FOR_BASELINE = 48;
  // Mínimo de vídeos para considerar a mediana confiável.
  var MIN_BASELINE_VIDEOS = 3;

  /** Converte duração ISO 8601 (ex.: "PT1H2M30S") em segundos. */
  function parseDuration(iso) {
    if (!iso || typeof iso !== 'string') return 0;
    var m = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
    if (!m) return 0;
    return (Number(m[1] || 0) * 86400) + (Number(m[2] || 0) * 3600) +
      (Number(m[3] || 0) * 60) + Math.round(Number(m[4] || 0));
  }

  function isShort(durationSeconds) {
    return durationSeconds > 0 && durationSeconds <= SHORTS_MAX_SECONDS;
  }

  /** Mediana de uma lista de números (ignora valores inválidos). */
  function median(values) {
    var nums = (values || []).filter(function (v) {
      return typeof v === 'number' && isFinite(v);
    }).sort(function (a, b) { return a - b; });
    if (nums.length === 0) return null;
    var mid = Math.floor(nums.length / 2);
    return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
  }

  /**
   * Calcula a "linha de base" do canal: a mediana de views dos últimos vídeos.
   *
   * @param {Array} channelVideos  [{id, views, publishedAt, durationSeconds}]
   * @param {Object} target        o vídeo que está sendo avaliado (é excluído da mediana)
   * @param {Date}   now
   * @returns {{median:number|null, sampleSize:number, sameFormat:boolean}}
   *
   * Regras:
   *  1. O próprio vídeo avaliado não entra na conta.
   *  2. Vídeos com menos de 48h são ignorados (se ainda sobrarem 3 ou mais).
   *  3. Se houver 3+ vídeos do mesmo formato (Short x longo), compara só com eles,
   *     porque Shorts e vídeos longos têm escalas de views muito diferentes.
   */
  function channelBaseline(channelVideos, target, now) {
    now = now || new Date();
    var others = (channelVideos || []).filter(function (v) {
      return v && (!target || v.id !== target.id) && typeof v.views === 'number';
    });

    var mature = others.filter(function (v) {
      if (!v.publishedAt) return true;
      var ageH = (now - new Date(v.publishedAt)) / 36e5;
      return ageH >= MIN_AGE_HOURS_FOR_BASELINE;
    });
    var pool = mature.length >= MIN_BASELINE_VIDEOS ? mature : others;

    var sameFormat = false;
    if (target && typeof target.durationSeconds === 'number' && target.durationSeconds > 0) {
      var targetShort = isShort(target.durationSeconds);
      var same = pool.filter(function (v) {
        return v.durationSeconds > 0 && isShort(v.durationSeconds) === targetShort;
      });
      if (same.length >= MIN_BASELINE_VIDEOS) {
        pool = same;
        sameFormat = true;
      }
    }

    return {
      median: median(pool.map(function (v) { return v.views; })),
      sampleSize: pool.length,
      sameFormat: sameFormat
    };
  }

  /**
   * Multiplicador = views do vídeo ÷ mediana do canal.
   * Retorna null quando não há dados suficientes para comparar.
   */
  function outlierMultiplier(views, baselineMedian) {
    if (typeof views !== 'number' || !isFinite(views)) return null;
    if (baselineMedian === null || baselineMedian === undefined) return null;
    // Evita divisão por zero: um canal cuja mediana é 0 é tratado como mediana 1.
    return views / Math.max(baselineMedian, 1);
  }

  /** Atalho: calcula baseline + multiplicador de uma vez. */
  function scoreVideo(target, channelVideos, now) {
    var base = channelBaseline(channelVideos, target, now);
    return {
      multiplier: outlierMultiplier(target.views, base.median),
      baselineMedian: base.median,
      sampleSize: base.sampleSize,
      sameFormat: base.sameFormat
    };
  }

  /* ---------- Heurística "faceless" ---------- */

  var FACELESS_KEYWORDS = [
    'lofi', 'lo-fi', 'lo fi', 'music', 'música', 'musica', 'beats', 'instrumental',
    'ambient', 'ambiente', 'relax', 'relaxing', 'relaxante', 'sleep', 'dormir',
    'study', 'estudar', 'chill', 'jazz', 'piano', 'meditation', 'meditação', 'meditacao',
    'asmr', 'white noise', 'ruído branco', 'ruido branco', 'rain', 'chuva', 'sounds', 'sons',
    'ai', 'a.i.', 'ia', 'artificial intelligence', 'inteligência artificial',
    'narração', 'narracao', 'narrado', 'narrada', 'narrated', 'narration', 'narrator', 'narrador',
    'voiceover', 'voice over', 'audiobook', 'audiolivro', 'audio book', 'história', 'historia',
    'stories', 'story', 'documentary', 'documentário', 'documentario', 'facts', 'fatos', 'curiosidades',
    'top 10', 'top10', 'compilation', 'compilação', 'compilacao', 'motivation', 'motivação', 'motivacao',
    'motivacional', 'motivational', 'oração', 'oracao', 'prayer', 'salmo', 'psalm', 'bíblia', 'biblia',
    'bible', 'devocional', 'animation', 'animação', 'animacao', 'animated', 'stock footage', 'slideshow',
    'playlist', 'mix', 'radio', 'rádio', '24/7', 'frequency', 'frequência', 'frequencia', 'hz',
    'binaural', 'reddit', 'tts', 'quotes', 'frases', 'reflexão', 'reflexao'
  ];

  var FACE_KEYWORDS = [
    'vlog', 'my life', 'minha vida', 'my family', 'minha família', 'minha familia', 'reaction',
    'react', 'reagindo', 'react to', 'podcast', 'entrevista', 'interview', 'tutorial comigo',
    'me acompanhe', 'get ready with me', 'grwm', 'arrume-se comigo', 'unboxing', 'mukbang',
    'challenge', 'desafio', 'meu dia', 'day in my life', 'rotina', 'routine', 'makeup',
    'maquiagem', 'eu e', 'family vlog', 'cosplay', 'live stream', 'q&a'
  ];

  function normalize(text) {
    return String(text || '').toLowerCase();
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Procura palavras inteiras (para "ai" não casar com "mais", por exemplo).
  function countMatches(text, keywords) {
    var found = [];
    keywords.forEach(function (kw) {
      var re = new RegExp('(^|[^\\p{L}\\p{N}])' + escapeRegExp(kw) + '($|[^\\p{L}\\p{N}])', 'iu');
      if (re.test(text) && found.indexOf(kw) === -1) found.push(kw);
    });
    return found;
  }

  /**
   * Estima se um canal é "faceless" a partir de textos (título do canal,
   * descrição, títulos de vídeos). Não é perfeito — é só uma pista.
   * @returns {{score:number, isFaceless:boolean, reasons:string[]}}
   */
  function facelessHeuristic(texts) {
    var text = normalize((texts || []).join(' \n '));
    var pos = countMatches(text, FACELESS_KEYWORDS);
    var neg = countMatches(text, FACE_KEYWORDS);
    var score = pos.length - neg.length * 1.5;
    return {
      score: score,
      isFaceless: score >= 2,
      reasons: pos.slice(0, 6),
      faceReasons: neg.slice(0, 6)
    };
  }

  var api = {
    SHORTS_MAX_SECONDS: SHORTS_MAX_SECONDS,
    parseDuration: parseDuration,
    isShort: isShort,
    median: median,
    channelBaseline: channelBaseline,
    outlierMultiplier: outlierMultiplier,
    scoreVideo: scoreVideo,
    facelessHeuristic: facelessHeuristic
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Outlier = api;
  }
})(typeof self !== 'undefined' ? self : this);
