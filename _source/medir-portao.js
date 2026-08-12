/* A porta de embarque da frase das horas.
   =============================================================
   Correr:  node _source/medir-portao.js [praias] [dias]
   Precisa de rede. NÃO corre no CI — é lento e depende de três APIs.

   PARA QUE SERVE. O site passou a dizer, em alguns dias, «Vai antes das 15h».
   Isso é uma afirmação sobre o futuro, e uma afirmação sobre o futuro ou se
   mede ou é conversa. Este ficheiro mede-a: pega na previsão que estava
   guardada para dias que JÁ PASSARAM, corre-lhe o portão em cima, e vai ver ao
   ERA5 o que aconteceu de facto nesses dias.

   AS TRÊS PERGUNTAS:
     1. Quando o portão dispara, as duas metades caíram MESMO em cores
        diferentes?  (precisão)
     2. E era mesmo a metade que o site apontou?  (sentido)
     3. Vale mais do que não filtrar nada?  (contra a taxa-base e contra a
        regra antiga dos 7 km/h, que este ficheiro também mede)

   COMO SE LÊ. A referência não é 100 %. É a TAXA-BASE: a fracção de dias-praia
   em que as metades caem realmente em cores diferentes. Se o portão disparar
   com uma precisão igual à taxa-base, não está a filtrar nada — está a
   sortear. O que o justifica é a distância a esse número.

   ATENÇÃO À DATA: esta medição vale para as janelas que estiverem no
   `modelo.js` no dia em que correr. Foi remedida quando as partes passaram a
   ser Manhã 9h-13h e Tarde 15h-19h (antes eram 11h-14h e 15h-19h) — os
   números publicados na /metodologia/ têm de vir DESTA corrida e não de uma
   anterior.

   HONESTIDADE SOBRE O MÉTODO, porque quem ler isto daqui a um ano merece
   saber onde é que a medição é frouxa:
     · O ERA5 é uma reanálise, não é a praia. Tem 25 km de resolução e alisa
       exactamente os fenómenos costeiros que nos interessam — a nortada e o
       estrato matinal. Onde ele diz que as metades não diferiram, pode ter
       sido ele a não ver.
     · A previsão arquivada é a de prazo curto (o arquivo guarda a corrida mais
       recente para cada hora). É o regime certo para medir isto, porque o
       portão só fala a 0 e 1 dias — mas não separa um prazo do outro.
     · O ERA5 não tem PROBABILIDADE de chuva, e o modelo usa-a. Isso obrigou a
       separar duas coisas que à primeira tentativa estavam misturadas:
         — O PORTÃO corre sobre a previsão INTACTA, exactamente como em
           produção. É o que se publica, e é o que tem de ser medido.
         — A RÉGUA que julga cada disparo põe a chuva a `null` dos dois lados,
           porque é a única escala em que a previsão e o ERA5 são comparáveis.
       Misturar as duas fazia o portão disparar sobre uma população que não é
       a que vai para o ar: na primeira tentativa deste ficheiro, 4 disparos na
       escala neutralizada contra 1 na escala de produção.
     · Por isso a medida PRINCIPAL é o SENTIDO — qual das metades era mesmo a
       melhor — que se lê pela nota bruta e não depende de nenhum corte de cor.
       A precisão por cor vem a seguir, e lê-se sempre contra a taxa-base
       medida na mesma régua. */
'use strict';
const path = require('path');
const fs = require('fs');

const RAIZ = path.dirname(__dirname);
require(path.join(RAIZ, 'assets/js/modelo.js'));
const M = globalThis.Modelo;

const MODELOS = ['ecmwf_ifs025', 'icon_seamless', 'gfs_seamless', 'ukmo_seamless'];
const HOURLY = ['temperature_2m', 'apparent_temperature', 'wind_speed_10m', 'wind_gusts_10m',
                'wind_direction_10m', 'cloud_cover', 'precipitation_probability', 'precipitation',
                'uv_index'];
/* O ERA5 não tem probabilidade de chuva. É a única coluna que falta, e é por
   isso que a chuva sai da conta dos dois lados. */
const HOURLY_ERA5 = HOURLY.filter((h) => h !== 'precipitation_probability');

const N_PRAIAS = +(process.argv[2] || 24);
const N_DIAS = +(process.argv[3] || 45);
/* O ERA5 anda cerca de cinco dias atrás do presente. Seis é folga. */
const ATRASO = 6;

/* ------------------------------------------------------------- utilitários */

function data(offsetDias) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDias);
  return d.toISOString().slice(0, 10);
}

async function json(url, tentativa) {
  tentativa = tentativa || 1;
  try {
    const r = await fetch(url);
    if (r.status === 429 || r.status >= 500) throw new Error('http ' + r.status);
    const j = await r.json();
    if (j.error) throw new Error(j.reason || 'erro da API');
    return j;
  } catch (e) {
    if (tentativa >= 3) throw e;
    await new Promise((s) => setTimeout(s, 2000 * tentativa));
    return json(url, tentativa + 1);
  }
}

/* Amostra espalhada por latitude: do Minho ao Algarve, e não um bolo só. */
function amostra(n) {
  const todas = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/praias.json'), 'utf8'));
  const mar = todas.filter((p) => p.m === 1).sort((a, b) => b.la - a.la);
  const passo = mar.length / n;
  const out = [];
  for (let i = 0; i < n; i++) out.push(mar[Math.floor(i * passo)]);
  return out;
}

/* A chuva a null dos dois lados. Mexe numa cópia: o `d` original ainda serve
   para contar os disparos com a previsão intacta. */
function semChuva(d) {
  if (!d) return null;
  const c = Object.assign({}, d);
  c.chuva = null;
  return c;
}

function pct(a, b) { return b ? (a / b * 100).toFixed(1) + ' %' : '—'; }

/* ------------------------------------------------------------- descarregar */

async function puxar(p, de, ate) {
  const q = 'latitude=' + p.la + '&longitude=' + p.lo
    + '&start_date=' + de + '&end_date=' + ate + '&timezone=Europe%2FLisbon';
  const previsao = await json('https://historical-forecast-api.open-meteo.com/v1/forecast?' + q
    + '&hourly=' + HOURLY.join(',') + '&models=' + MODELOS.join(','));
  const marinho = await json('https://marine-api.open-meteo.com/v1/marine?' + q
    + '&hourly=sea_surface_temperature,wave_height').catch(() => null);
  const era5 = await json('https://archive-api.open-meteo.com/v1/archive?' + q
    + '&hourly=' + HOURLY_ERA5.join(','));
  return { previsao, marinho, era5 };
}

/* ------------------------------------------------------------------ medida */

async function main() {
  const de = data(ATRASO + N_DIAS - 1), ate = data(ATRASO);
  const praias = amostra(N_PRAIAS);
  console.log(`porta de embarque — ${praias.length} praias, ${de} a ${ate} (${N_DIAS} dias)\n`);

  const c = {
    diasPraia: 0, semDados: 0,
    baseDiferentes: 0,              /* verdade: metades em cores diferentes */
    disparos: 0, acertosCor: 0, acertosSentido: 0,
    disparosCedo: 0, acertosCedo: 0, acertosCedoSentido: 0,
    disparosTarde: 0, acertosTarde: 0, acertosTardeSentido: 0,
    semPortao: 0, semPortaoAcertos: 0,   /* só «cores diferentes na previsão» */
    antiga: 0, antigaAcertos: 0,         /* a regra dos 7 km/h que se apagou */
    antigaMesmaCor: 0,
  };
  const exemplos = [];

  for (const p of praias) {
    let dados;
    try { dados = await puxar(p, de, ate); }
    catch (e) { console.log(`  ! ${p.n}: ${e.message}`); continue; }

    const { previsao, marinho, era5 } = dados;
    const cons = M.consenso(previsao, MODELOS);
    const dias = [...new Set((cons.hourly.time || []).map((t) => t.slice(0, 10)))];

    for (const dia of dias) {
      /* ---- lado da previsão, INTACTO: é sobre isto que o portão decide ---- */
      const pDia = M.agregarBlocos(cons, marinho, p, dia, M.BLOCOS_DIA);
      const met = M.metadesDoDia(cons, marinho, p, dia, true);
      /* ---- lado da verdade ---- */
      const vManha = M.agregarJanela(era5, marinho, p, dia, M.PARTES[0].ini, M.PARTES[0].fim);
      const vTarde = M.agregarJanela(era5, marinho, p, dia, M.PARTES[1].ini, M.PARTES[1].fim);
      if (!pDia || !met.manha || !met.tarde || !vManha || !vTarde) { c.semDados++; continue; }
      c.diasPraia++;
      /* ---- a régua: a mesma escala dos dois lados, sem a chuva ---- */
      const pManha = semChuva(met.manha), pTarde = semChuva(met.tarde);

      const cvm = M.classificarDia(semChuva(vManha)), cvt = M.classificarDia(semChuva(vTarde));
      const verdadeDifere = cvm.cor !== cvt.cor;
      if (verdadeDifere) c.baseDiferentes++;
      /* O sentido lê-se pela nota bruta, que existe mesmo quando há veto e não
         depende de nenhum corte de cor — é a medida menos frágil das duas. */
      const ladoVerdade = cvm.notaBruta === cvt.notaBruta ? null
        : (cvm.notaBruta > cvt.notaBruta ? 'manha' : 'tarde');

      /* ---- O PORTÃO, exactamente como corre em produção ---- */
      const conselho = M.conselhoMetades(M.classificarDia(pDia), met, 0, null);

      /* ---- a regra que se apagou: média da tarde 7 km/h acima da manhã ---- */
      const mediaVento = (a, b) => {
        const ix = [];
        (cons.hourly.time || []).forEach((t, i) => {
          if (t.slice(0, 10) !== dia) return;
          const h = +t.slice(11, 13);
          if (h >= a && h <= b) ix.push(i);
        });
        const v = ix.map((i) => cons.hourly.wind_speed_10m[i]).filter((x) => x != null);
        return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
      };
      const vm7 = mediaVento(M.PARTES[0].ini, M.PARTES[0].fim), vt7 = mediaVento(M.PARTES[1].ini, M.PARTES[1].fim);
      const corManhaProd = M.classificarDia(met.manha).cor;
      const corTardeProd = M.classificarDia(met.tarde).cor;
      if (vm7 != null && vt7 != null && Math.round(vt7) - Math.round(vm7) >= 7) {
        c.antiga++;
        if (verdadeDifere) c.antigaAcertos++;
        /* pelo seu próprio critério: as metades previstas acabam da mesma cor */
        if (corManhaProd === corTardeProd) c.antigaMesmaCor++;
      }

      /* ---- a regra sem portão: só «cores diferentes na previsão» ---- */
      if (corManhaProd !== corTardeProd) {
        c.semPortao++;
        if (verdadeDifere) c.semPortaoAcertos++;
      }

      if (!conselho) continue;
      c.disparos++;
      if (verdadeDifere) c.acertosCor++;
      if (ladoVerdade === conselho.lado) c.acertosSentido++;
      if (conselho.lado === 'manha') {
        c.disparosCedo++;
        if (verdadeDifere) c.acertosCedo++;
        if (ladoVerdade === 'manha') c.acertosCedoSentido++;
      } else {
        c.disparosTarde++;
        if (verdadeDifere) c.acertosTarde++;
        if (ladoVerdade === 'tarde') c.acertosTardeSentido++;
      }

      if (exemplos.length < 14) {
        const cpm = M.classificarDia(met.manha), cpt = M.classificarDia(met.tarde);
        exemplos.push(`${dia}  ${p.n}\n      disse:  ${conselho.texto}`
          + `\n      previu: manhã ${cpm.nota} ${cpm.cor}, tarde ${cpt.nota} ${cpt.cor}`
          + `\n      ERA5:   manhã ${cvm.notaBruta} ${cvm.cor}, tarde ${cvt.notaBruta} ${cvt.cor}`
          + `   ${ladoVerdade === conselho.lado ? '✓ sentido' : '✗ SENTIDO ERRADO'}`
          + `, ${verdadeDifere ? '✓ cores diferentes' : '~ mesma cor'}`);
      }
    }
    process.stdout.write('.');
  }

  /* ------------------------------------------------------------ o veredicto */
  const base = c.baseDiferentes / c.diasPraia * 100;
  const prec = c.acertosCor / c.disparos * 100;
  const sentido = c.acertosSentido / c.disparos * 100;

  console.log('\n\n' + '='.repeat(64));
  console.log(`amostra:            ${c.diasPraia} dias-praia  (${c.semDados} sem dados suficientes)`);
  console.log(`TAXA-BASE:          ${pct(c.baseDiferentes, c.diasPraia)} dos dias tiveram mesmo as metades em cores diferentes`);
  console.log('-'.repeat(64));
  console.log(`a regra ANTIGA (7 km/h de média), que se apagou:`);
  console.log(`  dispara em        ${pct(c.antiga, c.diasPraia)} dos dias  (${c.antiga})`);
  console.log(`  acerta            ${pct(c.antigaAcertos, c.antiga)}`);
  console.log(`  e em              ${pct(c.antigaMesmaCor, c.antiga)} dos disparos as metades previstas nem sequer mudam de cor`);
  console.log('-'.repeat(64));
  console.log(`SEM portão (só «cores diferentes na previsão»):`);
  console.log(`  dispara em        ${pct(c.semPortao, c.diasPraia)} dos dias  (${c.semPortao})`);
  console.log(`  acerta            ${pct(c.semPortaoAcertos, c.semPortao)}`);
  console.log('-'.repeat(64));
  console.log(`COM portão (cor diferente + ${M.LIMIAR_METADES} pontos + ${M.SIGMAS_METADES}σ + acordo no sinal):`);
  console.log(`  dispara em        ${pct(c.disparos, c.diasPraia)} dos dias  (${c.disparos})`);
  console.log(`  SENTIDO           ${pct(c.acertosSentido, c.disparos)}   <- a medida principal`);
  console.log(`  precisão por cor  ${pct(c.acertosCor, c.disparos)}   (taxa-base ${base.toFixed(1)} %)`);
  console.log(`  ramo «vai cedo»   ${c.disparosCedo} disparos, sentido ${pct(c.acertosCedoSentido, c.disparosCedo)}, cor ${pct(c.acertosCedo, c.disparosCedo)}`);
  console.log(`  ramo «pela tarde» ${c.disparosTarde} disparos, sentido ${pct(c.acertosTardeSentido, c.disparosTarde)}, cor ${pct(c.acertosTarde, c.disparosTarde)}`);
  console.log('='.repeat(64));

  if (exemplos.length) console.log('\ndisparos, um a um:\n  ' + exemplos.join('\n  ') + '\n');

  /* A barra. Está escrita aqui, e não num comentário, para poder falhar. */
  const falhas = [];
  if (c.disparos < 60) falhas.push(`só ${c.disparos} disparos, preciso de 60 para o número significar alguma coisa`);
  if (sentido < 75) falhas.push(`sentido ${sentido.toFixed(1)} % — abaixo dos 75 % exigidos`);
  if (prec < 55) falhas.push(`precisão por cor ${prec.toFixed(1)} % — abaixo dos 55 % exigidos`);
  if (prec <= base + 10) falhas.push(`precisão por cor ${prec.toFixed(1)} % não se afasta o suficiente da taxa-base ${base.toFixed(1)} % — o portão não está a filtrar, está a sortear`);
  /* O ramo caro conta-se à parte: se falhar sozinho, desliga-se sozinho
     (ACORDO_TARDE a 5) e publica-se só o «vai cedo». */
  if (c.disparosTarde >= 20 && c.acertosTardeSentido / c.disparosTarde < 0.75) {
    falhas.push(`o ramo «espera pela tarde» acerta o sentido em ${pct(c.acertosTardeSentido, c.disparosTarde)} — `
      + `põe ACORDO_TARDE a 5 para o desligar e publica só o «vai cedo»`);
  }

  if (falhas.length) {
    console.log('NÃO PUBLICAR A FRASE:');
    falhas.forEach((f) => console.log('   · ' + f));
    console.log('\nO resto da alteração publica-se na mesma: apagar a regra dos 7 km/h,');
    console.log('que esta medição mostra ser pior do que o silêncio, e corrigir o rótulo');
    console.log('do vento em «Ver os números».');
    process.exit(1);
  }
  console.log('PODE PUBLICAR — a frase ganhou o seu lugar.');
}

main().catch((e) => { console.error(e); process.exit(1); });
