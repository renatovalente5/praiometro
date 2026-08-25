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

/* AS ÁGUAS FECHADAS DA COSTA, uma a uma e com a razão à frente.
   =============================================================
   O `m` significa «a grelha marinha da Open-Meteo descreve esta água», e não
   «tem água salgada». Uma ria, uma lagoa costeira ou uma barrinha é água do
   mar — e a grelha marinha descreve-a MAL, porque não tem célula lá dentro:
   encaixa no oceano aberto mais próximo e responde com números de lá.

   Medido no arquivo de Junho a Setembro de 2025, janela das 9h às 19h:

     Praia da Foz do Arelho-Lagoa   19 dos 122 dias com veto de «mar muito
                                    cavado», 15,6 %, ondas até 4,88 m
     Carcavelos (mar aberto)         4 dos 122 dias, 3,3 %, ondas até 4,52 m

   A lagoa leva quase cinco vezes mais vetos de mar cavado do que uma praia
   oceânica — por ondulação que ela não tem. E a Armona-Ria recebe EXACTAMENTE
   os mesmos números que a Armona-Mar, a 1,3 km: a mesma célula serve as duas,
   uma dentro da ria e outra virada ao Atlântico.

   No outro sentido é igualmente errado: a temperatura do oceano servida a uma
   lagoa fechada tira-lhe pontos de água que ela tem de sobra no Verão.

   Marcadas `m=0`, ficam sem factor de água — o modelo reparte esses pontos
   pelos outros, como já faz nas praias de rio. É menos errado do que descrever
   água parada com a ondulação do Atlântico.

   ISTO É CURADORIA, e é assim de propósito: o nome não chega (a «Praia da
   Lagoa» é no concelho de Lagoa e é mar aberto, a «Praia de Lagoa I» é na
   costa de Vila do Conde), e a API marinha também não — ela responde em toda a
   costa, portanto nunca diz «esta água não é minha». Verificadas as seis
   candidatas por nome que NÃO entram: todas apanham célula a menos de 3 km. */
const AGUA_FECHADA = {
  /* Ria Formosa: as quatro «-Ria» estão do lado de dentro das ilhas-barreira,
     e três delas têm a irmã «-Mar» no ficheiro, a menos de 1,5 km. */
  '37.0234,-7.8047': 'Armona: lado da ria, com a Armona-Mar a 1,3 km',
  '37.0500,-7.7443': 'Fuseta: lado da ria, com a Fuseta-Mar a 0,6 km',
  '36.9811,-7.8615': 'Farol: lado da ria, com a Praia do Farol a 0,5 km',
  '37.1151,-7.6234': 'Tavira: lado da ria',
  /* Lagoas costeiras fechadas por cordão de areia. */
  '39.4290,-9.2245': 'Lagoa de Óbidos, com a Foz do Arelho de mar a 0,6 km',
  '38.5048,-9.1793': 'Lagoa de Albufeira, fechada por cordão dunar',
  '40.9661,-8.6521': 'Barrinha de Esmoriz',
  /* Estuário. O Minho em Vila Nova de Cerveira está a 10 km da foz, e a grelha
     marinha responde-lhe com o Atlântico — a única praia com «fluvial» no nome
     que ficou marcada como mar. */
  '41.9566,-8.7461': 'Praia Fluvial da Lenta: estuário do Minho, a 10 km da foz',
};

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
/* Os servidores do Overpass. O de.de é o principal; o kumi é espelho. Nenhum
   deles é de confiança sozinho: numa tarde apanhei 400, 406, 502 e 504, e uma
   consulta que esgota o tempo devolve HTTP 200 com uma lista vazia. */
const ESPELHOS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

async function umaConsulta(q, n) {
  let ultimo = null;
  for (let volta = 0; volta < 4; volta++) {
    const url = ESPELHOS[volta % ESPELHOS.length];
    try {
      return await pedir(url, q, n);
    } catch (e) {
      ultimo = e;
      const transitorio = /respost(a|as) (429|50[0-4])|fetch failed|aviso|zero elementos/.test(e.message);
      if (!transitorio) throw e;
      const espera = 15 * (volta + 1);
      console.log(`   consulta ${n}: ${e.message.slice(0, 70)} — outra vez em ${espera}s`);
      await new Promise((r) => setTimeout(r, espera * 1000));
    }
  }
  throw ultimo;
}

async function pedir(url, q, n) {
  /* O `User-Agent` não é cortesia, é requisito: sem ele o Overpass responde
     406 ao agente por omissão do Node. E o corpo vai como formulário, com o
     Content-Type explícito — é o que a API espera. */
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'praiometro.pt (actualizar-praias.js; renato.l.valente+praiometro@gmail.com)',
    },
    /* SEM OS COMENTÁRIOS. O ficheiro está cheio deles — é onde vive a razão de
       cada ramo — mas nem todos os espelhos os digerem, e são bytes a viajar
       para nada. Tira-se aqui e o ficheiro fica legível para quem o lê. */
    body: 'data=' + encodeURIComponent(
      q.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n').trim()),
  });
  if (!r.ok) throw new Error(`a consulta ${n} teve resposta ${r.status}`);
  const d = await r.json();
  /* O `remark` É UM ERRO, e vem com HTTP 200 e uma lista vazia. Uma consulta
     que esgota o tempo devolve exactamente isto, e quem só olhe para a
     contagem lê «zero elementos» e conclui que não há nada em Portugal. */
  if (d.remark) throw new Error(`a consulta ${n} devolveu um aviso: ${d.remark.slice(0, 120)}`);
  if (!d.elements || !d.elements.length) throw new Error(`a consulta ${n} devolveu zero elementos`);
  console.log(`   consulta ${n}: ${d.elements.length} elementos`);
  return d;
}

async function recolher() {
  /* O ficheiro traz DUAS consultas, separadas por uma linha de ---: a segunda
     procura por nome em todo o país e esgota o tempo se for junta com a
     primeira. Juntam-se aqui os resultados, sem repetir elementos. */
  const partes = fs.readFileSync(CONSULTA, 'utf8').split(/^---$/m)
    .map((x) => x.trim()).filter(Boolean);
  const vistos = new Set(), elements = [];
  let base = null;
  for (let i = 0; i < partes.length; i++) {
    if (i) await new Promise((r) => setTimeout(r, 8000));   /* educação com o servidor */
    const d = await umaConsulta(partes[i], i + 1);
    base = base || (d.osm3s || {}).timestamp_osm_base;
    for (const e of d.elements) {
      const k = e.type + e.id;
      if (vistos.has(k)) continue;
      vistos.add(k);
      elements.push(e);
    }
  }
  const d = { osm3s: { timestamp_osm_base: base }, elements };
  fs.writeFileSync(OSM, JSON.stringify(d));
  console.log(`_source/osm-praias.json — ${elements.length} elementos únicos, base ${base}`);
  return d;
}

/* ---------------------------------------------------------------- lixo --- */
/* O QUE NÃO É SÍTIO DE BANHO SAI POR ETIQUETA, NUNCA POR NOME.
   A consulta por nome traz paragens de autocarro chamadas «Praia Fluvial de
   X», painéis informativos, parques de merendas e cafés. Filtrar por nome
   parece mais simples e é pior: deixa passar piscinas municipais chamadas
   «Piscina Natural» e classifica uma poça geotérmica dos Açores como praia de
   mar, a receber ondulação do Atlântico a 362 m de altitude.

   O que FICA: areal e calhau (`natural=beach|shingle`), zonas de banho
   designadas (`leisure=swimming_area|beach_resort|bathing_place`), banhos
   públicos (`amenity=public_bath`, que é como as piscinas naturais dos Açores
   e da Madeira estão mapeadas) e massas de água nomeadas. */
const MANTER_NATURAL = new Set(['beach', 'shingle', 'water']);
const MANTER_LEISURE = new Set(['swimming_area', 'beach_resort', 'bathing_place']);
const FORA_BATH = new Set(['pool', 'thermal', 'hot_spring', 'onsen']);
const FORA_LEISURE = new Set(['water_park', 'swimming_pool', 'park', 'pitch', 'playground',
  'sports_centre', 'fitness_centre', 'garden', 'marina', 'slipway', 'picnic_table']);
const FORA_TOURISM = new Set(['camp_site', 'caravan_site', 'information', 'picnic_site',
  'hotel', 'guest_house', 'apartment', 'viewpoint', 'artwork', 'museum']);
const FORA_AMENITY = new Set(['cafe', 'restaurant', 'bar', 'parking', 'toilets', 'fuel',
  'pub', 'shelter', 'bench', 'drinking_water', 'waste_basket', 'fast_food', 'ice_cream']);

/* Devolve a RAZAO por que se descarta, ou null para ficar. */
function lixo(t) {
  /* O AREAL MANDA, e vem PRIMEIRO. Cinco praias fluviais estão mapeadas como
     `leisure=park` E `natural=beach` ao mesmo tempo — o parque de merendas e o
     areal são o mesmo polígono. Com as exclusões a correr primeiro, o
     `leisure=park` ganhava e o areal era descartado: cinco praias que já
     estavam no site desapareciam dele. Uma praia continua a ser uma praia
     ainda que também seja outra coisa. */
  if (t.natural && MANTER_NATURAL.has(t.natural)) return null;
  if (t.public_transport || t.highway || t.railway || t.aeroway) return 'transporte ou via';
  if (t.man_made) return 'construcao (' + t.man_made + ')';
  if (['spring', 'hot_spring', 'geyser'].includes(t.natural)) return 'nascente ou termal';
  if (t['bath:type'] && FORA_BATH.has(t['bath:type'])) return 'termas ou piscina (' + t['bath:type'] + ')';
  if (t.leisure && FORA_LEISURE.has(t.leisure)) return 'lazer=' + t.leisure;
  if (t.tourism && FORA_TOURISM.has(t.tourism)) return 'turismo=' + t.tourism;
  if (t.amenity && FORA_AMENITY.has(t.amenity)) return 'amenity=' + t.amenity;
  /* UM EDIFÍCIO NÃO É UMA PRAIA. Apanha as termas: o «Balneário das Termas de
     Caldelas» está mapeado como `amenity=public_bath` + `building=yes` com dois
     pisos. E um `barrier` é um recinto murado. */
  if (t.building) return 'edificio';
  if (t.barrier) return 'recinto murado (' + t.barrier + ')';
  /* PAGA-SE À ENTRADA: é um equipamento, não uma água balnear. */
  if (t.fee === 'yes') return 'entrada paga';
  /* `amenity=public_bath` NU, sem nada que corrobore que ali há água em que se
     entra — nem `sport`, nem `natural`, nem `leisure`, nem `water`. É como
     estão mapeadas as termas, os balneários municipais e a Caldeira Velha, que
     é um parque geotérmico pago com horário de abertura. As piscinas naturais
     dos Açores e da Madeira, que são o que se quer, trazem `sport=swimming` ou
     `natural=water` ao lado. */
  if (t.amenity === 'public_bath'
      && !(t.sport || t.natural || t.leisure || t.water)) {
    return 'banho publico sem agua corroborada';
  }
  if (t.leisure && MANTER_LEISURE.has(t.leisure)) return null;
  if (t.amenity === 'public_bath') return null;
  if (t.water) return null;
  return 'sem etiqueta que o classifique como sitio de banho';
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
  const novas = [], renomeadas = [], outroNome = [];

  const descartados = new Map();
  for (const e of dados.elements) {
    const nome = (e.tags || {}).name;
    if (!nome) continue;
    const porque = lixo(e.tags || {});
    if (porque) { descartados.set(porque, (descartados.get(porque) || 0) + 1); continue; }
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
      /* SÓ O `natural=beach` RENOMEIA. A lista foi montada a partir dessa
         etiqueta, e é dela que um nome novo é mesmo um nome novo. Os ramos
         acrescentados a 25/08/2026 trazem OUTROS objectos no mesmo sítio: uma
         `leisure=swimming_area` a dois metros de uma praia, com o nome escrito
         de outra maneira. Tratá-los como renomeação estragava dados — uma
         delas ia trocar «Praia Fluvial dos Olhos d'Água do Alviela» por
         «Praia Fluvial Dos Olhos De Água», com maiúsculas a meio e um
         topónimo a menos. Reportam-se, e decide-se à mão. */
      const eBeach = (e.tags || {}).natural === 'beach';
      if (eBeach) {
        renomeadas.push({ p: noSitio[0], de: noSitio[0].n, para: nome });
      } else {
        outroNome.push({ p: noSitio[0], osm: nome, etiqueta:
          Object.entries(e.tags).filter(([k]) => ['natural','leisure','amenity'].includes(k))
            .map(([k, v]) => k + '=' + v).join(' ') });
      }
      usadas.add(noSitio[0]);
    } else if (!noSitio.length) {
      /* E ENTRE OS PROPRIOS NOVOS: o OSM tem a mesma poca mapeada como
         `amenity=public_bath` e como `leisure=swimming_area`, com nomes
         parecidos e a poucos metros. Sem isto entravam as duas. */
      /* A MESMA MEDIDA que se usa contra os que já lá estão — 60 m —, e não
         uma mais larga. Tinha aqui 300 m e era inconsistente: na primeira
         corrida engolia onze sítios com nomes próprios, e na corrida seguinte
         eles reapareciam como novos porque contra o ficheiro a medida é
         outra. Nos Açores e na Madeira duas poças com nome diferente a 80 m
         são duas poças, não uma mapeada duas vezes. */
      const jaNovo = novas.some((x) => metros([x.la, x.lo], c) < M_MESMO_SITIO
        || (nucleo(x.n) === nucleo(nome) && metros([x.la, x.lo], c) < KM_MESMA_PRAIA * 1000));
      if (!jaNovo) novas.push({ n: nome, la: +c[0].toFixed(5), lo: +c[1].toFixed(5), tipo: e.type });
    }
    /* noSitio.length > 1 ou já usada: é uma segunda representação da mesma
       praia (o OSM tem a mesma praia como way E como relation). Ignora-se. */
  }
  const sumidas = praias.filter((p) => !usadas.has(p));
  if (descartados.size) {
    const total = [...descartados.values()].reduce((a, b) => a + b, 0);
    console.log(`  descartados por nao serem sitio de banho: ${total}`);
    for (const [k, v] of [...descartados].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
      console.log(`     ${v.toString().padStart(4)} - ${k}`);
    }
  }

  /* As águas fechadas impõem-se em TODAS as corridas, e não só quando entra
     uma praia nova: sem isto, uma reimportação devolvia-lhes o `m=1` e o veto
     de mar cavado voltava sem ninguém dar por ele. */
  const fechadas = [];
  for (const p of praias) {
    const k = `${p.la.toFixed(4)},${p.lo.toFixed(4)}`;
    if (AGUA_FECHADA[k] && p.m !== 0) fechadas.push({ p, porque: AGUA_FECHADA[k] });
  }
  const orfas = Object.keys(AGUA_FECHADA).filter((k) =>
    !praias.some((p) => `${p.la.toFixed(4)},${p.lo.toFixed(4)}` === k));
  if (orfas.length) {
    console.log(`  ⚠ ${orfas.length} coordenada(s) de água fechada já não existem na lista:`);
    for (const o of orfas) console.log(`     ${o} — ${AGUA_FECHADA[o]}`);
  }
  console.log(`  águas fechadas marcadas como mar: ${fechadas.length}`);
  for (const f of fechadas) console.log(`     ${f.p.n} — ${f.porque}`);

  if (outroNome.length) {
    console.log(`  mesmo sítio, outro objecto do OSM com outro nome: ${outroNome.length}`);
    console.log('     (não se aplicam: só o natural=beach renomeia — ver o comentário)');
    for (const o of outroNome.slice(0, 6)) {
      console.log(`     «${o.p.n}» tem lá um ${o.etiqueta} chamado «${o.osm}»`);
    }
  }
  console.log(`  renomeadas no OSM: ${renomeadas.length}`);
  for (const r of renomeadas) console.log(`     «${r.de}» -> «${r.para}»`);
  console.log(`  novas no OSM: ${novas.length}`);
  for (const n of novas) console.log(`     ${n.n} (${n.tipo}) ${n.la},${n.lo}`);
  console.log(`  no site e já não no OSM: ${sumidas.length}`);
  for (const s of sumidas) console.log(`     ${s.n} ${s.la},${s.lo}`);

  const nada = !renomeadas.length && !novas.length && !sumidas.length && !fechadas.length;

  if (process.argv.includes('--verificar')) {
    if (nada) { console.log('✓ a lista bate certo com a cópia do OSM'); process.exit(0); }
    console.error('✗ a lista e o OSM divergem — correr: node _source/actualizar-praias.js');
    process.exit(1);
  }
  if (nada) { console.log('nada a fazer'); return; }

  /* --- aplicar o que se decide sozinho ---------------------------------- */
  /* Sem tocar no `b`: ele saiu do ficheiro e é derivado no carregamento, com
     esta mesma `normalizar()`. Escrevê-lo aqui era repor 6 KB por visita para
     dizer o que o browser calcula sozinho. */
  for (const r of renomeadas) r.p.n = r.para;
  for (const f of fechadas) f.p.m = 0;
  if (novas.length) {
    const mar = await saoDeMar(novas.map((n) => [n.la, n.lo]));
    novas.forEach((n, i) => {
      praias.push({ n: n.n, la: n.la, lo: n.lo, r: '', m: mar[i] });
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
