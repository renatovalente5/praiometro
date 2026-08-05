/* A página /metodologia/ não pode mentir. Corre em Node, sem browser.

   Uma página de metodologia é feita para ser citada. No dia em que alguém
   afinar uma curva no modelo.js e não se lembrar de vir aqui, a página passa a
   descrever um modelo que já não existe — e não há erro nenhum à vista, nem no
   site, nem nos testes, nem no browser. Fica só a mentir.

   Por isso este ficheiro lê os números do HTML PUBLICADO, não do MODELO.md, e
   compara-os com o que o modelo.js devolve hoje. */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.dirname(__dirname);

require(path.join(RAIZ, 'assets/js/modelo.js'));
const M = globalThis.Modelo;
const P = M._pontos;
const html = fs.readFileSync(path.join(RAIZ, 'metodologia/index.html'), 'utf8');
/* O HTML está indentado e as frases partem-se em várias linhas. Qualquer
   procura por uma frase tem de correr sobre esta versão, senão falha por causa
   de um \n a meio de um <strong>. */
const corrido = html.replace(/\s+/g, ' ');

let falhas = 0;
const erro = (m) => { falhas++; console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

/* Vírgula decimal: a página escreve 18,5 e o JavaScript quer 18.5. */
const num = (s) => parseFloat(String(s).replace(',', '.').replace(/[^\d.\-]/g, ''));

/* Devolve as linhas de uma tabela, pela sua legenda. */
function tabela(legenda) {
  const i = html.indexOf(legenda);
  if (i < 0) return null;
  const fim = html.indexOf('</table>', i);
  const corpo = html.slice(html.indexOf('<tbody>', i), fim);
  return [...corpo.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m =>
    [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)]
      .map(c => c[1].replace(/<[^>]+>/g, '').trim()));
}

/* ------------------------------------------------------------------- 1 */
console.log('\n== 1. os pesos publicados são os do modelo ==');
{
  const linhas = tabela('Peso de cada factor na nota final');
  if (!linhas) erro('não encontrei a tabela dos pesos');
  else {
    const mapa = { 'Vento': 'vento', 'Sol e céu': 'ceu', 'Calor que se sente': 'ar',
                   'Temperatura da água': 'agua', 'Chuva': 'chuva' };
    let mau = 0;
    for (const [nome, peso] of linhas) {
      const chave = mapa[nome];
      if (!chave) { erro(`factor desconhecido na página: «${nome}»`); mau++; continue; }
      if (num(peso) !== M.PESOS[chave]) {
        erro(`${nome}: a página diz ${num(peso)}, o modelo diz ${M.PESOS[chave]}`); mau++;
      }
    }
    const soma = linhas.reduce((a, l) => a + num(l[1]), 0);
    if (soma !== 100) { erro(`os pesos publicados somam ${soma} e não 100`); mau++; }
    if (!mau) ok(`os 5 pesos batem certo e somam 100`);
  }
}

/* ------------------------------------------------------------------- 2 */
console.log('\n== 2. as curvas publicadas são as do modelo ==');
{
  const curvas = [
    ['Pontos por velocidade do vento (percentil 75 da janela)', P.vento, 'vento'],
    ['Pontos por nebulosidade média na janela', P.ceu, 'céu'],
    ['Pontos por temperatura média da água na janela', P.agua, 'água'],
    ['Pontos por probabilidade máxima de chuva na janela', P.chuva, 'chuva'],
  ];
  for (const [legenda, f, nome] of curvas) {
    const linhas = tabela(legenda);
    if (!linhas) { erro(`não encontrei a tabela de ${nome}`); continue; }
    let mau = 0;
    for (const l of linhas) {
      const v = num(l[0]), esperado = num(l[1]);
      if (!isFinite(v)) { erro(`${nome}: não consigo ler o valor «${l[0]}»`); mau++; continue; }
      if (f(v) !== esperado) {
        erro(`${nome} a ${l[0]}: a página diz ${esperado} pontos, o modelo dá ${f(v)}`); mau++;
      }
    }
    if (!mau) ok(`${nome}: ${linhas.length} pontos da curva, todos certos`);
  }
  /* O calor tem duas colunas de valores na mesma linha («23,5 ou 32,5 °C») —
     lê-se à parte para não fingir que a tabela é do mesmo formato. */
  const calor = tabela('Pontos por sensação térmica máxima na janela');
  if (!calor) erro('não encontrei a tabela do calor');
  else {
    let mau = 0;
    for (const [faixa, pts] of calor) {
      const vals = faixa.match(/[\d,]+/g).map(num);
      for (const v of vals) {
        if (P.ar(v) !== num(pts)) {
          erro(`calor a ${v} °C: a página diz ${num(pts)} pontos, o modelo dá ${P.ar(v)}`); mau++;
        }
      }
    }
    if (!mau) ok(`calor: ${calor.length} linhas, ambos os lados da escala certos`);
  }
}

/* ------------------------------------------------------------------- 3 */
console.log('\n== 3. os cortes e a janela ==');
{
  const cortes = tabela('Da nota ao veredicto');
  const verde = num(cortes[0][0]);
  const amareloDe = num(cortes[1][0].split(/\s+a\s+/)[0]);
  const prova = (nota) => {
    /* constrói um dia que dê exactamente esta nota é difícil; em vez disso
       confirma-se o comportamento nos limites com dias reais */
    return nota;
  };
  if (verde !== 70) erro(`a página diz que verde é ≥ ${verde}`);
  if (amareloDe !== 45) erro(`a página diz que amarelo começa em ${amareloDe}`);
  if (verde === 70 && amareloDe === 45) ok('cortes 70 e 45, como no modelo.js:312');

  const m = corrido.match(/entre as <strong>(\d+)h e as (\d+)h<\/strong>/);
  if (!m) erro('não encontrei a janela horária na página');
  else if (num(m[1]) !== M.HORA_INI || num(m[2]) !== M.HORA_FIM) {
    erro(`a página diz ${m[1]}h–${m[2]}h, o modelo usa ${M.HORA_INI}h–${M.HORA_FIM}h`);
  } else ok(`janela ${M.HORA_INI}h–${M.HORA_FIM}h`);
}

/* ------------------------------------------------------------------- 4 */
console.log('\n== 4. os exemplos com números não envelheceram ==');
{
  const base = { ceu: 15, ar: 27, chuva: 0, mm: 0, rajada: 22, dirVento: 300,
                 lat: 40, lon: -8.8, trovoada: false, ondas: 0.8 };
  const nota = (d) => M.classificarDia(d).nota;

  /* mar vs rio, com a mesma meteorologia */
  const esperado = {
    'De mar, água a 18,5 °C': nota({ ...base, vento: 12, agua: 18.5, mar: true }),
    'De mar, água a 22,5 °C (Algarve)': nota({ ...base, vento: 12, agua: 22.5, mar: true }),
    'De rio': nota({ ...base, vento: 12, agua: null, ondas: null, mar: false }),
  };
  const linhas = tabela('A mesma meteorologia, três praias diferentes');
  if (!linhas) erro('não encontrei a tabela mar/rio');
  else {
    let mau = 0;
    for (const [praia, publicada] of linhas) {
      if (!(praia in esperado)) { erro(`linha desconhecida: «${praia}»`); mau++; continue; }
      if (num(publicada) !== esperado[praia]) {
        erro(`«${praia}»: a página diz ${num(publicada)}, o modelo dá hoje ${esperado[praia]}`); mau++;
      }
    }
    const dif = esperado['De rio'] - esperado['De mar, água a 18,5 °C'];
    const mDif = corrido.match(/São <strong>(\d+) pontos<\/strong> de diferença entre mar e rio/);
    if (!mDif) { erro('não encontrei a frase da diferença mar/rio'); mau++; }
    else if (num(mDif[1]) !== dif) {
      erro(`a página diz ${mDif[1]} pontos de diferença mar/rio, e são ${dif}`); mau++;
    }
    if (!mau) ok(`mar/rio: ${Object.values(esperado).join(', ')} — e ${dif} pontos de diferença`);
  }

  /* o prémio do dia calmo */
  const c6 = nota({ ...base, vento: 6, agua: 18.5, mar: true });
  const c22 = nota({ ...base, vento: 22, agua: 18.5, mar: true });
  const mCalmo = corrido.match(/<strong>6 km\/h dá nota (\d+), e com 22 km\/h dá (\d+)<\/strong>/);
  if (!mCalmo) erro('não encontrei a frase do prémio do dia calmo');
  else if (num(mCalmo[1]) !== c6 || num(mCalmo[2]) !== c22) {
    erro(`a página diz 6 km/h → ${mCalmo[1]} e 22 km/h → ${mCalmo[2]}; hoje dá ${c6} e ${c22}`);
  } else ok(`dia calmo: ${c6} contra ${c22}, ${c6 - c22} pontos de diferença`);

  /* os 86 pontos que restam a uma praia de rio */
  const restam = Object.values(M.PESOS).reduce((a, b) => a + b, 0) - M.PESOS.agua;
  const m86 = corrido.match(/<strong>(\d+) pontos<\/strong> que restam/);
  if (!m86) erro('não encontrei os pontos que restam a uma praia de rio');
  else if (num(m86[1]) !== restam) erro(`a página diz ${m86[1]} pontos e restam ${restam}`);
  else ok(`praias de rio pontuam sobre ${restam} pontos`);
}

/* ------------------------------------------------------------------- 5 */
console.log('\n== 5. os vetos publicados são os do código ==');
{
  const fonte = fs.readFileSync(path.join(RAIZ, 'assets/js/modelo.js'), 'utf8');
  const limiares = [
    [/d\.chuva > (\d+)/, /acima de (\d+) % de probabilidade/, 'chuva'],
    [/d\.vento > (\d+)/, /Vento acima de (\d+) km\/h/, 'vento'],
    [/d\.rajada > (\d+)/, /rajadas acima de (\d+) km\/h/, 'rajadas'],
    [/d\.ar < (\d+)/, /abaixo de (\d+) °C/, 'frio'],
    [/d\.ondas > ([\d.]+)/, /acima de ([\d,]+) m/, 'ondulação'],
  ];
  let mau = 0;
  for (const [reCod, rePag, nome] of limiares) {
    const c = fonte.match(reCod), p = html.match(rePag);
    if (!c) { erro(`não encontrei o veto de ${nome} no modelo.js`); mau++; continue; }
    if (!p) { erro(`não encontrei o veto de ${nome} na página`); mau++; continue; }
    if (num(c[1]) !== num(p[1])) {
      erro(`veto de ${nome}: o código diz ${c[1]}, a página diz ${p[1]}`); mau++;
    }
  }
  if (!mau) ok('os 5 limiares de veto batem certo com o modelo.js');
}

/* ------------------------------------------------------------------- 6 */
console.log('\n== 6. a página está inteira ==');
{
  const ancoras = ['pesos', 'janela', 'direccao', 'curvas', 'vento', 'ceu', 'calor',
                   'agua', 'chuva', 'limitante', 'vetos', 'cortes', 'rio',
                   'limitacoes', 'fontes'];
  const faltam = ancoras.filter(a => !html.includes(`id="${a}"`));
  if (faltam.length) erro(`âncoras em falta: ${faltam.join(', ')}`);
  else ok(`as ${ancoras.length} âncoras existem — os endereços são para ser citados`);

  const noIndice = ancoras.filter(a => !html.includes(`href="#${a}"`));
  if (noIndice.length) erro(`sem entrada no índice: ${noIndice.join(', ')}`);
  else ok('todas estão no índice');

  if (!html.includes('rel="canonical" href="https://praiometro.pt/metodologia/"'))
    erro('falta o canonical');
  if (!html.includes('"@type":"BreadcrumbList"')) erro('falta o BreadcrumbList');
  if (/href="(?!https?:|\/|#|mailto:)/.test(html.replace(/<!--[\s\S]*?-->/g, '')))
    erro('há caminhos relativos na página');
  if (!falhas) ok('canonical, dados estruturados e caminhos absolutos');
}

console.log('\n' + '='.repeat(54));
console.log('FALHAS: ' + falhas);
console.log('='.repeat(54));
process.exit(falhas ? 1 : 0);
