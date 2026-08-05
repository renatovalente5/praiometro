/* Monta a pasta _site/, que é o que vai para o ar.
   =============================================================
   Correr:  node _build/gerar.js

   Até hoje quem montava o site era o Jekyll do GitHub Pages, e o que o
   protegia era o `exclude:` do _config.yml — uma LISTA DE EXCLUSÕES. Quem
   acrescentasse um ficheiro novo ao repositório publicava-o sem dar por isso,
   e foi assim que o MODELO.md, o MONETIZACAO.md e o README.md estiveram na web.

   Aqui é ao contrário: nada vai para o _site/ a não ser que esteja escrito na
   ALLOW abaixo. Um ficheiro novo não é publicado enquanto alguém não decidir
   que sim, e essa decisão fica num diff.

   PORQUÊ SAIR DO JEKYLL: as páginas de praia vão ser geradas a partir de nomes
   do OpenStreetMap. Basta um `{{` num desses nomes para o Liquid rebentar, e
   quando o build do Pages falha o site NÃO dá erro nenhum — fica a servir a
   versão antiga e chega um email. Hoje nenhum dos 995 nomes tem chavetas
   (verificado), mas o OSM é editado por gente e não se controla.
*/
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.dirname(__dirname);
const SAIDA = path.join(RAIZ, '_site');

/* O que é servido, e mais nada. */
const ALLOW = [
  'CNAME',                 /* sem isto o domínio próprio cai e o site volta ao github.io */
  'index.html',
  'privacidade.html',
  '404.html',
  'robots.txt',
  'sitemap.xml',
  'manifest.webmanifest',
];
const ALLOW_PASTAS = ['assets', 'data'];

/* Nunca, aconteça o que acontecer. É uma rede por baixo da ALLOW: se alguém
   um dia acrescentar 'MODELO.md' à lista de cima por engano, isto apanha. */
const PROIBIDO = /(^|\/)(_source|_build|_site|\.git|\.github)(\/|$)|\.(md|py|yml|yaml)$|^LICENSE$/i;

function copiarFicheiro(rel) {
  const de = path.join(RAIZ, rel);
  if (!fs.existsSync(de)) throw new Error(`falta o ficheiro ${rel}`);
  const para = path.join(SAIDA, rel);
  fs.mkdirSync(path.dirname(para), { recursive: true });
  fs.copyFileSync(de, para);
  return fs.statSync(de).size;
}

function copiarPasta(rel, conta) {
  for (const nome of fs.readdirSync(path.join(RAIZ, rel))) {
    const sub = rel + '/' + nome;
    if (fs.statSync(path.join(RAIZ, sub)).isDirectory()) copiarPasta(sub, conta);
    else { conta.n++; conta.bytes += copiarFicheiro(sub); }
  }
}

fs.rmSync(SAIDA, { recursive: true, force: true });
fs.mkdirSync(SAIDA, { recursive: true });

const conta = { n: 0, bytes: 0 };
for (const f of ALLOW) { conta.n++; conta.bytes += copiarFicheiro(f); }
for (const d of ALLOW_PASTAS) copiarPasta(d, conta);

/* Publicado por Action, o Jekyll não chega a correr. O .nojekyll fica como
   cinto e suspensórios, e para o dia em que alguém volte a publicar pela
   branch sem se lembrar do resto. */
fs.writeFileSync(path.join(SAIDA, '.nojekyll'), '');

/* ------------------------------------------------ o build tem de falhar */
const saiu = [];
(function andar(dir, base) {
  for (const nome of fs.readdirSync(dir)) {
    const abs = path.join(dir, nome);
    const rel = base ? base + '/' + nome : nome;
    if (fs.statSync(abs).isDirectory()) andar(abs, rel);
    else saiu.push(rel);
  }
})(SAIDA, '');

const intrusos = saiu.filter(f => f !== '.nojekyll' && PROIBIDO.test(f));
if (intrusos.length) {
  console.error('NÃO PUBLICAR — foi parar ao _site/ o que não devia:');
  intrusos.forEach(f => console.error('   ' + f));
  process.exit(1);
}
for (const obrigatorio of ['CNAME', 'index.html', 'robots.txt', 'sitemap.xml',
                           'assets/css/estilo.css', 'data/praias.json']) {
  if (!saiu.includes(obrigatorio)) {
    console.error(`NÃO PUBLICAR — falta ${obrigatorio} no _site/`);
    process.exit(1);
  }
}
if (fs.readFileSync(path.join(SAIDA, 'CNAME'), 'utf8').trim() !== 'praiometro.pt') {
  console.error('NÃO PUBLICAR — o CNAME não diz praiometro.pt');
  process.exit(1);
}

console.log(`_site/ — ${saiu.length} ficheiros, ${(conta.bytes / 1024).toFixed(0)} KB`);
for (const f of saiu.filter(f => !f.startsWith('assets/') && !f.startsWith('data/')).sort()) {
  console.log('   ' + f);
}
console.log(`   assets/ e data/ — ${saiu.filter(f => f.startsWith('assets/') || f.startsWith('data/')).length} ficheiros`);
