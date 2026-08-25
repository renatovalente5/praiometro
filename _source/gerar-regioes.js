/* A REGIÃO DE CADA PRAIA PASSA A SER DERIVADA, e não escrita à mão.
   =============================================================
   Correr:  node _source/gerar-regioes.js            (escreve)
            node _source/gerar-regioes.js --verificar (só compara)

   PORQUÊ. O campo `r` do data/praias.json foi atribuído uma vez e nunca mais
   teve dono. Medido: 6 concelhos apareciam repartidos por duas regiões, e 15
   praias estavam num hub que discorda da maioria do seu próprio concelho —
   uma praia da Tróia listada em «Lisboa e Setúbal» ao lado de doze irmãs em
   «Alentejo», uma de Odemira no «Algarve». Quem abre /praias/alentejo/ não as
   encontra, e não há nada no ecrã que explique porquê.

   A REGRA. Um concelho pertence a UMA região. A região de uma praia é a do seu
   concelho, e o concelho vem da CAOP (ver gerar-concelhos.py), pelo código
   oficial `dico` — e não pelo nome, porque há dois «Lagoa», um no Algarve e
   outro em São Miguel.

   COMO SE DECIDE A REGIÃO DE UM CONCELHO. Por maioria do que já lá está: é o
   que preserva a taxonomia que o autor escolheu, que não é exactamente a NUTS
   II (o Oeste está com Lisboa, e não com o Centro, tal como na página da
   nortada). A maioria é conservadora de propósito — corrige o inconsistente
   sem redesenhar o mapa.

   E OS EMPATES NÃO SE DECIDEM POR MAIORIA. Espinho estava 4-4, e um empate
   resolvido pela ordem de um dicionário não é uma decisão: é um sorteio que
   muda quando alguém acrescentar uma praia. Os empates vivem na tabela abaixo,
   escritos à mão e com a razão à frente. Um empate novo pára o gerador. */
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.dirname(__dirname);
const PRAIAS = path.join(RAIZ, 'data', 'praias.json');
const CONCELHOS = path.join(RAIZ, '_build', 'dados', 'concelhos.json');
const DESTINO = path.join(RAIZ, '_build', 'dados', 'regioes.json');

/* AS DECISÕES À MÃO, e são de dois tipos: empates, e concelhos que ainda não
   tinham praia nenhuma no site — nesses não há maioria de que herdar. A chave é
   o código `dico` da CAOP, e não o nome: há dois «Lagoa». */
const DESEMPATE = {
  /* Espinho é do distrito de Aveiro, mas da Área Metropolitana do Porto, e
     todos os concelhos à volta dele — Vila Nova de Gaia, Santa Maria da Feira,
     Ovar — estão no Norte neste site. Quatro praias de Espinho estavam no
     Norte e quatro no Centro, o que dava um 4-4. */
  '0107': 'Norte',
  /* Mourão é do distrito de Évora e fica na albufeira do Alqueva: Alentejo sem
     margem para dúvida. Estava 1-1 porque só tem duas praias no ficheiro, uma
     delas marcada «Lisboa e Setúbal» — que é a 150 km. */
  '0708': 'Alentejo',
  /* Montalegre entrou com a primeira praia em 25/08/2026 — a Praia da Barca,
     no Cávado, dentro do Parque Nacional da Peneda-Gerês. Distrito de Vila
     Real, região Norte, como todos os concelhos à volta. Não é empate: é um
     concelho sem histórico de onde herdar. */
  '1706': 'Norte',
};

const praias = JSON.parse(fs.readFileSync(PRAIAS, 'utf8'));
const concelhos = JSON.parse(fs.readFileSync(CONCELHOS, 'utf8'));
const chave = (p) => `${p.la.toFixed(4)},${p.lo.toFixed(4)}`;

/* ------------------------------------------------------------ a tabela --- */
const votos = new Map();
let semConcelho = 0;
for (const p of praias) {
  const c = concelhos[chave(p)];
  if (!c) { semConcelho++; continue; }
  if (!votos.has(c.dico)) votos.set(c.dico, { nome: c.co, contas: new Map() });
  /* UMA REGIÃO VAZIA NÃO VOTA. As praias que chegam do OSM entram sem `r` — é
     este programa que lha dá — e deixá-las votar fazia com que uma praia nova
     sozinha no seu concelho elegesse «» como região desse concelho, e ficasse
     assim para sempre. O gerador dos hubs rebentava a seguir, com «região
     desconhecida: «»», o que pelo menos é uma falha barulhenta. */
  if (!p.r) continue;
  const contas = votos.get(c.dico).contas;
  contas.set(p.r, (contas.get(p.r) || 0) + 1);
}
if (semConcelho) {
  console.error(`✗ ${semConcelho} praias sem concelho conhecido.`);
  console.error('  Correr primeiro: python3 _source/gerar-concelhos.py');
  process.exit(1);
}

const tabela = {};
const empates = [];
const semVoto = [];
for (const [dico, { nome, contas }] of votos) {
  /* A decisão à mão vem PRIMEIRO: é ela que resolve tanto os empates como os
     concelhos sem histórico, e consultá-la depois deixava a queixa sair mesmo
     com a resposta escrita ao lado. */
  if (DESEMPATE[dico]) { tabela[dico] = DESEMPATE[dico]; continue; }
  if (!contas.size) { semVoto.push(`${dico} ${nome}`); continue; }
  const ordem = [...contas].sort((a, b) => b[1] - a[1]);
  if (ordem.length > 1 && ordem[0][1] === ordem[1][1]) {
    empates.push(`${dico} ${nome}: ${ordem.map(([r, n]) => `${r} ${n}`).join(' vs ')}`);
    continue;
  }
  tabela[dico] = ordem[0][0];
}
/* UM CONCELHO SEM UMA ÚNICA PRAIA COM REGIÃO não se pode resolver por maioria:
   não há maioria de nada. Acontece quando o OSM traz a primeira praia de um
   concelho que ainda não estava no site — e aí a decisão é de quem sabe onde
   fica, não de um programa. */
if (semVoto.length) {
  console.error(`✗ ${semVoto.length} concelho(s) só com praias novas, sem região para herdar:`);
  for (const c of semVoto) console.error('   ' + c);
  console.error('  Escrever a decisão no DESEMPATE, em _source/gerar-regioes.js, com a razão.');
  process.exit(1);
}
if (empates.length) {
  console.error(`✗ ${empates.length} concelho(s) empatados, e um empate não se resolve por maioria:`);
  for (const e of empates) console.error('   ' + e);
  console.error('  Escrever a decisão no DESEMPATE, em _source/gerar-regioes.js, com a razão.');
  process.exit(1);
}

/* ------------------------------------------------------------ aplicar ---- */
const mudam = [];
for (const p of praias) {
  const c = concelhos[chave(p)];
  const certa = tabela[c.dico];
  if (p.r !== certa) { mudam.push({ n: p.n, co: c.co, de: p.r, para: certa }); p.r = certa; }
}

const verificar = process.argv.includes('--verificar');
if (verificar) {
  if (mudam.length) {
    console.error(`✗ ${mudam.length} praias estão numa região que discorda do seu concelho:`);
    for (const m of mudam.slice(0, 8)) {
      console.error(`   ${m.n} (${m.co}): ${m.de} -> ${m.para}`);
    }
    console.error('  Correr: node _source/gerar-regioes.js');
    process.exit(1);
  }
  console.log(`✓ as ${praias.length} praias estão na região do seu concelho (${Object.keys(tabela).length} concelhos)`);
  process.exit(0);
}

if (mudam.length) {
  /* O ficheiro escreve-se com a mesma forma que tinha: uma linha por praia.
     Um JSON.stringify com indentação triplicava o tamanho de um ficheiro que é
     pedido a cada visita. */
  const corpo = praias.map((p) => JSON.stringify(p)).join(',\n');
  fs.writeFileSync(PRAIAS, '[\n' + corpo + '\n]\n');
  console.log(`${mudam.length} praias mudaram de região:`);
  for (const m of mudam) console.log(`   ${m.n} (${m.co}): ${m.de} -> ${m.para}`);
} else {
  console.log('nenhuma praia mudou de região');
}
fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
fs.writeFileSync(DESTINO, JSON.stringify(tabela) + '\n');
console.log(`_build/dados/regioes.json — ${Object.keys(tabela).length} concelhos`);
