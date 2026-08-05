/* Testes do cadeado dos endereços. Correm em Node, sem browser.

   Isto não testa código — testa que uma promessa continua cumprida: os
   endereços que já foram emitidos não mudam, e as coordenadas em que eles
   assentam também não.

   Uma coordenada que se mexa parte TRÊS coisas ao mesmo tempo, e nenhuma
   delas dá erro à vista: o favorito guardado no browser de quem já lá esteve,
   o favorito guardado na conta (o Supabase indexa por essa string), e a chave
   deste cadeado. Por isso a coordenada é tão intocável como o slug. */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('../_build/lib/slug.js');

const RAIZ = path.dirname(__dirname);
const ler = (p) => JSON.parse(fs.readFileSync(path.join(RAIZ, p), 'utf8'));

let falhas = 0;
function erro(m) { falhas++; console.log('  ✗ ' + m); }
function ok(m) { console.log('  ✓ ' + m); }

const praias = ler('data/praias.json');
const cadeado = ler('_build/dados/slugs.json');
const semSlug = ler('_build/dados/sem-slug.json');
const concelhos = ler('_build/dados/concelhos.json');

/* ------------------------------------------------------------------- 1 */
console.log('\n== 1. a normalizar() é a mesma do app.js ==');
{
  const src = fs.readFileSync(path.join(RAIZ, 'assets/js/app.js'), 'utf8');
  const m = src.match(/function normalizar\(s\) \{[\s\S]*?\n {2}\}/);
  if (!m) erro('não encontrei a normalizar() em app.js — mudou de forma?');
  else {
    const doApp = new Function(m[0] + '; return normalizar;')();
    const dif = praias.filter(p => doApp(p.n) !== S.normalizar(p.n));
    if (dif.length) erro(`${dif.length} nomes normalizam diferente (ex.: ${dif[0].n})`);
    else ok(`igual à do app.js nas ${praias.length} praias`);
    /* O campo `b` foi produzido com ela. Se deixar de bater certo, a procura
       do site deixou de encontrar as praias — e isso não dá erro nenhum. */
    const difB = praias.filter(p => S.normalizar(p.n) !== p.b);
    if (difB.length) erro(`${difB.length} não batem com o campo b (ex.: ${difB[0].n})`);
    else ok('igual ao campo b guardado no praias.json');
  }
}

/* ------------------------------------------------------------------- 2 */
console.log('\n== 2. as coordenadas do cadeado continuam a existir ==');
{
  const ids = new Set(praias.map(S.id));
  const sumidas = Object.keys(cadeado).filter(id => !ids.has(id));
  if (sumidas.length) {
    erro(`${sumidas.length} coordenadas do cadeado já não existem no praias.json:`);
    sumidas.slice(0, 5).forEach(id => console.log(`      ${id} — ${cadeado[id].n}`));
    console.log('      (uma praia que se mexeu perde o favorito de quem a tinha)');
  } else ok(`as ${Object.keys(cadeado).length} coordenadas do cadeado estão todas lá`);

  if (ids.size !== praias.length) {
    erro(`${praias.length} praias dão só ${ids.size} coordenadas — há repetidas a 4 casas`);
  } else ok('nenhuma coordenada repetida a 4 casas (é a chave dos favoritos)');
}

/* ------------------------------------------------------------------- 3 */
console.log('\n== 3. nenhum slug mudou ==');
{
  const porId = new Map(praias.map(p => [S.id(p), p]));
  let mudou = 0;
  for (const [id, v] of Object.entries(cadeado)) {
    const p = porId.get(id);
    if (!p) continue;                       /* já contado no teste 2 */
    const c = concelhos[id];
    const base = S.slugificar(p.n);
    const repetido = praias.filter(x => S.slugificar(x.n) === base).length > 1;
    const esperado = repetido && c ? `${base}-${S.slugificar(c.co)}` : base;
    if (esperado !== v.slug) { erro(`${id}: cadeado diz «${v.slug}», o nome de hoje dá «${esperado}»`); mudou++; }
  }
  if (!mudou) ok('todos os slugs continuam a sair iguais do nome e do concelho');
}

/* ------------------------------------------------------------------- 4 */
console.log('\n== 4. o cadeado é consistente ==');
{
  const slugs = Object.values(cadeado).map(v => v.slug);
  const repetidos = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  if (repetidos.length) erro(`slugs repetidos: ${[...new Set(repetidos)].join(', ')}`);
  else ok(`${slugs.length} slugs, todos distintos`);

  const maus = slugs.filter(s => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s));
  if (maus.length) erro(`slugs com forma inválida: ${maus.slice(0, 3).join(', ')}`);
  else ok('todos em minúsculas, sem acentos, sem hífenes a dobrar nem nas pontas');

  const sem = Object.keys(cadeado).filter(id => !cadeado[id].n || !cadeado[id].co);
  if (sem.length) erro(`${sem.length} entradas sem nome ou sem concelho`);
  else ok('todas trazem nome, concelho e distrito');
}

/* ------------------------------------------------------------------- 5 */
console.log('\n== 5. toda a praia está no cadeado ou na lista das que ficam de fora ==');
{
  const orfas = praias.filter(p => !cadeado[S.id(p)] && !semSlug[S.id(p)]);
  if (orfas.length) {
    erro(`${orfas.length} praias sem endereço e sem justificação:`);
    orfas.slice(0, 5).forEach(p => console.log(`      ${p.n} (${S.id(p)})`));
    console.log('      (correr `node _source/gerar-slugs.js` para ver o que fazer)');
  } else ok(`${praias.length} praias = ${Object.keys(cadeado).length} com endereço + ${Object.keys(semSlug).length} sem`);

  /* As que ficam de fora são uma decisão, não um acidente: o nome repete-se
     dentro do mesmo concelho e não há como distinguir as duas. Se a lista
     crescer sozinha, alguém tem de olhar para ela. */
  const ESPERADAS_SEM_SLUG = 6;
  const n = Object.keys(semSlug).length;
  if (n !== ESPERADAS_SEM_SLUG) {
    erro(`ficam de fora ${n} praias, e a decisão tomada foram ${ESPERADAS_SEM_SLUG}. ` +
         'Se a mudança é de propósito, actualiza o número neste teste.');
    Object.entries(semSlug).forEach(([id, v]) => console.log(`      ${v.n} — ${v.co} (${id})`));
  } else ok(`${n} de fora, as mesmas de sempre (nome repetido no mesmo concelho)`);
}

/* ------------------------------------------------------------------- 6 */
console.log('\n== 6. os concelhos ==');
{
  const semConcelho = praias.filter(p => !concelhos[S.id(p)]);
  if (semConcelho.length) erro(`${semConcelho.length} praias sem concelho atribuído`);
  else ok(`as ${praias.length} têm concelho e distrito (CAOP, Direcção-Geral do Território)`);
}

console.log('\n' + '='.repeat(54));
console.log('FALHAS: ' + falhas);
console.log('='.repeat(54));
process.exit(falhas ? 1 : 0);
