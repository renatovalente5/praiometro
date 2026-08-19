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
  /* O CNAME é INERTE em modo Actions: o Pages ignora-o e quem define o domínio
     é a definição em Settings (verificado — a API devolve cname=praiometro.pt
     e build_type=workflow). Fica na lista à mesma por duas razões: custa 13
     bytes, e é ele que devolve o domínio de graça no dia em que alguém voltar
     a publicar pela branch. Não é ele que sustenta o domínio hoje. */
  'CNAME',
  'index.html',
  'privacidade.html',
  '404.html',
  'robots.txt',
  'sitemap.xml',
  'manifest.webmanifest',
  'sw.js',
];
const ALLOW_PASTAS = ['assets', 'data', 'metodologia', 'nortada', 'praias'];

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

/* ------------------------------------------- a versão do service worker */
/* O `sw.js` tem um `__VERSAO__` e é AQUI que ele é preenchido, com um resumo
   do conteúdo dos ficheiros que ele guarda. Um número escrito à mão era a
   armadilha clássica dos service workers: no dia em que alguém mudasse o CSS
   e se esquecesse de o subir, metade das pessoas ficava com o site antigo
   PARA SEMPRE, e sem um erro à vista. Assim, mexer no CSS muda a versão. */
{
  const crypto = require('crypto');
  const h = crypto.createHash('sha256');
  for (const f of ['index.html', 'assets/css/estilo.css', 'assets/css/texto.css',
                   'assets/js/modelo.js', 'assets/js/app.js', 'assets/js/favoritos.js',
                   'assets/js/conta.js', 'data/praias.json', 'manifest.webmanifest']) {
    h.update(fs.readFileSync(path.join(RAIZ, f)));
  }
  const versao = h.digest('hex').slice(0, 12);
  const alvo = path.join(SAIDA, 'sw.js');
  const src = fs.readFileSync(alvo, 'utf8');
  if (!src.includes('__VERSAO__')) {
    console.error('NÃO PUBLICAR — o sw.js não tem __VERSAO__ para preencher');
    process.exit(1);
  }
  fs.writeFileSync(alvo, src.replace('__VERSAO__', versao));
  console.log('service worker: versão ' + versao);
}

/* Aqui escrevia-se um .nojekyll. Foi tirado por não servir para nada, das
   duas maneiras: publicado por Action o Jekyll não chega a correr, e mesmo
   que corresse o ficheiro nunca lá chegava — o upload-pages-artifact exclui
   dotfiles por omissão. Verificado: /.nojekyll dava 404 com ele escrito.
   Um ficheiro que finge proteger é pior do que ficheiro nenhum. */

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

const intrusos = saiu.filter(f => PROIBIDO.test(f));
if (intrusos.length) {
  console.error('NÃO PUBLICAR — foi parar ao _site/ o que não devia:');
  intrusos.forEach(f => console.error('   ' + f));
  process.exit(1);
}
for (const obrigatorio of ['CNAME', 'index.html', 'robots.txt', 'sitemap.xml', 'sw.js',
                           'assets/css/estilo.css', 'assets/css/texto.css',
                           'data/praias.json', 'data/mapa.json', 'metodologia/index.html',
                           'nortada/index.html', 'praias/index.html',
                           'praias/norte/index.html', 'praias/algarve/index.html']) {
  if (!saiu.includes(obrigatorio)) {
    console.error(`NÃO PUBLICAR — falta ${obrigatorio} no _site/`);
    process.exit(1);
  }
}
if (fs.readFileSync(path.join(SAIDA, 'CNAME'), 'utf8').trim() !== 'praiometro.pt') {
  console.error('NÃO PUBLICAR — o CNAME não diz praiometro.pt');
  process.exit(1);
}

/* Um COMENTÁRIO MAL FECHADO em CSS não desequilibra chavetas nenhumas e não dá
   erro em lado nenhum: o parser limita-se a engolir em silêncio a regra que vem
   a seguir. Aconteceu mesmo — um corte levou a abertura de um comentário, ficou
   texto solto com um fecho no fim, e a tira dos seis dias perdeu o
   `display: grid` sem uma única linha de aviso em lado nenhum. Isto custa dez
   milissegundos e apanha-o.
   (E sim: a primeira versão deste comentário citava os dois símbolos e fechava
   a si própria a meio. Por isso não se citam.) */
for (const css of saiu.filter(f => f.endsWith('.css'))) {
  const t = fs.readFileSync(path.join(SAIDA, css), 'utf8');
  let i = 0, abertos = 0, orfao = -1;
  while (i < t.length) {
    if (t.startsWith('/*', i)) { if (!abertos) abertos = 1; i += 2; continue; }
    if (t.startsWith('*/', i)) {
      if (!abertos) { orfao = i; break; }
      abertos = 0; i += 2; continue;
    }
    i++;
  }
  if (orfao >= 0 || abertos) {
    const linha = t.slice(0, orfao < 0 ? t.length : orfao).split('\n').length;
    console.error(`NÃO PUBLICAR — ${css} tem um comentário ${orfao >= 0 ? 'fechado sem abrir' : 'por fechar'} na linha ${linha}`);
    console.error('   um comentário mal fechado engole a regra seguinte em silêncio');
    process.exit(1);
  }
}

console.log(`_site/ — ${saiu.length} ficheiros, ${(conta.bytes / 1024).toFixed(0)} KB`);
for (const f of saiu.filter(f => !f.startsWith('assets/') && !f.startsWith('data/')).sort()) {
  console.log('   ' + f);
}
console.log(`   assets/ e data/ — ${saiu.filter(f => f.startsWith('assets/') || f.startsWith('data/')).length} ficheiros`);
