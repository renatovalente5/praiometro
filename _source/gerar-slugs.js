/* Produz o cadeado dos endereços: _build/dados/slugs.json
   =============================================================
   Correr:  node _source/gerar-slugs.js
            node _source/gerar-slugs.js --escrever    (só este grava)

   Sem --escrever, mostra o que mudaria e não toca em nada. É de propósito:
   este ficheiro é um CADEADO, não uma saída de build.

   A REGRA: um slug emitido nunca muda. Uma vez publicado /praia/x/, esse
   endereço é para sempre — o Google indexou-o, alguém o guardou nos favoritos,
   alguém o pôs num sítio qualquer. Mudá-lo é deitar fora tudo o que ele tenha
   ganho e devolver 404 a quem lá vá.

   Por isso o cadeado guarda também a COORDENADA. Se o dia em que o
   OpenStreetMap mexer 30 metros numa praia passar despercebido, parte-se três
   coisas ao mesmo tempo: o favorito de quem a tem no browser, o favorito de
   quem a tem na conta (a coluna praia_id no Supabase), e a chave deste
   ficheiro. O testar-slugs.js falha se qualquer uma das duas mudar.

   DESEMPATE: 50 nomes repetem-se — cinco «Praia Fluvial», quatro «Praia dos
   Pescadores», quatro «Prainha». Quem repete leva o concelho no fim
   («praia-fluvial-vila-verde»), e quem é único fica só com o nome. */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('../_build/lib/slug.js');

const RAIZ = path.dirname(__dirname);
const PRAIAS = path.join(RAIZ, 'data', 'praias.json');
const CONCELHOS = path.join(RAIZ, '_build', 'dados', 'concelhos.json');
const CADEADO = path.join(RAIZ, '_build', 'dados', 'slugs.json');

const ler = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const praias = ler(PRAIAS);
const concelhos = ler(CONCELHOS);
const antigo = fs.existsSync(CADEADO) ? ler(CADEADO) : {};

/* ---------------------------------------------------------------- slugs */
const porNome = new Map();
for (const p of praias) {
  const base = S.slugificar(p.n);
  if (!porNome.has(base)) porNome.set(base, []);
  porNome.get(base).push(p);
}

const novo = {};
const conflitos = [];
for (const [base, grupo] of porNome) {
  for (const p of grupo) {
    const id = S.id(p);
    const c = concelhos[id];
    if (!c) { conflitos.push(`sem concelho: ${p.n} (${id})`); continue; }
    novo[id] = {
      slug: grupo.length === 1 ? base : `${base}-${S.slugificar(c.co)}`,
      n: p.n, co: c.co, di: c.di
    };
  }
}

/* Um nome repetido DENTRO do mesmo concelho continua a colidir. Não se
   inventa um sufixo numérico — «praia-nova-2» não diz nada a ninguém e o
   número depende da ordem do ficheiro, que pode mudar.

   Estas praias ficam SEM endereço próprio, e continuam a funcionar em tudo o
   resto: aparecem na procura, guardam-se nos favoritos, têm previsão. Só não
   ganham página. É a mesma decisão que o _source/ambiguos.json já tinha
   tomado — «Praia de Nossa Senhora» e «Praia do Barril» estão lá desde a
   primeira curadoria. Uma praia cujo nome não distingue duas coisas não pode
   ter um endereço que finja que distingue. */
const vistos = new Map();
for (const [id, v] of Object.entries(novo)) {
  if (!vistos.has(v.slug)) vistos.set(v.slug, []);
  vistos.get(v.slug).push(id);
}
const aindaIguais = [...vistos].filter(([, v]) => v.length > 1);
const semSlug = {};
for (const [slug, ids] of aindaIguais) {
  for (const id of ids) {
    semSlug[id] = { n: novo[id].n, co: novo[id].co, porque: `nome repetido no concelho (${slug})` };
    delete novo[id];
  }
}

/* --------------------------------------------------- comparação com o que já existe */
const mudados = [], perdidos = [], novos = [];
for (const [id, v] of Object.entries(antigo)) {
  if (!novo[id]) perdidos.push(`${v.slug} (${id}) — ${v.n}`);
  else if (novo[id].slug !== v.slug) mudados.push(`${id}: ${v.slug} -> ${novo[id].slug}`);
}
for (const id of Object.keys(novo)) if (!antigo[id]) novos.push(`${novo[id].slug} (${id})`);

/* ------------------------------------------------------------------ relatório */
const n = Object.keys(novo).length;
console.log(`praias            : ${praias.length}`);
console.log(`slugs produzidos  : ${n}`);
console.log(`slugs distintos   : ${new Set(Object.values(novo).map(v => v.slug)).size}`);
console.log(`nomes que repetem : ${[...porNome].filter(([, g]) => g.length > 1).length}`);
console.log(`mais comprido     : ${Math.max(...Object.values(novo).map(v => v.slug.length))} caracteres`);

if (conflitos.length) { console.log('\nSEM CONCELHO:'); conflitos.forEach(c => console.log('  ' + c)); }
if (aindaIguais.length) {
  console.log(`\nsem endereço      : ${Object.keys(semSlug).length} (nome repetido dentro do concelho)`);
  for (const [slug, ids] of aindaIguais) {
    console.log('  ' + slug);
    ids.forEach(id => console.log(`     ${semSlug[id].n} — ${semSlug[id].co} (${id})`));
  }
}
if (Object.keys(antigo).length) {
  console.log(`\nvs cadeado actual : ${novos.length} novos, ${mudados.length} mudados, ${perdidos.length} perdidos`);
  mudados.forEach(m => console.log('  MUDOU  ' + m));
  perdidos.forEach(p => console.log('  PERDEU ' + p));
}

/* As colisões por resolver NÃO impedem a gravação: são uma decisão tomada
   (ficam sem página), não um erro. O que impede é um slug mudar ou sumir. */
const mau = conflitos.length || mudados.length || perdidos.length;
if (!process.argv.includes('--escrever')) {
  console.log('\n(simulação — usa --escrever para gravar)');
  process.exit(mau ? 1 : 0);
}
if (mau && !process.argv.includes('--forcar')) {
  console.log('\nNÃO GRAVEI: há slugs a mudar, a desaparecer, ou por resolver.');
  console.log('Um slug já publicado não muda. Se souberes o que estás a fazer, --forcar.');
  process.exit(1);
}
/* Chaves por ordem, para o diff de um commit se ler.
   NÃO usar `JSON.stringify(o, Object.keys(o).sort())`: um array no segundo
   argumento é um FILTRO de propriedades aplicado a TODOS os níveis, não uma
   ordenação — deixaria 989 objectos vazios, e o ficheiro até parece bem no
   tamanho. Ordena-se reconstruindo o objecto. */
const ordenar = (o) => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
fs.mkdirSync(path.dirname(CADEADO), { recursive: true });
fs.writeFileSync(CADEADO, JSON.stringify(ordenar(novo), null, 1) + '\n');
fs.writeFileSync(path.join(path.dirname(CADEADO), 'sem-slug.json'),
                 JSON.stringify(ordenar(semSlug), null, 1) + '\n');
console.log(`\n${CADEADO} — ${(fs.statSync(CADEADO).size / 1024).toFixed(1)} KB`);
console.log(`${path.join(path.dirname(CADEADO), 'sem-slug.json')} — ${Object.keys(semSlug).length} praias`);
