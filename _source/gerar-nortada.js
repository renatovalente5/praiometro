/* Escreve os blocos de dados da página /nortada/.
   =============================================================
   Correr:  node _source/gerar-nortada.js              (escreve)
            node _source/gerar-nortada.js --verificar  (só compara)

   A página tem marcadores <!-- DADOS: x --> ... <!-- /DADOS -->, e é este
   ficheiro que os enche a partir de _build/dados/nortada.json e do modelo.js.

   PORQUÊ assim, e não escrito à mão: a página faz afirmações fortes com
   números — «em todas as sete regiões a hora mais calma é as 11h», «zero
   tardes de nortada em dez Verões». No dia em que os dados forem recolhidos
   outra vez e um desses números mudar, uma página escrita à mão passa a
   mentir sem ninguém dar por isso. Aqui, ou se regenera, ou o --verificar
   falha nos testes.

   O gráfico é gerado pela mesma razão. Um desenho feito à mão a partir de
   dados que mudaram é pior do que não ter gráfico nenhum. */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.dirname(__dirname);

require(path.join(RAIZ, 'assets/js/modelo.js'));
const M = globalThis.Modelo;
const D = JSON.parse(fs.readFileSync(path.join(RAIZ, '_build/dados/nortada.json'), 'utf8'));
const PAGINA = path.join(RAIZ, 'nortada/index.html');

const REGIOES = ['Norte', 'Centro', 'Oeste e Lisboa', 'Setúbal', 'Alentejo',
                 'Algarve poente', 'Algarve nascente'];
const CORES = ['#0e7490', '#0e7a4a', '#b3261e', '#8a5c00', '#6b46c1', '#0891b2', '#4a6274'];
const [H_INI, H_FIM] = D.janela;

const virgula = (n, casas) => n.toFixed(casas == null ? 0 : casas).replace('.', ',');
const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const hora = (r) => Object.fromEntries(Object.entries(D.perfil_regiao[r]).map(([h, v]) => [+h, v]));

/* --------------------------------------------------------------- gráfico */
function grafico() {
  const H0 = 9, H1 = 21, W = 640, HT = 300;
  const ML = 38, MR = 116, MT = 14, MB = 34;
  const gw = W - ML - MR, gh = HT - MT - MB, vmax = 26;
  const x = h => ML + (h - H0) / (H1 - H0) * gw;
  const y = v => MT + (1 - v / vmax) * gh;
  const p = [];
  p.push(`<div class="grafico-rolo">`);
  p.push(`<svg viewBox="0 0 ${W} ${HT}" class="grafico" role="img" aria-label="Vento médio hora a hora em Julho e Agosto, por região. Em todas as regiões o vento é mais fraco às ${H_INI}h e sobe até ao fim da tarde.">`);
  for (let v = 0; v <= vmax; v += 5) {
    p.push(`<line x1="${ML}" y1="${y(v).toFixed(1)}" x2="${ML + gw}" y2="${y(v).toFixed(1)}" class="g-linha"/>`);
    p.push(`<text x="${ML - 6}" y="${(y(v) + 4).toFixed(1)}" class="g-eixo" text-anchor="end">${v}</text>`);
  }
  for (let h = H0; h <= H1; h += 2)
    p.push(`<text x="${x(h).toFixed(1)}" y="${HT - MB + 18}" class="g-eixo" text-anchor="middle">${h}h</text>`);
  p.push(`<rect x="${x(H_INI).toFixed(1)}" y="${MT}" width="${(x(H_FIM) - x(H_INI)).toFixed(1)}" height="${gh}" class="g-janela"/>`);
  p.push(`<text x="${((x(H_INI) + x(H_FIM)) / 2).toFixed(1)}" y="${MT + 12}" class="g-eixo" text-anchor="middle">janela da praia</text>`);
  REGIOES.forEach((r, i) => {
    const v = hora(r);
    const pts = [];
    for (let h = H0; h <= H1; h++) if (v[h] != null) pts.push(`${x(h).toFixed(1)},${y(v[h]).toFixed(1)}`);
    p.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${CORES[i]}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`);
  });

  /* OS NOMES AFASTAM-SE UNS DOS OUTROS. Cada nome era escrito à altura onde a
     sua linha acaba, e as linhas que acabam à mesma altura punham dois nomes um
     por cima do outro: medidos três pares exactamente sobrepostos — «Oeste e
     Lisboa» com «Algarve poente» no mesmo píxel, e mais dois a um de distância.
     A legenda por baixo salva a identificação, mas o gráfico ficava com uma
     mancha ilegível onde devia ter um nome.

     Empurra-se para baixo, de cima para baixo, mantendo ALTURA mínima entre
     eles; se o último sair do gráfico, empurra-se o conjunto para cima. É a
     resolução de colisões mais simples que existe e chega para sete nomes. */
  const ALTURA = 13;
  const nomes = REGIOES.map((r, i) => ({ r, i, y: y(hora(r)[H1]) + 4 }))
    .sort((a, b) => a.y - b.y);
  for (let k = 1; k < nomes.length; k++) {
    if (nomes[k].y - nomes[k - 1].y < ALTURA) nomes[k].y = nomes[k - 1].y + ALTURA;
  }
  const excesso = nomes[nomes.length - 1].y - (HT - MB);
  if (excesso > 0) nomes.forEach(n => { n.y -= excesso; });
  nomes.forEach(n => {
    p.push(`<text x="${ML + gw + 6}" y="${n.y.toFixed(1)}" class="g-nome" fill="${CORES[n.i]}">${esc(n.r)}</text>`);
  });
  p.push(`<text x="${ML - 30}" y="${MT - 2}" class="g-eixo">km/h</text>`);
  p.push('</svg></div>');
  /* Legenda por baixo, e não só os nomes à direita do gráfico: num telemóvel o
     gráfico rola e os nomes ficam fora do ecrã — quem não rolar vê sete linhas
     coloridas sem saber de quem são. */
  p.push('<ul class="g-legenda">');
  REGIOES.forEach((r, i) => p.push(
    `<li><span class="g-bola" style="background:${CORES[i]}" aria-hidden="true"></span>${esc(r)}</li>`));
  p.push('</ul>');
  p.push(`<p class="grafico-fonte">Vento médio hora a hora, ${D.meses} de ${D.anos[0]} a ${D.anos[1]}. A faixa é a janela das ${H_INI}h às ${H_FIM}h que o Praiómetro usa.</p>`);
  return p.join('\n');
}

/* ---------------------------------------------------------- tabela horas */
function tabelaHoras() {
  const l = REGIOES.map(r => {
    const v = hora(r);
    let calma = H_INI, pico = H_INI;
    for (let h = H_INI; h < H_FIM; h++) { if (v[h] < v[calma]) calma = h; if (v[h] > v[pico]) pico = h; }
    return { r, calma, vCalma: v[calma], pico, vPico: v[pico], v21: v[21] };
  });
  return ['<div class="rolo">', '<table>',
    `<caption>Hora mais calma e hora de pico dentro da janela de praia, ${D.meses} de ${D.anos[0]} a ${D.anos[1]}</caption>`,
    '<thead><tr><th scope="col">Região</th><th scope="col">Mais calmo</th><th scope="col">Pico</th><th scope="col" class="num">Às 21h</th></tr></thead>',
    '<tbody>',
    ...l.map(x => `  <tr><th scope="row">${esc(x.r)}</th>` +
      `<td>${x.calma}h — ${virgula(x.vCalma)} km/h</td>` +
      `<td>${x.pico}h — ${virgula(x.vPico)} km/h</td>` +
      `<td class="num">${virgula(x.v21)} km/h</td></tr>`),
    '</tbody>', '</table>', '</div>'].join('\n');
}

/* ------------------------------------------------------ tabela abrigadas */
function tabelaAbrigadas() {
  /* Junta as praias que caem no mesmo ponto da grelha: são a mesma medição. */
  const grupo = new Map();
  for (const g of D.grupos_grelha) for (const id of g) grupo.set(id, g[0]);
  const juntas = new Map();
  for (const [id, p] of Object.entries(D.praias)) {
    const chave = grupo.get(id) || id;
    if (!juntas.has(chave)) juntas.set(chave, { ...p, nomes: [] });
    juntas.get(chave).nomes.push(p.n);
  }
  const linhas = [...juntas.values()]
    .sort((a, b) => a.pct_nortada - b.pct_nortada || a.medio_janela - b.medio_janela);
  return ['<div class="rolo">', '<table>',
    `<caption>Fracção de tardes de Verão com nortada, das mais abrigadas para as mais expostas. ${linhas.length} pontos medidos, ${D.meses} de ${D.anos[0]} a ${D.anos[1]}</caption>`,
    '<thead><tr><th scope="col">Praia</th><th scope="col">Região</th><th scope="col" class="num">Tardes com nortada</th><th scope="col" class="num">Vento médio</th></tr></thead>',
    '<tbody>',
    ...linhas.map(p => `  <tr><th scope="row">${esc(p.nomes.join(' e '))}</th>` +
      `<td>${esc(p.r)}</td>` +
      `<td class="num">${virgula(p.pct_nortada, 1)} %</td>` +
      `<td class="num">${virgula(p.medio_janela, 1)} km/h</td></tr>`),
    '</tbody>', '</table>', '</div>'].join('\n');
}

/* ---------------------------------------------------------- tabela custo */
function tabelaCusto() {
  const P = M._pontos;
  const l = REGIOES.map(r => {
    const v = hora(r);
    let calma = H_INI, pico = H_INI;
    for (let h = H_INI; h < H_FIM; h++) { if (v[h] < v[calma]) calma = h; if (v[h] > v[pico]) pico = h; }
    return { r, a: v[calma], b: v[pico], pa: P.vento(v[calma]), pb: P.vento(v[pico]) };
  }).sort((x, y) => (y.pa - y.pb) - (x.pa - x.pb));
  return ['<div class="rolo">', '<table>',
    '<caption>O que a diferença entre a hora calma e a hora de pico vale nos 34 pontos do vento</caption>',
    '<thead><tr><th scope="col">Região</th><th scope="col" class="num">Hora calma</th><th scope="col" class="num">Hora de pico</th><th scope="col" class="num">Pontos perdidos</th></tr></thead>',
    '<tbody>',
    ...l.map(x => `  <tr><th scope="row">${esc(x.r)}</th>` +
      `<td class="num">${virgula(x.a)} km/h — ${virgula(x.pa)} pts</td>` +
      `<td class="num">${virgula(x.b)} km/h — ${virgula(x.pb)} pts</td>` +
      `<td class="num"><strong>${virgula(x.pa - x.pb)}</strong></td></tr>`),
    '</tbody>', '</table>', '</div>'].join('\n');
}

/* ---------------------------------------------------------------- método */
function metodo() {
  const n = Object.keys(D.praias).length;
  const tardes = Math.max(...Object.values(D.praias).map(p => p.tardes));
  return `<p>Os números desta página saem de <strong>${D.fonte}</strong>: vento e direcção
    hora a hora, em ${D.meses.toLowerCase()} de ${D.anos[0]} a ${D.anos[1]}, em
    <strong>${n} praias</strong> portuguesas escolhidas por darem cobertura ao país inteiro,
    do Minho ao Guadiana. São ${tardes} tardes de Verão por praia.</p>
    <p>Uma tarde conta como tarde de nortada quando, na maior parte das horas entre as
    ${H_INI}h e as ${H_FIM}h, o vento vem do quadrante ${D.nortada.dir[0]}°–${D.nortada.dir[1]}°
    com ${virgula(D.nortada.kmh, 1)} km/h ou mais — a definição operacional portuguesa de
    ${virgula(D.nortada.kmh / 3.6, 0)} m/s.</p>`;
}

/* ---------------------------------------------------------------- montar */
const BLOCOS = { grafico, 'tabela-horas': tabelaHoras, 'tabela-abrigadas': tabelaAbrigadas,
                 'tabela-custo': tabelaCusto, metodo };

let html = fs.readFileSync(PAGINA, 'utf8');
let mudou = 0;
for (const [nome, f] of Object.entries(BLOCOS)) {
  const re = new RegExp(`( *)<!-- DADOS: ${nome} -->[\\s\\S]*?<!-- /DADOS -->`);
  if (!re.test(html)) { console.error(`✗ falta o marcador «${nome}» em nortada/index.html`); process.exit(1); }
  html = html.replace(re, (m, indent) => {
    const corpo = f().split('\n').map(l => l ? indent + l : l).join('\n');
    const novo = `${indent}<!-- DADOS: ${nome} -->\n${corpo}\n${indent}<!-- /DADOS -->`;
    if (novo !== m) mudou++;
    return novo;
  });
}

/* NENHUM NOME POR CIMA DE OUTRO. Cada nome de região é escrito à altura onde a
   sua linha acaba, e as linhas que acabam à mesma altura punham dois nomes no
   mesmo sítio: mediram-se três pares sobrepostos, um deles no mesmo píxel
   exacto. Há uma legenda por baixo do gráfico, portanto a identificação não se
   perdia de todo — mas o gráfico ficava com uma mancha ilegível onde devia ter
   um nome, e isso é coisa que ninguém vê num diff.
   Corre SEMPRE, e não só no --verificar: o afastamento é calculado aqui ao
   lado, e uma conta que se verifica a si própria não é grande verificação —
   mas esta lê o HTML que saiu, que é a única coisa que chega a alguém. */
(function conferirNomes() {
  const rot = [];
  const re = /<text[^>]*\bx="([\d.]+)"[^>]*\by="([\d.]+)"[^>]*class="g-nome"[^>]*>([^<]*)</g;
  let m;
  while ((m = re.exec(html))) rot.push({ x: +m[1], y: +m[2], t: m[3] });
  const maus = [];
  for (let i = 0; i < rot.length; i++)
    for (let j = i + 1; j < rot.length; j++)
      if (Math.abs(rot[i].x - rot[j].x) < 60 && Math.abs(rot[i].y - rot[j].y) < 11)
        maus.push(`«${rot[i].t}» e «${rot[j].t}» a ${Math.abs(rot[i].y - rot[j].y).toFixed(1)} px`);
  if (maus.length) {
    console.error(`✗ ${maus.length} par(es) de nomes sobrepostos no gráfico:`);
    for (const x of maus.slice(0, 4)) console.error('   ' + x);
    process.exit(1);
  }
  console.log(`✓ os ${rot.length} nomes do gráfico não se sobrepõem`);
})();

if (process.argv.includes('--verificar')) {
  if (mudou) {
    console.error(`✗ ${mudou} bloco(s) da /nortada/ estão diferentes dos dados medidos.`);
    console.error('  Correr: node _source/gerar-nortada.js');
    process.exit(1);
  }
  console.log('✓ os blocos da /nortada/ batem certo com _build/dados/nortada.json');
  process.exit(0);
}
fs.writeFileSync(PAGINA, html);
console.log(`nortada/index.html — ${mudou} bloco(s) reescritos de ${Object.keys(BLOCOS).length}`);
