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

/* O FUNDO DA CURVA DO CÉU. Esteve plano dos 90 aos 100 % desde o primeiro dia:
   0 % de sol dava os mesmos pontos que 10 %, e nenhuma conta dava por isso
   porque nenhuma olhava para lá dos 90. Duas asserções, e as duas são leis e
   não valores:
     1. a curva TEM de continuar a descer até aos 100 %. Um céu totalmente
        tapado não pode valer o mesmo que um céu com abertas.
     2. o céu NÃO pode, sozinho, pintar um dia de vermelho. A regra do factor
        limitante manda para vermelho abaixo de 0,08 do peso; nenhuma das três
        fontes de praia sustenta que um céu tapado seja, por si, um «não vá» —
        e uma manhã em cada cinco em Agosto no noroeste é de céu tapado.
   A segunda escreve-se em RÁCIO e não em pontos, para sobreviver a uma
   mudança de peso: foi exactamente uma mudança de peso (28 -> 26) que deixou o
   fundo por reescalar e criou o patamar. */
{
  const ceu = Modelo._pontos.ceu;
  eq('a curva do céu continua a descer dos 90 aos 100 %', ceu(100) < ceu(90), true);
  eq('  e não tem patamar nenhum no topo', ceu(95) > ceu(100) && ceu(90) > ceu(95), true);
  const racio = ceu(100) / Modelo.PESOS.ceu;
  eq('o céu sozinho não pinta um dia de vermelho (rácio > 0,08)', racio > 0.08, true);
  console.log('    céu a 100 % de nuvens: ' + ceu(100) + ' pontos, rácio ' + racio.toFixed(3));
}

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
  /* A nota deixou de desaparecer: um dia vetado TEM nota, e ela cai na banda
     do vermelho. Era `null` até 23 de Agosto de 2026, e 38,9 % das partes-dia
     ficavam sem número nenhum. */
  eq('e com nota, na banda do vermelho', mau.nota != null && mau.nota < 45, true);
  eq('e a nota abaixo do que ele valia sem o veto', mau.nota < mau.notaBruta, true);
  eq('vetado pela chuva, não pela trovoada', mau.vetos.indexOf('chuva quase certa') >= 0, true);
}

console.log('\n== a trovoada exige acordo entre modelos ==');
{
  /* Constrói uma resposta da API com quatro modelos e faz variar quantos é
     que vêem trovoada às 15h. Testa o caminho a sério — consenso + agregar —
     e não uma função interna, porque foi no consenso que o defeito viveu:
     ele colapsava os quatro códigos no MÁXIMO, e a partir daí ninguém
     conseguia saber que só um deles é que tinha visto trovoada. */
  const MOD = ['ecmwf_ifs025', 'icon_seamless', 'gfs_seamless', 'ukmo_seamless'];
  const HORAS = 24;
  function resposta(quantosVeem) {
    const h = { time: [] };
    for (let i = 0; i < HORAS; i++) h.time.push(`2026-08-08T${String(i).padStart(2,'0')}:00`);
    const serie = (v) => new Array(HORAS).fill(v);
    for (const m of MOD) {
      h['temperature_2m_' + m] = serie(26);
      h['apparent_temperature_' + m] = serie(27);
      h['wind_speed_10m_' + m] = serie(12);
      h['wind_gusts_10m_' + m] = serie(20);
      h['wind_direction_10m_' + m] = serie(300);
      h['cloud_cover_' + m] = serie(15);
      h['precipitation_' + m] = serie(0);
      h['precipitation_probability_' + m] = serie(10);
      h['uv_index_' + m] = serie(6);
      h['weather_code_' + m] = serie(1);
    }
    /* às 15h, os `quantosVeem` primeiros modelos vêem trovoada */
    for (let k = 0; k < quantosVeem; k++) h['weather_code_' + MOD[k]][15] = 95;
    return { hourly: h, daily: { time: ['2026-08-08'], weather_code: [1], precipitation_sum: [0] } };
  }
  const praia = { la: 41, lo: -8.8, m: 1 };
  const trovoadaCom = (n) => Modelo.agregar(Modelo.consenso(resposta(n), MOD), null, praia)[0].trovoada;

  eq('0 modelos: sem trovoada', trovoadaCom(0), false);
  eq('1 modelo em 4: NÃO conta', trovoadaCom(1), false);
  eq('2 modelos em 4: conta', trovoadaCom(2), true);
  eq('3 modelos: conta', trovoadaCom(3), true);
  eq('4 modelos: conta', trovoadaCom(4), true);

  /* e o weather_code continua a ser o máximo, que é usado noutro sítio */
  const c = Modelo.consenso(resposta(1), MOD);
  eq('o weather_code continua a ser o pior dos quatro', c.hourly.weather_code[15], 95);
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
/* A REGRA NOVA: o veto entra na NOTA em vez de a apagar. A nota tem de existir,
   tem de cair na banda do vermelho, e tem de ser menor do que a soma crua. */
if (vt.nota == null) { falhas++; console.log('  ✗ dia vetado ficou sem nota nenhuma'); }
else if (vt.nota >= 45) { falhas++; console.log('  ✗ dia vetado com nota ' + vt.nota + ', fora da banda do vermelho'); }
else if (vt.nota >= vt.notaBruta) { falhas++; console.log('  ✗ o veto não baixou a nota: ' + vt.nota + ' contra ' + vt.notaBruta); }
else console.log(`  ✓ dia vetado mostra ${vt.nota}, dentro do vermelho (valia ${vt.notaBruta})`);
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

console.log('\n== a janela parte-se, e o dia não muda ==');
{
  /* Uma resposta de quatro modelos com 24 horas, para exercitar o caminho a
     sério: consenso -> agregar / agregarJanela. */
  const MOD = ['ecmwf_ifs025', 'icon_seamless', 'gfs_seamless', 'ukmo_seamless'];
  const BASES = ['temperature_2m', 'apparent_temperature', 'wind_speed_10m', 'wind_gusts_10m',
                 'cloud_cover', 'precipitation', 'precipitation_probability', 'uv_index',
                 'wind_direction_10m'];
  const PADRAO = { temperature_2m: 26, apparent_temperature: 28, wind_speed_10m: 8,
                   wind_gusts_10m: 18, cloud_cover: 15, precipitation: 0,
                   precipitation_probability: 0, uv_index: 7, wind_direction_10m: 200 };
  const PRAIA = { n: 'Teste', la: 41.0, lo: -8.65, m: 1 };

  /* horasPorDia: função (dia) -> lista de horas inteiras a incluir */
  function resposta(dias, horasPorDia) {
    const h = { time: [] };
    dias.forEach((d) => (horasPorDia ? horasPorDia(d) : [...Array(24).keys()])
      .forEach((i) => h.time.push(`${d}T${String(i).padStart(2, '0')}:00`)));
    MOD.forEach((m) => {
      BASES.forEach((b) => { h[b + '_' + m] = h.time.map(() => PADRAO[b]); });
      h['weather_code_' + m] = h.time.map(() => 1);
    });
    return { hourly: h, daily: { time: dias, precipitation_sum: dias.map(() => 0),
                                weather_code: dias.map(() => 1) } };
  }
  function marOndas(dias) {
    const t = [];
    dias.forEach((d) => { for (let i = 0; i < 24; i++) t.push(`${d}T${String(i).padStart(2, '0')}:00`); });
    return { hourly: { time: t, sea_surface_temperature: t.map(() => 19), wave_height: t.map(() => 0.6) } };
  }

  const D = '2026-08-08';
  const cons = Modelo.consenso(resposta([D]), MOD);
  const mar = marOndas([D]);

  /* O refactor não pode ter mudado um número: a janela inteira pela função
     nova, mais os dois campos que vêm do bloco diário, tem de dar exactamente
     o que a agregar() dá. Isto apanha alguém a trocar um `media` por um
     `maximo`, a perder um arredondamento ou a esquecer um campo ao mexer
     naquele corpo. */
  const viaAgregar = Modelo.agregar(cons, mar, PRAIA)[0];
  const viaJanela = Modelo.agregarBlocos(cons, mar, PRAIA, D, Modelo.BLOCOS_DIA);
  viaJanela.mmDia = 0; viaJanela.codigo = 1;
  eq('agregarBlocos(a janela toda) === agregar()', viaJanela, viaAgregar);

  /* ...mas a identidade acima compara o código consigo próprio, e por isso não
     apanha uma alteração que mexa nos DOIS lados ao mesmo tempo. Provado por
     mutação: trocar `media` por `maximo` nas nuvens sobrevivia a tudo o que
     estava escrito aqui. O que fecha esse buraco são valores FIXADOS, sobre um
     fixture em que cada estatística dá um número diferente das outras — se
     média, máximo, soma e percentil derem todos o mesmo, o teste não distingue
     nenhuma delas. */
  const variado = resposta([D]);
  MOD.forEach((m) => {
    const porHora = (f) => variado.hourly.time.map((t) => f(+t.slice(11, 13)));
    /* Os valores crescem com a hora, e a janela do dia são DEZ horas
       (9-13 e 15-19; as 14h ficam de fora). Se alguém voltar a agregar o
       intervalo contínuo 9h-19h, as 14h entram e estes números mudam todos —
       que é precisamente o que estas asserções existem para apanhar. */
    variado.hourly['cloud_cover_' + m] = porHora((hr) => (hr - 9) * 10);
    variado.hourly['wind_speed_10m_' + m] = porHora((hr) => hr * 2);
    variado.hourly['apparent_temperature_' + m] = porHora((hr) => 20 + (hr - 9));
    variado.hourly['precipitation_' + m] = porHora(() => 0.1);
    variado.hourly['precipitation_probability_' + m] = porHora((hr) => (hr - 9) * 5);
  });
  const cv = Modelo.consenso(variado, MOD);
  const jv = Modelo.agregarBlocos(cv, null, PRAIA, D, Modelo.BLOCOS_DIA);
  eq('nuvens pela MÉDIA das dez horas (0..100, sem as 14h)', jv.ceu, 50);
  eq('calor pelo MÁXIMO (20..30)', jv.ar, 30);
  eq('vento pelo p75 (18..38)', jv.vento, 34);
  eq('vento mínimo pelo p10', jv.ventoMin, 20);
  eq('vento máximo pelo máximo', jv.ventoMax, 38);
  eq('milímetros pela SOMA dentro da janela', Math.round(jv.mm * 100) / 100, 1);
  eq('probabilidade de chuva pelo MÁXIMO', jv.chuva, 50);
  /* E a prova de que as 14h ficam MESMO de fora: com o intervalo contínuo, as
     dez horas passam a onze e cada uma destas estatísticas muda. */
  const contiguo = Modelo.agregarJanela(cv, null, PRAIA, D, Modelo.HORA_INI, Modelo.HORA_FIM);
  eq('o intervalo contínuo 9h-19h vê MAIS uma hora (as 14h)',
     [contiguo.ceu, contiguo.ar, Math.round(contiguo.mm * 100) / 100], [50, 30, 1.1]);
  eq('  e por isso o dia NÃO se agrega assim', contiguo.mm !== jv.mm, true);

  /* A guarda que impede o «vermelho confiante»: sem horas no intervalo, a
     função devolve null e quem chama tem de decidir. Um objecto vazio passado
     ao classificarDia sai de lá VERMELHO, com frase e sem um único veto. */
  eq('intervalo sem horas nenhumas -> null', Modelo.agregarJanela(cons, mar, PRAIA, D, 25, 26), null);
  eq('dia que a resposta não cobre -> null',
     Modelo.agregarJanela(cons, mar, PRAIA, '2031-01-01', Modelo.HORA_INI, Modelo.HORA_FIM), null);
  eq('e é por isso que a guarda existe: classificarDia({}) diz',
     Modelo.classificarDia({}).cor, 'vermelho');

  /* Mas a agregar() NÃO pode propagar esse null: o array é indexado pelo dia
     escolhido e o app.js lê d.uv sem perguntar. Um null no meio deixava a
     página com o HTML e mais nada. */
  const soMadrugada = Modelo.consenso(resposta([D], () => [0, 1, 2, 3, 4, 5]), MOD);
  const vazio = Modelo.agregar(soMadrugada, null, PRAIA)[0];
  eq('dia sem horas na janela continua a ser um objecto', vazio !== null && typeof vazio === 'object', true);
  eq('  com os campos todos a null', [vazio.vento, vazio.ceu, vazio.ar, vazio.uv], [null, null, null, null]);
  eq('  e sem trovoada inventada', vazio.trovoada, false);

  /* As metades medem-se com as mesmas contas, e cada uma nas SUAS horas.
     Uma resposta em que o vento é 10 até às 14h e 40 a partir das 15h: se o
     corte estiver no sítio certo, a manhã não vê um único 40 e a tarde não vê
     um único 10. Com um fixture uniforme este teste passaria sempre — foi
     assim que ele estava escrito à primeira. */
  const porHora = resposta([D]);
  MOD.forEach((m) => {
    porHora.hourly['wind_speed_10m_' + m] = porHora.hourly.time.map((t) =>
      +t.slice(11, 13) >= Modelo.PARTES[1].ini ? 40 : 10);
  });
  const consH = Modelo.consenso(porHora, MOD);
  const aH = Modelo.avaliarDia(consH, mar, PRAIA, D);
  eq('a manhã só vê as horas antes do corte',
     [aH.partes[0].d.ventoMin, aH.partes[0].d.ventoMax], [10, 10]);
  eq('e a tarde só vê as de depois',
     [aH.partes[1].d.ventoMin, aH.partes[1].d.ventoMax], [40, 40]);
  eq('o dia inteiro vê as duas', [Modelo.agregarBlocos(consH, mar, PRAIA, D, Modelo.BLOCOS_DIA).ventoMin,
                                  Modelo.agregarBlocos(consH, mar, PRAIA, D, Modelo.BLOCOS_DIA).ventoMax], [10, 40]);

  /* A RAZÃO, sem o prefixo da frase. É o que a interface usa quando é uma
     PARTE do dia a falar: «Dá para ir, mas está muito vento» dito por cima de
     uma tarde vermelha seria mentira, e um segundo gerador de frases a dizer o
     mesmo de outra maneira foi como se chegou a ter quatro na mesma caixa. */
  const BASE_RAZAO = { vento: 12, ar: 27, agua: 20, chuva: 0, mm: 0, ondas: 0.6,
                       rajada: 22, dirVento: 350, lat: 38.68, lon: -9.34,
                       mar: true, trovoada: false };
  const semRazao = [];
  [['verde limpo', { vento: 8, ceu: 10 }],
   ['verde com ressalva', { vento: 8, ceu: 10, agua: 15 }],
   ['amarelo', { vento: 31 }],
   ['vermelho', { vento: 40 }],
   ['vetado', { chuva: 90 }]].forEach(([rot, extra]) => {
    const v = Modelo.classificarDia({ ...BASE_RAZAO, ...extra });
    if (typeof v.razao !== 'string' || !v.razao.length) semRazao.push(rot + ' -> ' + JSON.stringify(v.razao));
    /* A razão é só a razão: sem o veredicto colado à frente. É esse o defeito
       que ela existe para evitar — «Dá para ir, mas está muito vento» impresso
       por cima de uma tarde vermelha diz uma coisa e o bloco diz a contrária.
       (A razão pode ser MAIS específica do que a frase, e isso é bom: num dia
       verde com uma ressalva ligeira a frase é «Bom dia de praia.» e a razão
       diz qual é o factor mais fraco.) */
    if (/^(dá para ir|fica para outro dia|não vale a pena|não vá|bom dia de praia|está tudo a favor,)/i.test(v.razao)) {
      semRazao.push(rot + ': a razão traz o veredicto colado — «' + v.razao + '»');
    }
    if (/[.]$/.test(v.razao)) semRazao.push(rot + ': a razão acaba em ponto — «' + v.razao + '»');
  });
  eq('toda a classificação tem razão, e a razão é só a razão', semRazao, []);

  /* O detector das horas saiu, e com ele a maquinaria toda. Se voltar sem
     medição, isto lembra que a medição existe em _source/medir-portao.js. */
  /* A armadilha: `dias.map(classificarDia)` passa o ÍNDICE como segundo
     argumento. Quando esse argumento era um número, o dia 0 saía com nota 0 —
     em silêncio, com cor e frase de dia péssimo. Um objecto torna-o inócuo. */
  {
    const d3 = { ...BASE_RAZAO };
    const porMap = [d3, d3, d3].map(Modelo.classificarDia);
    eq('map(classificarDia) não impõe o índice como nota',
       porMap.map((x) => x.nota), [porMap[0].notaPropria, porMap[0].notaPropria, porMap[0].notaPropria]);
    eq('  e a nota imposta continua a funcionar pela via certa',
       Modelo.classificarDia(d3, { nota: 42 }).nota, 42);
  }

  eq('o detector da frase das horas já não existe',
     ['metadesDoDia', 'conselhoMetades', 'LIMIAR_METADES', 'PRAZO_METADES']
       .filter((k) => k in Modelo), []);
}

console.log('\n== a cor sai da nota, e só dela ==');
/* A queixa que originou isto: um dia VERMELHO com 61 ao lado de um AMARELO com
   52. A cor era decidida à parte da nota, e as bandas sobrepunham-se — medido
   em 13 648 partes-dia: verde 70-94, amarelo 45-83, vermelho 22-77, com 40,4 %
   dos vermelhos a valer mais do que o amarelo mais baixo. */
(function () {
  var base = { dia: '2026-08-24', ceu: 20, ar: 26, arReal: 25, vento: 8, ventoMin: 6,
    ventoMax: 10, rajada: 14, dirVento: 200, chuva: 0, mm: 0, agua: 20, ondas: 0.8,
    uv: 7, trovoada: false, lat: 41, lon: -8.7, mar: true };
  var casos = [
    ['dia bom', {}], ['chuva a sério', { chuva: 80, mm: 5 }],
    ['vento 38 km/h', { vento: 38, rajada: 55 }], ['céu tapado', { ceu: 85 }],
    ['mar cavado', { ondas: 3.2 }], ['frio a mais', { ar: 14, arReal: 13 }],
    ['rajadas perigosas', { rajada: 80 }], ['chuva quase certa', { chuva: 85 }],
  ];
  var maus = [];
  casos.forEach(function (c) {
    var v = Modelo.classificarDia(Object.assign({}, base, c[1]));
    if (v.nota == null) { maus.push(c[0] + ' ficou sem nota'); return; }
    var esperada = v.nota >= 70 ? 'verde' : (v.nota >= 45 ? 'amarelo' : 'vermelho');
    if (v.cor !== esperada)
      maus.push(c[0] + ': nota ' + v.nota + ' devia dar ' + esperada + ' e deu ' + v.cor);
  });
  eq('a cor de cada caso é a que a nota manda', maus, []);

  /* E a penalização NUNCA sobe a nota. */
  var subiu = [];
  casos.forEach(function (c) {
    var v = Modelo.classificarDia(Object.assign({}, base, c[1]));
    if (v.nota != null && v.notaBruta != null && v.nota > v.notaBruta)
      subiu.push(c[0] + ': ' + v.notaBruta + ' -> ' + v.nota);
  });
  eq('a penalização nunca sobe a nota', subiu, []);

  /* O DIA é a média das partes, e nunca acima do que a sua penalização deixa.
     Sem o `min`, duas partes a 39 davam um dia a 17 — a penalização aplicada
     duas vezes. */
  var d = Object.assign({}, base, { chuva: 80, mm: 5 });
  var parte = Modelo.classificarDia(d);
  var dia = Modelo.classificarDia(d, { nota: parte.nota });
  eq('o dia com a média das partes não volta a ser penalizado', dia.nota, parte.nota);
})();

console.log('\n== a maré ==');
/* Um PATAMAR — duas horas com o mesmo valor no pico — satisfaz `>=` dos dois
   lados e era contado DUAS vezes: a maré saía «baixa-mar 05h00 · baixa-mar
   05h00». Não se apanha pelo ecrã, porque depende de o patamar calhar dentro
   das 9h-19h; apanha-se aqui. */
(function () {
  function serie(vals, dia) {
    return { time: vals.map(function (_, i) {
               return dia + 'T' + ('0' + i).slice(-2) + ':00'; }),
             sea_level_height_msl: vals };
  }
  /* baixa com PATAMAR às 3-4, preia às 9, baixa às 15, preia às 21 */
  var v = [0, -.5, -.9, -1.0, -1.0, -.9, -.5, 0, .6, 1.0, .6, 0, -.5, -.9, -1.0, -1.05, -1.0, -.9, -.5, 0, .6, 1.0, .6, 0];
  var r = Modelo._extremosMare(serie(v, '2026-08-22'), '2026-08-22') || [];
  var seguidos = r.filter(function (x, i) { return i && x.tipo === r[i - 1].tipo; });
  eq('um patamar conta uma vez, não duas', seguidos.length, 0);
  eq('e os extremos alternam preia/baixa',
     r.map(function (x) { return x.tipo; }).join(','), 'baixa,preia,baixa,preia');

  /* Os +30 min do desfasamento medido contra quatro marégrafos do IOC (Vigo,
     Marín, Cascais e Huelva): esta fonte é a média horária do Copernicus
     carimbada no INÍCIO do intervalo e vem adiantada. O pico desta série está
     exactamente às 9h; com a correcção tem de sair às 9h30. */
  var pico = r.filter(function (x) { return x.tipo === 'preia'; })[0];
  eq('o pico leva os +30 min medidos contra os marégrafos',
     ('0' + pico.h).slice(-2) + 'h' + ('0' + pico.min).slice(-2), '09h30');

  /* Sem dados de mar (praia de rio) não há maré, e não rebenta. */
  eq('sem dados de mar devolve null', Modelo._extremosMare(null, '2026-08-22'), null);
  eq('com a coluna em falta devolve null',
     Modelo._extremosMare({ time: ['2026-08-22T00:00'] }, '2026-08-22'), null);
})();

/* ============================================================
   O TECTO DO DIA CONTRA AS PARTES: ESPÉCIE COM ESPÉCIE
   ============================================================
   Isto tem de viver AQUI, em dados sintéticos, e não no testar-praias.js:
   lá a asserção é a mesma mas corre sobre a previsão de hoje, e o caso é raro
   de mais — 0 em 300 dias-praia reais. Testei as duas mutações contra o
   testar-praias.js e AS DUAS PASSARAM. Uma guarda que só apanha o defeito
   quando o tempo colabora não é uma guarda.

   As duas espécies de penalização não são da mesma grandeza:
     GRAVE  = veto, ou factor limitante abaixo de 0,08 -> tecto ≈ 44 % da soma
     LEVE   = despromoção (limitante < 0,40, ou céu > 60 %) -> tecto 69
   O tecto do dia dispensa-se quando as PARTES já carregam o mesmo castigo,
   porque a média delas já o traz. Mas só da MESMA espécie: uma parte apenas
   despromovida não chega para dispensar o tecto de um veto do dia. Esteve a
   chegar durante um dia, e apanhou-se na Praia dos Namorados a 26/08/2026 —
   veto de «chuva a sério» com 2,88 mm, as duas partes só despromovidas, e o
   dia saía 69 AMARELO em vez de 33 vermelho. */
(function () {
  console.log('\n== o tecto do dia: espécie com espécie ==');
  var BOM   = { ceu: 10, vento: 10, ar: 26, chuva: 5, agua: 20, mm: 0, ondas: 0.8, mar: true };
  var GRAVE = Object.assign({}, BOM, { mm: 3 });        /* veto: chuva a sério */
  var RACIO = Object.assign({}, BOM, { vento: 40 });    /* limitante < 0,08 */
  var LEVE  = Object.assign({}, BOM, { ceu: 70 });      /* despromoção */

  eq('o dia limpo não tem espécie', Modelo.classificarDia(BOM).penalizacao, null);
  eq('o veto é grave',              Modelo.classificarDia(GRAVE).penalizacao, 'grave');
  eq('o limitante baixo é grave',   Modelo.classificarDia(RACIO).penalizacao, 'grave');
  eq('a despromoção é leve',        Modelo.classificarDia(LEVE).penalizacao, 'leve');

  function nota(d, media, penal, grave) {
    return Modelo.classificarDia(d, { nota: media, partesJaPenalizadas: penal,
                                      algumaParteGrave: grave }).nota;
  }
  /* tectos deste cenário: GRAVE bruta 93 -> 41 · RACIO bruta 62 -> 27 · LEVE 69 */

  /* 1. o dia grave, com as partes limpas: o tecto morde. É para isto que existe. */
  eq('grave + partes limpas -> tecto',            nota(GRAVE, 80, false, false), 41);
  eq('limitante baixo + partes limpas -> tecto',  nota(RACIO, 80, false, false), 27);

  /* 2. O DEFEITO. O dia grave com as partes apenas DESPROMOVIDAS: o castigo
     leve delas não paga o grave dele, e o tecto tem de morder na mesma. */
  eq('grave + partes só despromovidas -> tecto',  nota(GRAVE, 80, true, false), 41);
  eq('limitante baixo + só despromovidas -> tecto', nota(RACIO, 80, true, false), 27);

  /* 3. o dia grave com alguma parte grave: a média dela já traz o castigo,
     e voltar a aplicá-lo é contá-lo duas vezes. É a média que manda. */
  eq('grave + alguma parte grave -> a média',     nota(GRAVE, 80, true, true), 80);
  eq('limitante baixo + parte grave -> a média',  nota(RACIO, 80, true, true), 80);

  /* 4. o dia leve: qualquer penalização nas partes chega para o dispensar,
     porque não há castigo mais leve do que o dele. */
  eq('leve + partes limpas -> tecto 69',          nota(LEVE, 74, false, false), 69);
  eq('leve + alguma parte despromovida -> média', nota(LEVE, 74, true, false), 74);
  eq('leve + alguma parte grave -> a média',      nota(LEVE, 74, true, true), 74);

  /* 5. o dia sem penalização nenhuma é sempre a média, aconteça o que
     acontecer às partes — o tecto devolve null e o `min` não morde. */
  eq('sem penalização -> a média, partes limpas', nota(BOM, 74, false, false), 74);
  eq('sem penalização -> a média, partes graves', nota(BOM, 74, true, true), 74);

  /* 6. E A COR SAI DA NOTA, SEM EXCEPÇÃO — nem com um veto pendurado. Um dia
     com veto cuja média das partes dá 80 é VERDE, e a nota di-lo. */
  eq('a cor segue a nota mesmo com veto',
     Modelo.classificarDia(GRAVE, { nota: 80, partesJaPenalizadas: true, algumaParteGrave: true }).cor,
     'verde');
  eq('e o veto continua lá para quem o queira',
     Modelo.classificarDia(GRAVE, { nota: 80, partesJaPenalizadas: true, algumaParteGrave: true })
       .vetos.length > 0, true);
})();

console.log(`\n${falhas === 0 ? '✓ TODOS OS TESTES PASSARAM' : '✗ ' + falhas + ' FALHAS'}\n`);
process.exit(falhas ? 1 : 0);
