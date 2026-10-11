// Testes do cálculo de outlier com dados de exemplo.
// Para rodar (precisa do Node.js instalado): node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const O = require('../js/outlier.js');

const NOW = new Date('2026-10-11T12:00:00Z');
const daysAgo = (d) => new Date(NOW - d * 864e5).toISOString();

test('parseDuration converte formatos ISO 8601', () => {
  assert.equal(O.parseDuration('PT45S'), 45);
  assert.equal(O.parseDuration('PT3M'), 180);
  assert.equal(O.parseDuration('PT1H2M30S'), 3750);
  assert.equal(O.parseDuration('P1DT1H'), 90000);
  assert.equal(O.parseDuration('P0D'), 0);
  assert.equal(O.parseDuration(''), 0);
  assert.equal(O.parseDuration(undefined), 0);
});

test('isShort usa o limite de 3 minutos', () => {
  assert.equal(O.isShort(59), true);
  assert.equal(O.isShort(180), true);
  assert.equal(O.isShort(181), false);
  assert.equal(O.isShort(0), false);
});

test('median: ímpar, par, vazio e valores inválidos', () => {
  assert.equal(O.median([5, 1, 3]), 3);
  assert.equal(O.median([4, 1, 3, 2]), 2.5);
  assert.equal(O.median([]), null);
  assert.equal(O.median([NaN, undefined, 10]), 10);
});

test('canal pequeno com um vídeo viral: 12x a mediana', () => {
  // Canal de jazz lofi: vídeos normais com ~1.000 views, um viral com 12.000.
  const videos = [
    { id: 'viral', views: 12000, publishedAt: daysAgo(5), durationSeconds: 3600 },
    { id: 'a', views: 800, publishedAt: daysAgo(10), durationSeconds: 3600 },
    { id: 'b', views: 1000, publishedAt: daysAgo(15), durationSeconds: 3500 },
    { id: 'c', views: 1200, publishedAt: daysAgo(20), durationSeconds: 3700 },
    { id: 'd', views: 950, publishedAt: daysAgo(25), durationSeconds: 3600 },
    { id: 'e', views: 1050, publishedAt: daysAgo(30), durationSeconds: 3600 }
  ];
  const r = O.scoreVideo(videos[0], videos, NOW);
  assert.equal(r.baselineMedian, 1000); // mediana de 800, 950, 1000, 1050, 1200
  assert.equal(r.multiplier, 12);
  assert.equal(r.sampleSize, 5);
});

test('o próprio vídeo não infla a mediana', () => {
  const videos = [
    { id: 'x', views: 1000000 },
    { id: 'a', views: 100 },
    { id: 'b', views: 200 }
  ];
  const r = O.scoreVideo(videos[0], videos, NOW);
  assert.equal(r.baselineMedian, 150);
  assert.ok(Math.abs(r.multiplier - 6666.67) < 0.01);
});

test('vídeos com menos de 48h são ignorados na mediana', () => {
  const videos = [
    { id: 't', views: 5000, publishedAt: daysAgo(3) },
    { id: 'novo1', views: 10, publishedAt: daysAgo(0.5) },
    { id: 'novo2', views: 20, publishedAt: daysAgo(1) },
    { id: 'a', views: 1000, publishedAt: daysAgo(7) },
    { id: 'b', views: 1000, publishedAt: daysAgo(14) },
    { id: 'c', views: 1000, publishedAt: daysAgo(21) }
  ];
  const r = O.scoreVideo(videos[0], videos, NOW);
  assert.equal(r.baselineMedian, 1000);
  assert.equal(r.multiplier, 5);
});

test('se sobrarem poucos vídeos maduros, usa todos', () => {
  const videos = [
    { id: 't', views: 300, publishedAt: daysAgo(1) },
    { id: 'n1', views: 50, publishedAt: daysAgo(1) },
    { id: 'n2', views: 100, publishedAt: daysAgo(1) },
    { id: 'a', views: 150, publishedAt: daysAgo(10) }
  ];
  const r = O.scoreVideo(videos[0], videos, NOW);
  assert.equal(r.baselineMedian, 100);
  assert.equal(r.multiplier, 3);
});

test('Shorts são comparados com Shorts quando há amostra suficiente', () => {
  const videos = [
    { id: 'short-alvo', views: 40000, publishedAt: daysAgo(4), durationSeconds: 45 },
    { id: 's1', views: 10000, publishedAt: daysAgo(8), durationSeconds: 30 },
    { id: 's2', views: 8000, publishedAt: daysAgo(9), durationSeconds: 50 },
    { id: 's3', views: 12000, publishedAt: daysAgo(10), durationSeconds: 59 },
    { id: 'l1', views: 500, publishedAt: daysAgo(11), durationSeconds: 900 },
    { id: 'l2', views: 600, publishedAt: daysAgo(12), durationSeconds: 1200 },
    { id: 'l3', views: 700, publishedAt: daysAgo(13), durationSeconds: 800 },
    { id: 'l4', views: 400, publishedAt: daysAgo(14), durationSeconds: 1000 }
  ];
  const r = O.scoreVideo(videos[0], videos, NOW);
  assert.equal(r.sameFormat, true);
  assert.equal(r.baselineMedian, 10000);
  assert.equal(r.multiplier, 4);
  // O mesmo canal, avaliando um vídeo longo, compara com os longos.
  const longo = { id: 'longo-alvo', views: 5500, publishedAt: daysAgo(4), durationSeconds: 1500 };
  const r2 = O.scoreVideo(longo, videos.concat(longo), NOW);
  assert.equal(r2.baselineMedian, 550);
  assert.equal(r2.multiplier, 10);
});

test('sem vídeos de comparação, multiplicador é null', () => {
  const v = { id: 'unico', views: 5000 };
  const r = O.scoreVideo(v, [v], NOW);
  assert.equal(r.multiplier, null);
});

test('mediana zero não causa divisão por zero', () => {
  assert.equal(O.outlierMultiplier(500, 0), 500);
  assert.equal(O.outlierMultiplier(undefined, 10), null);
});

test('heurística faceless', () => {
  const lofi = O.facelessHeuristic(['Jazz Lofi Café', 'Relaxing jazz music for study and sleep']);
  assert.equal(lofi.isFaceless, true);
  const oracao = O.facelessHeuristic(['Oração da Noite', 'Oração narrada e salmos para dormir']);
  assert.equal(oracao.isFaceless, true);
  const vlog = O.facelessHeuristic(['Ana Vlogs', 'Meu dia, minha rotina e vlog da família']);
  assert.equal(vlog.isFaceless, false);
  // "ai" não deve casar dentro de "mais"
  const mais = O.facelessHeuristic(['Mais receitas', 'Mais vídeos todo dia']);
  assert.deepEqual(mais.reasons, []);
});
