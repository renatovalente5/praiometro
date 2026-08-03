/* Passa o modelo por muitas praias reais, com dados reais, e verifica que
   nenhuma produz um resultado impossível ou uma excepção.
   Correr:  node _source/testar-praias.js  [quantas]                          */

global.window = global;
require('../assets/js/modelo.js');
var M = global.Modelo;
var fs = require('fs');

var MODELOS = ['ecmwf_ifs025', 'icon_seamless', 'gfs_seamless', 'ukmo_seamless'];
var PRAIAS = JSON.parse(fs.readFileSync(__dirname + '/../data/praias.json', 'utf8'));
var QUANTAS = parseInt(process.argv[2] || '40', 10);

/* Amostra espalhada de norte a sul, e com praias de rio pelo meio, em vez das
   primeiras N do ficheiro — que seriam todas do mesmo canto do país. */
function amostra(n) {
  var ordenadas = PRAIAS.slice().sort(function (a, b) { return b.la - a.la; });
  var passo = ordenadas.length / n, out = [];
  for (var i = 0; i < n; i++) out.push(ordenadas[Math.floor(i * passo)]);
  return out;
}

function url(base, pontos, extra) {
  return base + '?latitude=' + pontos.map(function (p) { return p.la; }).join(',')
    + '&longitude=' + pontos.map(function (p) { return p.lo; }).join(',')
    + extra + '&timezone=auto&forecast_days=6';
}
function comoArray(x) { return x == null ? [] : (Array.isArray(x) ? x : [x]); }

var falhas = [], avisos = [], contagem = { verde: 0, amarelo: 0, vermelho: 0 }, testes = 0;
function ok(cond, texto) {
  testes++;
  if (!cond) falhas.push(texto);
}

(async function () {
  var praias = amostra(QUANTAS);
  var mar = praias.filter(function (p) { return p.m; });
  console.log('\nA pedir ' + praias.length + ' praias (' + mar.length + ' de mar, '
    + (praias.length - mar.length) + ' de rio) em 2 pedidos…\n');

  var tempo = comoArray(await (await fetch(url('https://api.open-meteo.com/v1/forecast', praias,
    '&hourly=temperature_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,wind_direction_10m,'
    + 'cloud_cover,precipitation,precipitation_probability,uv_index,weather_code'
    + '&daily=weather_code,precipitation_sum&models=' + MODELOS.join(',')))).json());
  var marinho = comoArray(await (await fetch(url('https://marine-api.open-meteo.com/v1/marine', mar,
    '&hourly=sea_surface_temperature,wave_height'))).json());

  ok(tempo.length === praias.length, 'a API devolveu ' + tempo.length + ' de ' + praias.length + ' praias');
  var porMar = {};
  mar.forEach(function (p, i) { porMar[p.n + p.la] = marinho[i] || null; });

  praias.forEach(function (p, i) {
    var rot = (p.m ? 'mar ' : 'rio ') + p.n.slice(0, 30);
    var dias, veredictos;
    try {
      dias = M.agregar(M.consenso(tempo[i], MODELOS), porMar[p.n + p.la], p);
      veredictos = dias.map(M.classificarDia);
    } catch (e) {
      falhas.push(rot + ': excepção — ' + e.message);
      return;
    }

    ok(dias.length === 6, rot + ': deviam ser 6 dias, são ' + dias.length);

    veredictos.forEach(function (v, d) {
      var onde = rot + ' dia ' + d;
      ok(['verde', 'amarelo', 'vermelho'].indexOf(v.cor) >= 0, onde + ': cor inválida «' + v.cor + '»');
      ok(v.nota === null || (v.nota >= 0 && v.nota <= 100), onde + ': nota fora de 0-100 (' + v.nota + ')');
      ok(typeof v.frase === 'string' && v.frase.length > 0, onde + ': frase vazia');
      ok(Array.isArray(v.factores) && v.factores.length >= 4, onde + ': factores a menos');
      /* Um dia vetado nunca pode mostrar nota — «Nota 94» ao lado de «Hoje não»
         destruiria a confiança em tudo o resto. */
      ok(!(v.vetos && v.vetos.length) || v.nota === null, onde + ': tem veto E mostra nota ' + v.nota);
      /* E o contrário: sem veto tem sempre nota. */
      ok((v.vetos && v.vetos.length) || v.nota !== null, onde + ': sem veto e sem nota');
      /* A cor não pode contrariar a nota. */
      if (v.nota !== null) {
        ok(!(v.nota >= 70 && v.cor === 'vermelho'), onde + ': nota ' + v.nota + ' mas vermelho');
        ok(!(v.nota < 45 && v.cor === 'verde'), onde + ': nota ' + v.nota + ' mas verde');
      }
      if (d === 0) contagem[v.cor]++;
    });

    /* Praia de rio: não pode inventar temperatura da água nem ondas. */
    if (!p.m) {
      var temAgua = veredictos[0].factores.some(function (f) { return f.id === 'agua'; });
      ok(!temAgua, rot + ': praia de rio com factor de água');
      ok(dias[0].ondas == null, rot + ': praia de rio com ondulação');
    }

    /* A nota tem de ser a proporção dos pontos obtidos sobre os pesos que
       existem nesta praia — é assim que uma praia de rio, que não tem factor
       de água, continua a ter uma escala que vai a 100. */
    var usaveis = veredictos[0].factores.filter(function (f) { return f.pontos != null; });
    var pesoTotal = usaveis.reduce(function (s, f) { return s + f.peso; }, 0);
    var obtidos = usaveis.reduce(function (s, f) { return s + f.pontos; }, 0);
    ok(pesoTotal > 0, rot + ': nenhum factor utilizável');
    if (veredictos[0].nota !== null) {
      ok(Math.abs(veredictos[0].nota - Math.round(obtidos / pesoTotal * 100)) <= 0,
         rot + ': a nota ' + veredictos[0].nota + ' não bate com ' + obtidos + '/' + pesoTotal);
    }
    ok(Math.abs(pesoTotal - (p.m ? 100 : 86)) < 0.6,
       rot + ': pesos ' + pesoTotal.toFixed(1) + ' (esperado ' + (p.m ? 100 : 86) + ')');

    var vento = dias[0].vento;
    if (vento != null && (vento < 0 || vento > 150)) avisos.push(rot + ': vento improvável ' + vento + ' km/h');
    if (dias[0].agua != null && (dias[0].agua < 5 || dias[0].agua > 32)) {
      avisos.push(rot + ': água improvável ' + dias[0].agua.toFixed(1) + ' °C');
    }
  });

  console.log('  hoje: ' + contagem.verde + ' verdes · ' + contagem.amarelo
    + ' amarelas · ' + contagem.vermelho + ' vermelhas');
  console.log('  ' + testes + ' verificações');
  if (avisos.length) {
    console.log('\n  valores estranhos (não são falhas, mas vale a pena ver):');
    avisos.slice(0, 10).forEach(function (a) { console.log('    ⚠ ' + a); });
  }
  console.log('\n' + '='.repeat(56));
  if (falhas.length) {
    console.log('✗ ' + falhas.length + ' FALHAS');
    falhas.slice(0, 20).forEach(function (f) { console.log('  - ' + f); });
  } else {
    console.log('✓ nenhuma praia produziu um resultado impossível');
  }
  console.log('='.repeat(56));
  process.exit(falhas.length ? 1 : 0);
})();
