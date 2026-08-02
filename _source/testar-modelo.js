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
eq('vento 10 km/h', Modelo._pontos.vento(10), 26);
eq('vento 22 km/h (levanta areia)', Modelo._pontos.vento(22), 14);
eq('vento 30 km/h (nortada)', Modelo._pontos.vento(30), 6);
eq('água 18,5 °C (costa oeste típica)', Modelo._pontos.agua(18.5), 9);
eq('água 24 °C (Madeira)', Modelo._pontos.agua(24), 16);
eq('água 13 °C', Modelo._pontos.agua(13), 0);
eq('ar 28 °C', Modelo._pontos.ar(28), 20);
eq('céu 10 %', Modelo._pontos.ceu(10), 28);

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
// Trovoada: veto mesmo com tudo o resto bom
cor('Trovoada (veto)', {ceu:10, vento:8, ar:29, agua:22, chuva:40, mm:1, ondas:0.5,
  rajada:20, dirVento:200, lat:37.08, lon:-8.25, mar:true, trovoada:true}, 'vermelho');
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
