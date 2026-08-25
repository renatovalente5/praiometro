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

/* A TABELA. O DISTRITO é a base, e o concelho é a excepção.
   =============================================================
   Começou por ser decidido por MAIORIA do que já estava no ficheiro, e a
   maioria é um andaime que se caiu sozinho: em concelhos com uma ou duas
   praias ela elege o que lá estiver, certo ou errado. Deixou passar sete
   registos em distritos que são Alentejo inteiro — a Praia Fluvial de
   Monsaraz em «Lisboa e Setúbal», o Alamal em «Centro» — porque em cada um
   desses concelhos TODAS as praias estavam erradas, e a maioria de um conjunto
   errado é o erro.

   Agora a região sai do DISTRITO, e os concelhos que legitimamente divergem
   estão escritos um a um. É a divisão NUTS II, com uma excepção que é do
   autor deste site e não da estatística: o OESTE fica com Lisboa e não com o
   Centro, como na página da nortada. */
const DISTRITO = {
  'Aveiro': 'Centro',
  'Beja': 'Alentejo',
  'Braga': 'Norte',
  'Bragança': 'Norte',
  'Castelo Branco': 'Centro',
  'Coimbra': 'Centro',
  'Faro': 'Algarve',
  'Guarda': 'Centro',
  'Leiria': 'Centro',
  'Lisboa': 'Lisboa e Setúbal',
  'Portalegre': 'Alentejo',
  'Porto': 'Norte',
  'Santarém': 'Centro',
  'Setúbal': 'Lisboa e Setúbal',
  'Viana do Castelo': 'Norte',
  'Vila Real': 'Norte',
  'Viseu': 'Centro',
  'Évora': 'Alentejo',
  /* As ilhas trazem o arquipélago no nome do «distrito» da CAOP. */
  'Ilha Corvo (Açores)': 'Açores',
  'Ilha Terceira (Açores)': 'Açores',
  'Ilha das Flores (Açores)': 'Açores',
  'Ilha de São Miguel (Açores)': 'Açores',
  'Ilha do Faial (Açores)': 'Açores',
  'Ilha do Pico (Açores)': 'Açores',
  'Ilha de São Jorge (Açores)': 'Açores',
  'Ilha da Graciosa (Açores)': 'Açores',
  'Ilha de Santa Maria (Açores)': 'Açores',
  'Ilha da Madeira (Madeira)': 'Madeira',
  'Ilha de Porto Santo (Madeira)': 'Madeira',
};

/* Os concelhos que não seguem o distrito, pela chave `dico` da CAOP — e não
   pelo nome, porque há dois «Lagoa», um no Algarve e outro em São Miguel. */
const EXCEPCAO = {
  /* Área Metropolitana do Porto, em distrito de Aveiro. */
  '0106': 'Norte',   /* Castelo de Paiva */
  '0107': 'Norte',   /* Espinho */
  /* Douro, em distritos do Centro. */
  '0914': 'Norte',   /* Vila Nova de Foz Côa, distrito da Guarda */
  '1804': 'Norte',   /* Cinfães, distrito de Viseu */
  '1813': 'Norte',   /* Resende, distrito de Viseu */
  '1819': 'Norte',   /* Tabuaço, distrito de Viseu */
  /* Oeste e Lezíria do Tejo, que este site põe com Lisboa. */
  '1014': 'Lisboa e Setúbal',   /* Peniche, distrito de Leiria */
  '1404': 'Lisboa e Setúbal',   /* Alpiarça */
  '1406': 'Lisboa e Setúbal',   /* Cartaxo */
  '1407': 'Lisboa e Setúbal',   /* Chamusca */
  '1409': 'Lisboa e Setúbal',   /* Coruche */
  '1415': 'Lisboa e Setúbal',   /* Salvaterra de Magos */
  '1416': 'Lisboa e Setúbal',   /* Santarém */
  /* Alentejo Litoral, em distrito de Setúbal. */
  '1505': 'Alentejo',   /* Grândola */
  '1509': 'Alentejo',   /* Santiago do Cacém */
  '1513': 'Alentejo',   /* Sines */
};

const praias = JSON.parse(fs.readFileSync(PRAIAS, 'utf8'));
const concelhos = JSON.parse(fs.readFileSync(CONCELHOS, 'utf8'));
const chave = (p) => `${p.la.toFixed(4)},${p.lo.toFixed(4)}`;

/* ------------------------------------------------------------ a tabela --- */
const tabela = {};
const semDistrito = new Set();
let semConcelho = 0;
for (const p of praias) {
  const c = concelhos[chave(p)];
  if (!c) { semConcelho++; continue; }
  const r = EXCEPCAO[c.dico] || DISTRITO[c.di];
  if (!r) { semDistrito.add(`${c.di} (${c.co})`); continue; }
  tabela[c.dico] = r;
}
if (semConcelho) {
  console.error(`✗ ${semConcelho} praias sem concelho conhecido.`);
  console.error('  Correr primeiro: python3 _source/gerar-concelhos.py');
  process.exit(1);
}
/* UM DISTRITO QUE NÃO ESTÁ NA TABELA não se adivinha. Acontece quando a CAOP
   escreve o nome de outra maneira, ou quando entra a primeira praia de uma
   ilha que ainda não estava cá. */
if (semDistrito.size) {
  console.error(`✗ ${semDistrito.size} distrito(s) que a tabela não conhece:`);
  for (const d of semDistrito) console.error('   ' + d);
  console.error('  Escrever a região no DISTRITO, em _source/gerar-regioes.js.');
  process.exit(1);
}

/* ------------------------------------------------------------ aplicar ---- */
/* E O CONCELHO VAI PARA TODOS OS REGISTOS. Existia em 48 dos 996, curado à mão
   num ficheiro à parte — e há 50 nomes repetidos. A lista de sugestões mostra
   «concelho · região» quando o campo existe e só a região quando não existe,
   portanto quem escrevia «fluvial» via cinco linhas «Praia Fluvial — Norte»
   sem maneira de as distinguir. O concelho já está calculado para os 996, sai
   da mesma CAOP, e custa 2,1 KB comprimidos — que o campo de procura derivado
   já tinha pago três vezes. */
const mudam = [];
let comConcelho = 0;
for (const p of praias) {
  const c = concelhos[chave(p)];
  const certa = tabela[c.dico];
  if (p.r !== certa) { mudam.push({ n: p.n, co: c.co, de: p.r, para: certa }); p.r = certa; }
  if (p.c !== c.co) { p.c = c.co; comConcelho++; }
}

const verificar = process.argv.includes('--verificar');
if (verificar) {
  if (comConcelho) {
    console.error(`✗ ${comConcelho} praias sem o concelho certo no ficheiro.`);
    console.error('  Correr: node _source/gerar-regioes.js');
    process.exit(1);
  }
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

if (mudam.length || comConcelho) {
  /* O ficheiro escreve-se com a mesma forma que tinha: uma linha por praia.
     Um JSON.stringify com indentação triplicava o tamanho de um ficheiro que é
     pedido a cada visita. */
  const corpo = praias.map((p) => JSON.stringify(p)).join(',\n');
  fs.writeFileSync(PRAIAS, '[\n' + corpo + '\n]\n');
  if (comConcelho) console.log(`${comConcelho} praias ganharam ou corrigiram o concelho`);
  if (mudam.length) console.log(`${mudam.length} praias mudaram de região:`);
  for (const m of mudam) console.log(`   ${m.n} (${m.co}): ${m.de} -> ${m.para}`);
} else {
  console.log('nenhuma praia mudou de região');
}
fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
fs.writeFileSync(DESTINO, JSON.stringify(tabela) + '\n');
console.log(`_build/dados/regioes.json — ${Object.keys(tabela).length} concelhos`);
