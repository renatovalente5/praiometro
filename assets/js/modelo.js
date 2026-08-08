/* =============================================================
   MODELO DE CLASSIFICAÇÃO — está bom para a praia?
   =============================================================
   A especificação completa, com a origem de cada limiar, está em MODELO.md.
   Resumo: esqueleto do HCI:Beach (Rutty, Scott & Steiger), recalibrado para
   Portugal — porque o índice original não tem temperatura da água, calibra o
   conforto térmico para 30-36 °C e dá ao vento apenas 10%.

   Este ficheiro não toca no DOM nem faz pedidos. Recebe números, devolve um
   veredicto. É de propósito: assim testa-se sozinho.
   ============================================================= */
(function (raiz) {
  'use strict';

  /* Quando se vai à praia. Tudo o que está fora desta janela é ignorado. */
  var HORA_INI = 11;
  var HORA_FIM = 19;

  /* Pesos. Somam 100 nas praias de mar.
     O vento leva 34 — mais do que qualquer outro factor, e mais do triplo do
     que o HCI:Beach lhe dá. Em Portugal é o que mais dias estraga, e um dia de
     praia sem vento nenhum é uma coisa que se nota e se agradece. */
  var PESOS = { ceu: 26, vento: 34, ar: 18, agua: 14, chuva: 8 };

  /* --------------------------------------------------- tabelas de pontos */

  /* ------- as curvas dos factores -------
     Estas cinco funções eram escadas: cada patamar devolvia um valor fixo, e
     ao passar a fronteira a nota caía de uma vez. Media-se 8 pontos de queda
     entre 19 e 20 km/h de vento, e 5 pontos entre 24,9 °C e 25,0 °C — este
     último invisível, porque o ecrã mostra os dois como «25 °C». Duas praias
     lado a lado apareciam a 77 e a 64 por causa de 1 km/h.

     Agora é a MESMA calibração, mas interpolada: as tabelas abaixo são os
     pontos por onde a curva passa, e entre eles a nota varia a pouco e pouco.
     Os valores das tabelas são os dos patamares antigos, colocados no ponto
     que os representa — daí a nota de um dia típico não se mexer, e só as
     fronteiras deixarem de ser precipícios. */
  function interpolar(tabela, x) {
    if (x <= tabela[0][0]) return tabela[0][1];
    var ultimo = tabela[tabela.length - 1];
    if (x >= ultimo[0]) return ultimo[1];
    for (var i = 1; i < tabela.length; i++) {
      var a = tabela[i - 1], b = tabela[i];
      if (x <= b[0]) {
        /* x === a[0] dá t = 0 e devolve a[1] exacto: os pontos da tabela são
           valores calibrados e não podem sair alterados por aritmética. */
        var t = (x - a[0]) / (b[0] - a[0]);
        return a[1] + t * (b[1] - a[1]);
      }
    }
    return ultimo[1];
  }

  /* Vento médio, km/h a 10 m. A descida mais acentuada continua a ser nos
     20-25 km/h: é aí que começa o transporte de areia por saltação (~19 km/h,
     convertido da velocidade de atrito) e é aí que a nortada é definida
     (25 km/h). Até aos 8 km/h é planalto: mar chão, toalha imóvel — o dia que
     se procura, e não há prémio a dar acima disso. */
  var CURVA_VENTO = [[0, 34], [8, 34], [10, 31], [14, 27], [17.5, 23],
                     [22, 15], [30, 7], [36, 2], [42, 0]];
  function pontosVento(v) {
    if (v == null) return null;
    return interpolar(CURVA_VENTO, v);
  }

  var CURVA_CEU = [[0, 26], [20, 26], [30, 23], [50, 17], [70, 9], [90, 4], [100, 4]];
  function pontosCeu(n) {
    if (n == null) return null;
    return interpolar(CURVA_CEU, n);
  }

  /* Temperatura APARENTE, não a do termómetro: é a que inclui vento e humidade.
     Curva com dois lados: 25-31 °C é o planalto, e cai para os dois extremos —
     16 °C tem veto próprio («frio a mais»), e acima de 40 °C também não é dia
     de areia. */
  var CURVA_AR = [[15.5, 0], [17.5, 3], [20.5, 7], [23.5, 13], [25, 18],
                  [31, 18], [32.5, 13], [35.5, 7], [38.5, 3], [40.5, 0]];
  function pontosAr(t) {
    if (t == null) return null;
    return interpolar(CURVA_AR, t);
  }

  /* A escala portuguesa. O Atlântico continental anda nos 17-20 °C em Agosto;
     uma escala mediterrânica marcava o país inteiro a vermelho todo o ano. */
  var CURVA_AGUA = [[13, 0], [15, 2], [17, 4], [18.5, 8], [21, 11], [22, 14], [30, 14]];
  function pontosAgua(t) {
    if (t == null) return null;
    return interpolar(CURVA_AGUA, t);
  }

  var CURVA_CHUVA = [[0, 8], [8, 8], [17.5, 6], [35, 3], [57.5, 1], [70, 0], [100, 0]];
  function pontosChuva(p) {
    if (p == null) return null;
    return interpolar(CURVA_CHUVA, p);
  }

  /* ------------------------------------------------------------ palavras */

  function palavrasVento(v) {
    if (v == null) return '';
    if (v <= 8) return 'Sem vento nenhum';
    if (v <= 12) return 'A toalha fica quieta';
    if (v <= 16) return 'Brisa agradável';
    if (v <= 19) return 'Venta um pouco';
    if (v <= 25) return 'Já levanta alguma areia';
    if (v <= 32) return 'Vento forte, areia na toalha';
    if (v <= 40) return 'Vento muito forte, areia na cara';
    return 'Impraticável';
  }
  function palavrasCeu(n) {
    if (n == null) return '';
    if (n <= 20) return 'Sol aberto';
    if (n <= 40) return 'Sol com algumas nuvens';
    if (n <= 60) return 'Sol e nuvens a meias';
    if (n <= 80) return 'Muito nublado';
    return 'Céu tapado';
  }
  function palavrasAr(t) {
    if (t == null) return '';
    if (t < 16) return 'Frio para estar parado';
    if (t < 19) return 'Fresco';
    if (t < 22) return 'Ameno';
    if (t < 25) return 'Agradável';
    if (t <= 31) return 'Calor de praia';
    if (t <= 34) return 'Muito calor';
    return 'Calor a mais';
  }
  function palavrasAgua(t) {
    if (t == null) return '';
    if (t >= 24) return 'Está óptima';
    if (t >= 22) return 'Está boa';
    if (t >= 20) return 'Dá bem';
    if (t >= 18) return 'Fresca, entra-se aos poucos';
    if (t >= 16) return 'Fria';
    if (t >= 14) return 'Muito fria';
    return 'Gelada';
  }
  function palavrasChuva(p) {
    if (p == null) return '';
    if (p < 10) return 'Sem chuva à vista';
    if (p <= 25) return 'Chuva pouco provável';
    if (p <= 45) return 'Pode pingar';
    if (p <= 70) return 'Chuva provável';
    return 'Vai chover';
  }
  function palavrasOndas(h) {
    if (h == null) return '';
    if (h < 0.5) return 'Mar chão';
    if (h < 1) return 'Ondulação pequena';
    if (h < 1.5) return 'Alguma ondulação';
    if (h < 2.5) return 'Mar cavado';
    return 'Mar muito cavado';
  }

  /* Beaufort em português corrente, para quem não sabe o que são 24 km/h. */
  function beaufort(v) {
    if (v == null) return '';
    var t = [[1, 'sem vento'], [5, 'aragem'], [11, 'brisa leve'], [19, 'brisa fraca'],
             [28, 'brisa moderada'], [38, 'brisa forte'], [49, 'vento forte'],
             [61, 'vento muito forte'], [74, 'temporal'], [88, 'temporal forte']];
    for (var i = 0; i < t.length; i++) if (v < t[i][0]) return t[i][1];
    return 'tempestade';
  }

  /* ------------------------------------------------------------- ajudas */

  function media(a) {
    var v = a.filter(function (x) { return x != null; });
    return v.length ? v.reduce(function (s, x) { return s + x; }, 0) / v.length : null;
  }
  function soma(a) {
    var v = a.filter(function (x) { return x != null; });
    return v.length ? v.reduce(function (s, x) { return s + x; }, 0) : null;
  }
  function maximo(a) {
    var v = a.filter(function (x) { return x != null; });
    return v.length ? Math.max.apply(null, v) : null;
  }
  /* A direcção do vento é uma grandeza CIRCULAR: a média aritmética de 350° e
     10° dá 180° — sul, o oposto de norte. E a nortada vive exactamente em cima
     dessa descontinuidade. Medido com ERA5 (Jul+Ago, 2019-2025): a média
     aritmética perdia 15% das nortadas na Nazaré e 38% em Peniche. Média
     vectorial, que é o método da WMO. */
  function mediaDir(a) {
    var v = a.filter(function (x) { return x != null; });
    if (!v.length) return null;
    var sx = 0, cx = 0;
    v.forEach(function (d) { var r = d * Math.PI / 180; sx += Math.sin(r); cx += Math.cos(r); });
    if (Math.abs(sx) < 1e-9 && Math.abs(cx) < 1e-9) return null;  /* direcções a anular-se */
    return (Math.atan2(sx, cx) * 180 / Math.PI + 360) % 360;
  }

  /* Percentil por interpolação linear. Usado no vento: a média de nove horas
     achatava exactamente o pico da tarde, que é quando a nortada sopra e quando
     as pessoas estão na praia. Medido no Furadouro: média 11,2 km/h contra
     15,2 no pico — o site dizia menos vento do que qualquer outro sítio, e
     tinha razão em relação à média e nenhuma em relação ao que se sente. */
  function percentil(a, p) {
    var v = a.filter(function (x) { return x != null; }).sort(function (x, y) { return x - y; });
    if (!v.length) return null;
    if (v.length === 1) return v[0];
    var i = (v.length - 1) * p, b = Math.floor(i), r = i - b;
    return v[b + 1] != null ? v[b] + (v[b + 1] - v[b]) * r : v[b];
  }

  /* Índices das horas que caem numa janela, para um dia. */
  function janela(horas, dia, ini, fim) {
    ini = ini == null ? HORA_INI : ini;
    fim = fim == null ? HORA_FIM : fim;
    var ix = [];
    for (var i = 0; i < horas.length; i++) {
      if (horas[i].slice(0, 10) !== dia) continue;
      var h = +horas[i].slice(11, 13);
      if (h >= ini && h <= fim) ix.push(i);
    }
    return ix;
  }
  /* A nortada é um jacto costeiro que se levanta à tarde. Medido com ERA5
     (Jul+Ago, 2019-2025): em Espinho a média das 11h-15h é 23% inferior à das
     15h-19h, e em 63% dos dias a manhã está bem melhor do que a tarde. Dizer
     «de manhã 12, à tarde 26 — vá cedo» é a informação mais útil que este site
     pode dar a um português no Verão, e os dados já cá estavam. */
  var HORA_MEIO = 15;
  function fatia(arr, ix) {
    if (!arr) return [];
    return ix.map(function (i) { return arr[i]; });
  }

  /* Códigos de tempo do WMO que são trovoada. */
  function temTrovoada(codigos) {
    return codigos.some(function (c) { return c === 95 || c === 96 || c === 99; });
  }

  /* A nortada tem definição operacional: vento de 315°-45° com 7 m/s ou mais.
     Só se nomeia na costa oeste continental — no Algarve de sotavento ou nos
     Açores um vento de norte não é «a nortada». */
  function eNortada(dir, vel, lat, lon) {
    if (dir == null || vel == null) return false;
    if (vel < 25) return false;
    if (!(dir >= 315 || dir <= 45)) return false;
    return lon < -8.2 && lat > 37.2 && lon > -10.5;
  }

  /* ------------------------------------------------------ classificação */

  /**
   * @param {Object} d  dados do dia já agregados:
   *   {vento, rajada, dirVento, ceu, ar, agua, chuva, mm, ondas, uv, trovoada,
   *    lat, lon, mar}
   * @returns {Object} veredicto
   */
  function classificarDia(d) {
    var mar = d.mar !== false;

    var f = [
      { id: 'ceu',   nome: 'Sol',        peso: PESOS.ceu,   valor: d.ceu,   pontos: pontosCeu(d.ceu),     texto: palavrasCeu(d.ceu) },
      { id: 'vento', nome: 'Vento',      peso: PESOS.vento, valor: d.vento, pontos: pontosVento(d.vento), texto: palavrasVento(d.vento) },
      { id: 'ar',    nome: 'Calor',      peso: PESOS.ar,    valor: d.ar,    pontos: pontosAr(d.ar),       texto: palavrasAr(d.ar) },
      { id: 'chuva', nome: 'Chuva',      peso: PESOS.chuva, valor: d.chuva, pontos: pontosChuva(d.chuva), texto: palavrasChuva(d.chuva) }
    ];
    if (mar) {
      f.splice(3, 0, { id: 'agua', nome: 'Água do mar', peso: PESOS.agua,
                       valor: d.agua, pontos: pontosAgua(d.agua), texto: palavrasAgua(d.agua) });
    }

    /* Sem água (praia de rio, ou a API sem dados) os pontos dela repartem-se
       pelos outros na mesma proporção, para a escala continuar a ir a 100. */
    var usaveis = f.filter(function (x) { return x.pontos != null; });
    var pesoTotal = usaveis.reduce(function (s, x) { return s + x.peso; }, 0);
    var obtidos = usaveis.reduce(function (s, x) { return s + x.pontos; }, 0);
    var nota = pesoTotal ? Math.round(obtidos / pesoTotal * 100) : null;

    /* ------- vetos: sozinhos mandam o dia para vermelho ------- */
    /* Os vetos com `perigo: true` são questões de segurança, não de conforto, e
       a interface trata-os de outra maneira. Um aviso de trovoada dito no mesmo
       tom que «a água está fria» é um aviso que ninguém lê. */
    var vetos = [];
    if (d.chuva != null && d.chuva > 70) vetos.push({ t: 'chuva quase certa' });
    if (d.mm != null && d.mm >= 2) vetos.push({ t: 'chuva a sério' });
    if (d.vento != null && d.vento > 45) vetos.push({ t: 'vento demasiado forte', perigo: true });
    if (d.rajada != null && d.rajada > 65) vetos.push({ t: 'rajadas perigosas', perigo: true });
    if (d.ar != null && d.ar < 16) vetos.push({ t: 'frio a mais' });
    if (mar && d.ondas != null && d.ondas > 2.5) vetos.push({ t: 'mar muito cavado', perigo: true });

    /* ------- avisos de segurança: informam, não decidem -------
       A TROVOADA esteve aqui como veto até 6 de Agosto de 2026, e foi medida
       antes de sair. Em 720 dias-praia reais: 22 tinham trovoada marcada, em
       11 delas era o ÚNICO veto — e esses 11 seriam TODOS verdes sem ela, com
       nota média de 85, entre 21 % e 44 % de nuvens e 12 a 20 km/h de vento.
       Nenhum era amarelo ou vermelho.

       Ou seja: o veto não apanhava dias maus. Um dia com trovoada a sério já é
       chumbado pela chuva (>70 % de probabilidade, ou 2 mm acumulados) — foi o
       que aconteceu nos outros 11. O único efeito que tinha era transformar
       dias de 80 a 91 pontos num «Hoje não» sem nota.

       E a razão é o gatilho: `temTrovoada` usa `.some()` sobre a janela das
       11h às 19h, e o consenso entre modelos usa o MÁXIMO do código. São nove
       horas vezes quatro modelos — 36 oportunidades para um único 95 chumbar
       o dia inteiro.

       O aviso fica, e fica no tom de perigo. O que muda é quem decide: as
       cores dizem se vale a pena ir, não se é seguro estar. Está escrito na
       própria interface, ao lado do veredicto. */
    var avisos = [];
    if (d.trovoada) avisos.push({ t: 'pode haver trovoada', perigo: true });

    /* ------- factor limitante -------
       A soma ponderada tem um defeito conhecido, e é a crítica que a
       literatura faz aos índices aditivos como o TCI e o HCI: um factor
       catastrófico é mascarado pelos outros. Medido: 38 km/h de vento dava 60
       pontos porque o sol e a ausência de chuva compensavam. Numa praia,
       38 km/h manda toda a gente embora, faça o sol que fizer.

       A regra não se aplica à água: o mar gelado impede o banho, não impede o
       dia de praia. Aplica-se ao que determina se se consegue ESTAR na areia. */
    var LIMITANTES = { ceu: 1, vento: 1, ar: 1, chuva: 1 };
    var limitante = null, pior_racio = 1;
    usaveis.forEach(function (x) {
      if (!LIMITANTES[x.id]) return;
      var r = x.pontos / x.peso;
      if (r < pior_racio) { pior_racio = r; limitante = x; }
    });

    /* Um dia vetado não pode continuar a exibir a nota que teria sem o veto.
       A revisão apanhou «Nota 94 em 100» ao lado de «Hoje não», e a nota é o
       que as pessoas acreditam. Um veto zera a nota, porque é isso que ele
       significa: o resto deixou de contar. */
    var cor;
    if (vetos.length) cor = 'vermelho';
    else if (pior_racio < 0.08) cor = 'vermelho';
    else {
      cor = nota >= 70 ? 'verde' : (nota >= 45 ? 'amarelo' : 'vermelho');
      /* Um factor muito fraco não pode ser mascarado pelos outros: com tudo o
         resto bom, a soma chega a 70 e o dia aparecia como «Dia de praia». */
      if (cor === 'verde' && pior_racio < 0.40) cor = 'amarelo';
      /* O céu tem regra própria, e agora tem de ser dita: um dia mais tapado
         do que aberto (>60% de nuvens) não é dia de praia a sério. Isto vinha
         de graça do corte em 0,40 enquanto a escala do céu era uma escada com
         degrau nos 60% — com a curva contínua, 0,40 só apanha os 67% para
         cima, e os 61-66% passavam a verde. Medido em Carcavelos: 72% de
         nuvens com tudo o resto bom dava 71 pontos e «Dia de praia». */
      if (cor === 'verde' && d.ceu != null && d.ceu > 60) cor = 'amarelo';
    }

    /* ------- a frase: sai do factor que mais pontos perdeu ------- */
    var pior = null, piorPerda = -1;
    usaveis.forEach(function (x) {
      var perda = x.peso - x.pontos;
      if (perda > piorPerda) { piorPerda = perda; pior = x; }
    });
    var melhor = null, melhorRacio = -1;
    usaveis.forEach(function (x) {
      var r = x.pontos / x.peso;
      if (r > melhorRacio) { melhorRacio = r; melhor = x; }
    });

    var nortada = eNortada(d.dirVento, d.vento, d.lat, d.lon);
    var frase;
    if (vetos.length) {
      frase = (vetos[0].perigo ? 'Não vá: ' : 'Não vale a pena: ') + vetos[0].t + '.';
    } else if (cor === 'verde') {
      frase = piorPerda <= 4 ? 'Está tudo a favor.'
            : (piorPerda >= 8 && pior ? 'Bom dia de praia, ' + ressalva(pior) + '.'
                                      : 'Bom dia de praia.');
    } else if (cor === 'amarelo') {
      frase = 'Dá para ir, mas ' + queixa(limitante && pior_racio < 0.20 ? limitante : pior, nortada) + '.';
    } else {
      frase = 'Fica para outro dia: ' + queixa(pior_racio < 0.08 ? limitante : pior, nortada) + '.';
    }

    return {
      nota: vetos.length ? null : nota, notaBruta: nota,
      cor: cor, frase: frase, vetos: vetos.map(function (v) { return v.t; }),
      avisos: avisos.map(function (a) { return a.t; }),
      perigo: vetos.concat(avisos).some(function (v) { return v.perigo; }), factores: f,
      nortada: nortada, pior: pior ? pior.id : null, melhor: melhor ? melhor.id : null,
      limitante: (limitante && pior_racio < 0.20) ? limitante.id : null
    };
  }

  /* A ressalva de um dia bom. Escrita à mão factor a factor: um modelo
     genérico dava «só o sol é que não ajuda», que é o contrário do que se quer
     dizer — o problema é faltar sol, não o sol atrapalhar. */
  function ressalva(f) {
    switch (f.id) {
      case 'ceu':   return 'só podia haver mais sol';
      case 'vento': return 'só sopra algum vento';
      case 'ar':    return f.valor != null && f.valor < 24 ? 'só está um pouco fresco' : 'só aperta o calor';
      case 'agua':  return 'só a água é que está fria';
      case 'chuva': return 'só pode pingar a certa altura';
      default:      return 'com uma ou outra senão';
    }
  }

  function queixa(f, nortada) {
    if (!f) return 'as condições não ajudam';
    switch (f.id) {
      case 'vento': return nortada ? 'está nortada' : 'está muito vento';
      case 'ceu':   return f.valor != null && f.valor > 80 ? 'o céu está tapado' : 'há poucas abertas de sol';
      case 'ar':    return f.valor != null && f.valor < 22 ? 'está fresco' : 'está calor a mais';
      case 'agua':  return 'a água está fria';
      case 'chuva': return 'pode chover';
      default:      return 'as condições não ajudam';
    }
  }

  /* Junta as colunas dos vários modelos numa só série.
     A média só se aplica ao que é contínuo. A direcção do vento NÃO se pode
     mediar — a média de 350° e 10° dá 180°, o oposto do que se quer — por isso
     usa-se um modelo só. E o código de tempo é uma categoria, não um número:
     usa-se o máximo, que faz sobressair a trovoada (95/96/99) e erra do lado
     seguro num veto. */
  var CONTINUAS = ['temperature_2m', 'apparent_temperature', 'wind_speed_10m',
                   'wind_gusts_10m', 'cloud_cover', 'precipitation', 'precipitation_probability',
                   'uv_index'];

  function consenso(resposta, modelos) {
    var h = resposta.hourly, n = (h.time || []).length, saida = { time: h.time };

    /* Correspondência EXACTA pelo sufixo do modelo, nunca por prefixo.
       `precipitation_probability_icon_seamless` começa por `precipitation_`, e
       com a correspondência por prefixo a chuva em milímetros era mediada
       junto com a probabilidade em percentagem: 18% entrava na conta como
       18 mm e o dia levava um veto de «chuva a sério» com os quatro modelos a
       dar 0,00 mm. Foi um utilizador que apanhou isto, ao reparar que o site
       dizia chuva e céu limpo ao mesmo tempo. */
    function colunas(base) {
      var c = [];
      if (h[base]) c.push(base);
      modelos.forEach(function (m) { if (h[base + '_' + m]) c.push(base + '_' + m); });
      return c;
    }
    CONTINUAS.forEach(function (base) {
      var cols = colunas(base);
      if (!cols.length) return;
      var out = new Array(n);
      for (var i = 0; i < n; i++) {
        var soma = 0, cont = 0;
        for (var j = 0; j < cols.length; j++) {
          var v = h[cols[j]][i];
          if (v != null) { soma += v; cont++; }
        }
        out[i] = cont ? soma / cont : null;
      }
      saida[base] = out;
    });
    var dir = colunas('wind_direction_10m');
    saida.wind_direction_10m = dir.length ? h[dir[0]] : null;
    var cod = colunas('weather_code');
    if (cod.length) {
      var oc = new Array(n);
      for (var i2 = 0; i2 < n; i2++) {
        var m = null;
        for (var j2 = 0; j2 < cod.length; j2++) {
          var v2 = h[cod[j2]][i2];
          if (v2 != null && (m == null || v2 > m)) m = v2;
        }
        oc[i2] = m;
      }
      saida.weather_code = oc;
    }
    /* o diário vem por modelo; a chuva acumulada pela média, o código pelo pior */
    var dl = resposta.daily || {}, nd = (dl.time || []).length, sd = { time: dl.time };
    function colsD(base) {
      var c = [];
      if (dl[base]) c.push(base);
      modelos.forEach(function (m) { if (dl[base + '_' + m]) c.push(base + '_' + m); });
      return c;
    }
    var cp = colsD('precipitation_sum');
    sd.precipitation_sum = new Array(nd);
    for (var i3 = 0; i3 < nd; i3++) {
      var s3 = 0, c3 = 0;
      cp.forEach(function (k) { var v = dl[k][i3]; if (v != null) { s3 += v; c3++; } });
      sd.precipitation_sum[i3] = c3 ? s3 / c3 : null;
    }
    var cw = colsD('weather_code');
    sd.weather_code = new Array(nd);
    for (var i4 = 0; i4 < nd; i4++) {
      var m4 = null;
      cw.forEach(function (k) { var v = dl[k][i4]; if (v != null && (m4 == null || v > m4)) m4 = v; });
      sd.weather_code[i4] = m4;
    }
    return { hourly: saida, daily: sd };
  }

  /* ------------------------------------------------- agregação dos dados */

  /**
   * Junta a resposta das duas APIs num objecto por dia, já agregado à janela
   * de praia. Devolve um array de dias.
   */
  function agregar(tempo, marinho, praia) {
    var horas = (tempo.hourly && tempo.hourly.time) || [];
    var dias = (tempo.daily && tempo.daily.time) || [];
    var mh = (marinho && marinho.hourly) || null;
    var mHoras = (mh && mh.time) || [];

    return dias.map(function (dia, iDia) {
      var ix = janela(horas, dia);
      var ixManha = janela(horas, dia, HORA_INI, HORA_MEIO - 1);
      var ixTarde = janela(horas, dia, HORA_MEIO, HORA_FIM);
      var ixm = mHoras.length ? janela(mHoras, dia) : [];

      var ventosJanela = fatia(tempo.hourly.wind_speed_10m, ix);
      /* p75 e não média: é o vento da parte ventosa da tarde, sem ser refém de
         uma hora isolada como seria o máximo. */
      var vento = percentil(ventosJanela, 0.75);
      var ventoManha = media(fatia(tempo.hourly.wind_speed_10m, ixManha));
      var ventoTarde = media(fatia(tempo.hourly.wind_speed_10m, ixTarde));
      var agua = ixm.length ? media(fatia(mh.sea_surface_temperature, ixm)) : null;
      var ondas = ixm.length ? maximo(fatia(mh.wave_height, ixm)) : null;

      return {
        dia: dia,
        vento: vento == null ? null : Math.round(vento),
        ventoMin: percentil(ventosJanela, 0.10) != null ? Math.round(percentil(ventosJanela, 0.10)) : null,
        ventoMax: maximo(ventosJanela) != null ? Math.round(maximo(ventosJanela)) : null,
        ventoManha: ventoManha == null ? null : Math.round(ventoManha),
        ventoTarde: ventoTarde == null ? null : Math.round(ventoTarde),
        rajada: maximo(fatia(tempo.hourly.wind_gusts_10m, ix)),
        dirVento: mediaDir(fatia(tempo.hourly.wind_direction_10m, ix)),
        ceu: media(fatia(tempo.hourly.cloud_cover, ix)),
        ar: maximo(fatia(tempo.hourly.apparent_temperature, ix)),
        arReal: maximo(fatia(tempo.hourly.temperature_2m, ix)),
        agua: agua,
        chuva: maximo(fatia(tempo.hourly.precipitation_probability, ix)),
        /* Acumulado DENTRO da janela de praia, não do dia inteiro. Medido pela
           revisão: 79% dos vetos de chuva vinham de chuva que caía de
           madrugada ou à noite, e chumbavam tardes de sol. */
        mm: soma(fatia(tempo.hourly.precipitation || [], ix)),
        mmDia: (tempo.daily.precipitation_sum || [])[iDia],
        ondas: ondas,
        uv: maximo(fatia(tempo.hourly.uv_index, ix)),
        trovoada: temTrovoada(fatia(tempo.hourly.weather_code, ix).filter(function (x) { return x != null; })),
        codigo: (tempo.daily.weather_code || [])[iDia],
        lat: praia.la, lon: praia.lo, mar: praia.m === 1
      };
    });
  }

  raiz.Modelo = {
    classificarDia: classificarDia,
    agregar: agregar,
    beaufort: beaufort,
    percentil: percentil,
    consenso: consenso,
    _mediaDir: mediaDir,
    palavrasOndas: palavrasOndas,
    PESOS: PESOS,
    HORA_INI: HORA_INI,
    HORA_FIM: HORA_FIM,
    /* expostos para os testes */
    _pontos: { vento: pontosVento, ceu: pontosCeu, ar: pontosAr, agua: pontosAgua, chuva: pontosChuva }
  };
})(typeof window !== 'undefined' ? window : globalThis);
