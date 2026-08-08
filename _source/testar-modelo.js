/* Testes do modelo. Correm em Node, sem browser. */
const M = require('../assets/js/modelo.js') || globalThis.Modelo;
const Modelo = globalThis.Modelo;
let falhas = 0;
function eq(nome, obtido, esperado) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) { falhas++; console.log(`  ✗ ${nome}: obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`); }
  else console.log(`  ✓ ${nome}`);
}
function cor(nome, d, esperada) {
  const r = Modelo.classificarDia(d);
  const ok = r.cor === esperada;
  if (!ok) { falhas++; console.log(`  ✗ ${nome}: ${r.cor} (nota ${r.nota}) — esperado ${esperada}  «${r.frase}»`); }
  else console.log(`  ✓ ${nome}: ${r.cor} ${r.nota} — «${r.frase}»`);
}

console.log('\n== tabelas ==');
eq('vento 6 km/h (sem vento)', Modelo._pontos.vento(6), 34);
eq('vento 10 km/h', Modelo._pontos.vento(10), 31);
eq('vento 22 km/h (levanta areia)', Modelo._pontos.vento(22), 15);
eq('vento 30 km/h (nortada)', Modelo._pontos.vento(30), 7);
eq('água 18,5 °C (costa oeste típica)', Modelo._pontos.agua(18.5), 8);
eq('água 24 °C (Madeira)', Modelo._pontos.agua(24), 14);
eq('água 13 °C', Modelo._pontos.agua(13), 0);
eq('ar 28 °C', Modelo._pontos.ar(28), 18);
eq('céu 10 %', Modelo._pontos.ceu(10), 26);

console.log('\n== a trovoada avisa, não decide ==');
{
  const bom = {ceu:10, vento:8, ar:29, agua:22, chuva:40, mm:1, ondas:0.5,
               rajada:20, dirVento:200, lat:37.08, lon:-8.25, mar:true};
  const semT = Modelo.classificarDia({...bom, trovoada:false});
  const comT = Modelo.classificarDia({...bom, trovoada:true});
  eq('a nota não muda com a trovoada', comT.nota, semT.nota);
  eq('a cor não muda com a trovoada', comT.cor, semT.cor);
  eq('a nota continua visível', comT.nota !== null, true);
  eq('o aviso de segurança existe', comT.avisos, ['pode haver trovoada']);
  eq('e está marcado como perigo', comT.perigo, true);
  eq('sem trovoada não há aviso', comT.avisos.length - semT.avisos.length, 1);
  // mas um dia mesmo mau continua chumbado, e pela chuva
  const mau = Modelo.classificarDia({...bom, trovoada:true, chuva:85, mm:6, ceu:90});
  eq('dia de tempestade a sério continua vermelho', mau.cor, 'vermelho');
  eq('e sem nota', mau.nota, null);
  eq('vetado pela chuva, não pela trovoada', mau.vetos.indexOf('chuva quase certa') >= 0, true);
}

console.log('\n== dias reais ==');
// Um dia bom de Agosto em Carcavelos: sol, pouco vento, água a 18 °C
cor('Carcavelos, dia bom', {ceu:15, vento:14, ar:27, agua:18.3, chuva:5, mm:0, ondas:0.9,
  rajada:28, dirVento:340, lat:38.68, lon:-9.34, mar:true, trovoada:false}, 'verde');
// O mesmo dia com nortada instalada
cor('Carcavelos com nortada', {ceu:15, vento:31, ar:24, agua:18.0, chuva:5, mm:0, ondas:1.4,
  rajada:52, dirVento:350, lat:38.68, lon:-9.34, mar:true, trovoada:false}, 'amarelo');
// Nortada muito forte
cor('Nortada muito forte', {ceu:20, vento:38, ar:22, agua:17.5, chuva:5, mm:0, ondas:2.0,
  rajada:60, dirVento:355, lat:38.68, lon:-9.34, mar:true, trovoada:false}, 'vermelho');
// Trovoada NÃO chumba um dia bom. Foi veto até 6 de Agosto de 2026 e mediu-se
// antes de sair: em 720 dias-praia reais, as 11 vezes em que era o único veto
// seriam TODAS verdes sem ele, com nota média de 85. Um dia com trovoada a
// sério já é chumbado pela chuva — o veto só apanhava dias bons.
// (amarelo por causa dos 40 % de chuva e do factor limitante, NÃO da trovoada:
// o teste de baixo prova que sem ela a cor é exactamente a mesma.)
cor('Trovoada num dia bom', {ceu:10, vento:8, ar:29, agua:22, chuva:40, mm:1, ondas:0.5,
  rajada:20, dirVento:200, lat:37.08, lon:-8.25, mar:true, trovoada:true}, 'amarelo');
// Algarve sotavento em Agosto: o melhor cenário do país
cor('Monte Gordo, Agosto', {ceu:5, vento:11, ar:30, agua:22.5, chuva:0, mm:0, ondas:0.4,
  rajada:18, dirVento:180, lat:37.17, lon:-7.45, mar:true, trovoada:false}, 'verde');
// Praia de rio: sem água nem ondas, a escala tem de continuar a ir a 100
const rio = Modelo.classificarDia({ceu:10, vento:9, ar:29, agua:null, chuva:0, mm:0,
  ondas:null, rajada:20, dirVento:90, lat:40.05, lon:-7.95, mar:false, trovoada:false});
console.log(`  ✓ praia de rio: ${rio.cor} ${rio.nota} — «${rio.frase}»`);
if (rio.nota > 100 || rio.nota < 0) { falhas++; console.log('  ✗ nota fora de 0-100'); }
if (rio.factores.some(f => f.id === 'agua')) { falhas++; console.log('  ✗ praia de rio não devia ter factor água'); }
// Inverno na costa oeste
cor('Janeiro na Nazaré', {ceu:70, vento:24, ar:14, agua:14.5, chuva:60, mm:1.2, ondas:3.5,
  rajada:45, dirVento:270, lat:39.6, lon:-9.07, mar:true, trovoada:false}, 'vermelho');

console.log('\n== juntar os modelos (o bug da chuva fantasma) ==');
// Reproduz o caso real: quatro modelos com 0 mm de chuva mas probabilidade de
// 18%. Se a correspondência de colunas for por prefixo, a probabilidade entra
// na conta dos milímetros e o dia leva um veto de «chuva a sério».
const MODS = ['ecmwf_ifs025','icon_seamless','gfs_seamless','ukmo_seamless'];
const horas = ['2026-08-07T11:00','2026-08-07T12:00','2026-08-07T13:00'];
const resp = { hourly: { time: horas }, daily: { time: ['2026-08-07'] } };
MODS.forEach(m => {
  resp.hourly['precipitation_' + m] = [0, 0, 0];
  resp.hourly['precipitation_probability_' + m] = [18, 15, 20];
  resp.hourly['cloud_cover_' + m] = [10, 12, 8];
  resp.hourly['temperature_2m_' + m] = [26, 27, 28];
  resp.hourly['apparent_temperature_' + m] = [26, 27, 28];
  resp.hourly['wind_speed_10m_' + m] = [10, 12, 14];
  resp.hourly['wind_gusts_10m_' + m] = [20, 22, 24];
  resp.hourly['wind_direction_10m_' + m] = [350, 355, 5];
  resp.hourly['uv_index_' + m] = [7, 8, 8];
  resp.hourly['weather_code_' + m] = [1, 1, 2];
  resp.daily['precipitation_sum_' + m] = [0];
  resp.daily['weather_code_' + m] = [1];
});
const c = Modelo.consenso(resp, MODS);
const mmTotal = c.hourly.precipitation.reduce((a,b) => a + b, 0);
if (mmTotal > 0.01) {
  falhas++;
  console.log(`  ✗ chuva fantasma: ${mmTotal.toFixed(2)} mm de quatro modelos que dão 0 mm`);
  console.log('    (a probabilidade está a ser contada como milímetros)');
} else console.log('  ✓ quatro modelos a 0 mm dão 0 mm, apesar de 18% de probabilidade');
const probMedia = c.hourly.precipitation_probability[0];
if (Math.abs(probMedia - 18) > 0.01) { falhas++; console.log(`  ✗ probabilidade deu ${probMedia}, devia dar 18`); }
else console.log('  ✓ a probabilidade continua a ser lida como percentagem');
// a direcção não pode ser mediada entre modelos
if (c.hourly.wind_direction_10m[0] !== 350) { falhas++; console.log('  ✗ direcção devia vir de um modelo só'); }
else console.log('  ✓ a direcção vem de um modelo só, sem média entre modelos');

console.log('\n== o que a revisão apanhou ==');
// direcção é circular: a média de 350 e 10 tem de dar ~0, não 180
const dirs = Modelo._mediaDir ? Modelo._mediaDir([350,10]) : null;
if (dirs != null) {
  const bom = dirs < 15 || dirs > 345;
  if (!bom) { falhas++; console.log(`  ✗ média de 350° e 10° deu ${dirs.toFixed(0)}°, devia dar ~0°`); }
  else console.log(`  ✓ média circular de 350° e 10° dá ${dirs.toFixed(0)}°`);
}
// Um veto não pode deixar a nota à vista. O exemplo era a trovoada; desde que
// ela deixou de vetar, usa-se um veto a sério — rajadas acima de 65 km/h.
const vt = Modelo.classificarDia({ceu:5, vento:8, ar:29, agua:23, chuva:0, mm:0, ondas:0.4,
  rajada:80, dirVento:180, lat:37.08, lon:-8.25, mar:true, trovoada:false});
if (vt.nota !== null) { falhas++; console.log('  ✗ dia vetado ainda mostra nota ' + vt.nota); }
else console.log(`  ✓ dia vetado não mostra nota (bruta era ${vt.notaBruta})`);
if (!vt.perigo) { falhas++; console.log('  ✗ rajadas perigosas deviam marcar perigo'); }
else console.log('  ✓ veto de segurança marcado como perigo');
if (!/^Não vá/.test(vt.frase)) { falhas++; console.log('  ✗ frase de perigo devia ser mais forte: ' + vt.frase); }
else console.log(`  ✓ frase de perigo: «${vt.frase}»`);
// frio não é perigo, é desconforto
const fr = Modelo.classificarDia({ceu:20, vento:10, ar:14, agua:15, chuva:0, mm:0, ondas:0.5,
  rajada:20, dirVento:180, lat:38.7, lon:-9.3, mar:true, trovoada:false});
if (fr.perigo) { falhas++; console.log('  ✗ frio não devia ser aviso de segurança'); }
else console.log('  ✓ frio é veto mas não é perigo');

console.log('\n== pouco vento vale mais? ==');
const base = {ceu:15, ar:27, agua:18.3, chuva:5, mm:0, ondas:0.9, rajada:20,
              dirVento:180, lat:38.68, lon:-9.34, mar:true, trovoada:false};
const calmo  = Modelo.classificarDia({...base, vento:6});
const brisa  = Modelo.classificarDia({...base, vento:15});
const ventoso= Modelo.classificarDia({...base, vento:22});
console.log(`  6 km/h -> ${calmo.nota} | 15 km/h -> ${brisa.nota} | 22 km/h -> ${ventoso.nota}`);
if (!(calmo.nota > brisa.nota && brisa.nota > ventoso.nota)) { falhas++; console.log('  ✗ a nota devia descer com o vento'); }
else console.log('  ✓ a nota desce à medida que o vento sobe');
if (calmo.nota - ventoso.nota < 15) { falhas++; console.log('  ✗ a diferença entre calmo e ventoso é pequena demais'); }
else console.log(`  ✓ entre sem vento e a levantar areia vão ${calmo.nota - ventoso.nota} pontos`);

console.log('\n== a frase nomeia a nortada? ==');
const n = Modelo.classificarDia({ceu:15, vento:31, ar:24, agua:18, chuva:5, mm:0, ondas:1.4,
  rajada:52, dirVento:350, lat:38.68, lon:-9.34, mar:true, trovoada:false});
console.log('  frase:', JSON.stringify(n.frase), '| nortada:', n.nortada);
if (!n.nortada) { falhas++; console.log('  ✗ devia ter detectado nortada'); }
// o mesmo vento no Algarve de sotavento NÃO é nortada
const a = Modelo.classificarDia({ceu:15, vento:31, ar:24, agua:22, chuva:5, mm:0, ondas:1.0,
  rajada:52, dirVento:350, lat:37.17, lon:-7.45, mar:true, trovoada:false});
if (a.nortada) { falhas++; console.log('  ✗ não devia chamar nortada no sotavento algarvio'); }
else console.log('  ✓ no sotavento algarvio não chama nortada');

console.log(`\n${falhas === 0 ? '✓ TODOS OS TESTES PASSARAM' : '✗ ' + falhas + ' FALHAS'}\n`);
process.exit(falhas ? 1 : 0);
