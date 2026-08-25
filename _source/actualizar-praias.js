/* A LISTA DE PRAIAS CONTRA O OPENSTREETMAP DE HOJE.
   =============================================================
   Correr:  node _source/actualizar-praias.js --verificar   (só compara)
            node _source/actualizar-praias.js --recolher    (vai ao Overpass)
            node _source/actualizar-praias.js               (aplica o que der)

   PORQUÊ ISTO EXISTE. A lista saiu de UMA consulta ao Overpass, guardada em
   `_source/osm-praias.json`, e depois ninguém lhe voltou a tocar. Vinte e três
   dias depois já tinha derivado: quatro praias mudaram de nome no OSM e o site
   continuava a mostrar os antigos («Praia de Machico» passara a «Praia da
   Banda d'Além», «Praia de Troia (Galé)» a «Praia Tróia-Galé»), e havia uma
   praia nova que não estava cá. Nada no projecto dava por isso — a cópia é um
   ficheiro sem data de validade, e um ficheiro assim envelhece em silêncio.

   O QUE SE DECIDE SOZINHO E O QUE NÃO SE DECIDE:

   · RENOMEAR decide-se: mesma coordenada, nome diferente. O OSM é a fonte, e
     se lá mudou, aqui muda. Aplica-se e escreve-se o que mudou.

   · ACRESCENTAR decide-se quase todo. O concelho vem da CAOP (correr a seguir
     o gerar-concelhos.py) e a região vem do concelho (gerar-regioes.js). Falta
     o `m` — mar ou rio —, e esse não se adivinha pelo nome: 35 das 995 não
     seguem o nome («Azenhas do Guadiana» é rio, «Praia da Lagoa» é mar).
     Pergunta-se à API MARINHA da Open-Meteo: se ela devolve ondulação naquele
     ponto, é mar; se devolve nulos, é interior. Testado contra 24 praias que
     já cá estavam, 12 de cada: acertou nas 24.

   · APAGAR não se decide aqui. Uma praia que desaparece do OSM pode ter sido
     apagada por engano, ou renomeada de tal maneira que este programa não a
     reconheceu. Tirá-la do site sozinho é deixar uma edição de terceiros
     apagar conteúdo sem ninguém ver. Reporta-se, e decide-se à mão. */
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.dirname(__dirname);
const PRAIAS = path.join(RAIZ, 'data', 'praias.json');
const OSM = path.join(RAIZ, '_source', 'osm-praias.json');
const CONSULTA = path.join(RAIZ, '_source', 'overpass.txt');

const KM_IGUAL = 3.0;          /* o mesmo nome a menos disto é a mesma praia */
const M_MESMO_SITIO = 60;      /* coordenadas a menos disto são o mesmo ponto */
const KM_MESMA_PRAIA = 2.5;    /* o mesmo núcleo de nome a menos disto é a mesma praia */

/* O CAMPO `b` É A `normalizar()` DO app.js, e vai-se lá buscá-la em vez de a
   copiar. Copiei-a e divergiu à primeira praia: a do site troca TUDO o que não
   é letra ou dígito por espaço, e a minha guardava hífenes e apóstrofos —
   «Praia Tróia-Galé» ficou com `b` a dizer «praia troia-gale», que a procura
   nunca encontraria. O testar-slugs.js existe justamente para apanhar esta
   divergência, e apanhou-a. Uma função copiada é uma função que vai divergir;
   esta é lida do ficheiro que manda. */
const normalizar = (function () {
  const src = fs.readFileSync(path.join(RAIZ, 'assets', 'js', 'app.js'), 'utf8');
  const m = src.match(/function normalizar\(s\) \{[\s\S]*?\n {2}\}/);
  if (!m) { console.error('✗ não encontrei a normalizar() em app.js — mudou de forma?'); process.exit(1); }
  return new Function(m[0] + '; return normalizar;')();
})();

/* Para COMPARAR nomes (não para o campo `b`): o que interessa é reconhecer a
   mesma praia escrita de outra maneira, e aí os espaços a mais atrapalham. */
const semAcentos = (s) => normalizar(s || '').replace(/\s+/g, ' ').trim();

/* O NÚCLEO DO NOME — o que sobra depois de tirar o que não distingue nada.
   O OSM tem a mesma praia mais do que uma vez, e com nomes diferentes: o
   Furadouro está lá como way «Furadouro» e como duas relations «Praia do
   Furadouro - Norte» e «- Sul», a 520 m, 1,1 km e 1,6 km do ponto que o site
   usa. Sem isto, cada uma dessas aparecia como praia NOVA — três entradas para
   uma praia, e a mesma areia com três notas no ecrã. */
const nucleo = (s) => semAcentos(s)
  .replace(/^(praia|parque|zona)\s+(fluvial\s+)?(de|da|do|das|dos)?\s*/, '')
  /* O sufixo do lado corta-se DEPOIS de normalizar, e por isso não se procura o
     hífen: a normalizar() do app.js troca tudo o que não é letra ou dígito por
     espaço, portanto «Praia do Furadouro - Norte» chega aqui já sem o traço.
     Procurar «- norte» era procurar uma coisa que já não existe, e as duas
     metades do Furadouro voltavam a aparecer como praias novas.

     O RISCO, dito: isto engole um «X Norte» que seja mesmo uma praia à parte,
     se houver um «X» a menos de 2,5 km. Aceita-se — três cartões para a mesma
     areia é pior do que um cartão a menos, e o relatório do --verificar mostra
     sempre o que foi engolido. */
  .replace(/\s+(norte|sul|nascente|poente|este|oeste|centro|\d+)$/, '')
  .trim();
const coord = (e) => (e.center ? [e.center.lat, e.center.lon] : [e.lat, e.lon]);
const metros = (a, b) => Math.hypot((a[0] - b[0]) * 111320, (a[1] - b[1]) * 88000);

/* ------------------------------------------------------------ recolher --- */
async function recolher() {
  const q = fs.readFileSync(CONSULTA, 'utf8');
  /* O `User-Agent` não é cortesia, é requisito: sem ele o Overpass responde
     406 ao agente por omissão do Node. E o corpo vai como formulário, com o
     Content-Type explícito — é o que a API espera. */
  const r = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'praiometro.pt (actualizar-praias.js; renato.l.valente+praiometro@gmail.com)',
    },
    body: 'data=' + encodeURIComponent(q),
  });
  if (!r.ok) throw new Error('o Overpass respondeu ' + r.status);
  const d = await r.json();
  if (!d.elements || !d.elements.length) throw new Error('o Overpass devolveu zero elementos');
  fs.writeFileSync(OSM, JSON.stringify(d));
  console.log(`_source/osm-praias.json — ${d.elements.length} elementos, base ${d.osm3s.timestamp_osm_base}`);
  return d;
}

/* --------------------------------------------------------------- mar? ---- */
async function saoDeMar(pontos) {
  /* Uma chamada só, com todas as coordenadas: a API marinha aceita listas. */
  const la = pontos.map((p) => p[0].toFixed(4)).join(',');
  const lo = pontos.map((p) => p[1].toFixed(4)).join(',');
  const r = await fetch('https://marine-api.open-meteo.com/v1/marine?latitude=' + la
    + '&longitude=' + lo + '&hourly=wave_height&forecast_days=1&timezone=auto');
  if (!r.ok) throw new Error('a API marinha respondeu ' + r.status);
  let d = await r.json();
  if (!Array.isArray(d)) d = [d];
  return d.map((x) => {
    const h = ((x || {}).hourly || {}).wave_height || [];
    return h.some((v) => v != null) ? 1 : 0;
  });
}

/* ---------------------------------------------------------------- main --- */
(async function () {
  if (process.argv.includes('--recolher')) await recolher();

  const praias = JSON.parse(fs.readFileSync(PRAIAS, 'utf8'));
  const dados = JSON.parse(fs.readFileSync(OSM, 'utf8'));
  const base = (dados.osm3s || {}).timestamp_osm_base || '?';
  const dias = base === '?' ? null
    : Math.round((Date.now() - Date.parse(base)) / 86400000);

  /* A CÓPIA TEM IDADE, e é preciso dizê-la. Sem isto ninguém sabe se está a
     comparar com o OSM de hoje ou com o de há três meses — e a resposta «não
     há nada a mudar» quer dizer coisas muito diferentes nos dois casos. */
  console.log(`cópia do OSM: ${base}${dias == null ? '' : ` (há ${dias} dia${dias === 1 ? '' : 's'})`}`
    + `, ${dados.elements.length} elementos`);

  /* --- casar por nome + proximidade, que é como a lista foi montada ------ */
  const porNome = new Map();
  for (const p of praias) {
    const k = semAcentos(p.n);
    if (!porNome.has(k)) porNome.set(k, []);
    porNome.get(k).push(p);
  }
  const usadas = new Set();
  const novas = [], renomeadas = [];

  for (const e of dados.elements) {
    const nome = (e.tags || {}).name;
    if (!nome) continue;
    const c = coord(e);
    const iguais = (porNome.get(semAcentos(nome)) || [])
      .filter((p) => metros([p.la, p.lo], c) < KM_IGUAL * 1000);
    if (iguais.length) { iguais.forEach((p) => usadas.add(p)); continue; }
    /* A MESMA PRAIA COM OUTRO NOME? Compara-se o núcleo, num raio largo: o
       OSM parte praias grandes em pedaços com nomes derivados, e o centro de
       cada pedaço fica a mais de um quilómetro do ponto que o site usa. */
    const mesmoNucleo = praias.filter((p) => nucleo(p.n) === nucleo(nome)
      && metros([p.la, p.lo], c) < KM_MESMA_PRAIA * 1000);
    if (mesmoNucleo.length) { mesmoNucleo.forEach((p) => usadas.add(p)); continue; }
    /* Sem o nome: é o MESMO PONTO com outro nome, ou é ponto novo? */
    const noSitio = praias.filter((p) => metros([p.la, p.lo], c) < M_MESMO_SITIO);
    if (noSitio.length === 1 && !usadas.has(noSitio[0])) {
      renomeadas.push({ p: noSitio[0], de: noSitio[0].n, para: nome });
      usadas.add(noSitio[0]);
    } else if (!noSitio.length) {
      novas.push({ n: nome, la: +c[0].toFixed(5), lo: +c[1].toFixed(5), tipo: e.type });
    }
    /* noSitio.length > 1 ou já usada: é uma segunda representação da mesma
       praia (o OSM tem a mesma praia como way E como relation). Ignora-se. */
  }
  const sumidas = praias.filter((p) => !usadas.has(p));

  console.log(`  renomeadas no OSM: ${renomeadas.length}`);
  for (const r of renomeadas) console.log(`     «${r.de}» -> «${r.para}»`);
  console.log(`  novas no OSM: ${novas.length}`);
  for (const n of novas) console.log(`     ${n.n} (${n.tipo}) ${n.la},${n.lo}`);
  console.log(`  no site e já não no OSM: ${sumidas.length}`);
  for (const s of sumidas) console.log(`     ${s.n} ${s.la},${s.lo}`);

  const nada = !renomeadas.length && !novas.length && !sumidas.length;

  if (process.argv.includes('--verificar')) {
    if (nada) { console.log('✓ a lista bate certo com a cópia do OSM'); process.exit(0); }
    console.error('✗ a lista e o OSM divergem — correr: node _source/actualizar-praias.js');
    process.exit(1);
  }
  if (nada) { console.log('nada a fazer'); return; }

  /* --- aplicar o que se decide sozinho ---------------------------------- */
  for (const r of renomeadas) {
    r.p.n = r.para;
    r.p.b = normalizar(r.para);
  }
  if (novas.length) {
    const mar = await saoDeMar(novas.map((n) => [n.la, n.lo]));
    novas.forEach((n, i) => {
      praias.push({ n: n.n, b: normalizar(n.n), la: n.la, lo: n.lo, r: '', m: mar[i] });
      console.log(`  ${n.n}: a API marinha diz ${mar[i] ? 'MAR' : 'INTERIOR'}`);
    });
  }
  praias.sort((a, b) => (a.r || '').localeCompare(b.r || '', 'pt')
    || a.n.localeCompare(b.n, 'pt'));
  fs.writeFileSync(PRAIAS, '[\n' + praias.map((p) => JSON.stringify(p)).join(',\n') + '\n]\n');
  console.log(`data/praias.json — ${praias.length} praias`);
  if (sumidas.length) {
    console.log('');
    console.log('AS QUE SUMIRAM FICARAM NO FICHEIRO, de propósito: uma praia que');
    console.log('desaparece do OSM pode ter sido apagada por engano. Decide-se à mão.');
  }
  if (novas.length) {
    console.log('');
    console.log('A SEGUIR, e por esta ordem:');
    console.log('   python3 _source/gerar-concelhos.py     (o concelho das novas)');
    console.log('   node _source/gerar-regioes.js          (a região vem do concelho)');
    console.log('   node _source/gerar-slugs.js --escrever (o endereço de cada uma)');
    console.log('   node _source/gerar-praias.js           (os hubs)');
  }
})().catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
