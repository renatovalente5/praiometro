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

  /* A janela de praia deixou de ser um intervalo contínuo: são DOIS blocos, com
     um buraco no meio. Ver PARTES, mais abaixo. Estas duas constantes são as
     pontas dessa janela — servem para a publicar («das 9h às 19h») e como
     valores por omissão da `janela()`, e não para agregar seja o que for. */
  var HORA_INI = 9;
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

  /* O FUNDO DESTA CURVA ERA UM ACIDENTE, e esteve plano dos 90 aos 100 % desde
     o primeiro dia do projecto: 0 % de sol dava exactamente os mesmos pontos
     que 10 %, e o modelo não distinguia um véu de um cobertor. Veio daqui: no
     commit d0bbc38 o peso do céu desceu de 28 para 26 — para dar mais peso ao
     vento — e todas as âncoras foram reescaladas MENOS o fundo, que ficou nos 4
     em vez de descer para 3,7. O rácio do dia tapado até SUBIU nessa altura.

     Duas das três fontes de praia levam o sol a ZERO: o BCI (Morgan et al.
     2000, 1354 banhistas inquiridos) diz «falling in linear fashion to zero for
     absence of sunshine», e o TCI (Mieczkowski 1985) dá 0 acima de 91,7 % de
     nuvens. A terceira, o HCI:Beach (Rutty et al. 2020), nunca chega a zero —
     dá 2 em 10 ao céu totalmente tapado.

     O 2,5 NÃO é uma medição, é um limite de arquitectura, e diz-se: abaixo de
     2,08 (= 0,08 × 26) o céu passaria a pintar dias de vermelho SOZINHO pela
     regra do factor limitante, e nenhuma fonte sustenta isso — uma manhã em
     cada cinco em Agosto no noroeste é de céu tapado (Furadouro 19 %, Moledo
     25 %, medido em 11 Agostos de ERA5). O teste em testar-modelo.js guarda
     essa fronteira.

     Efeito, medido em 19 705 partes-dia de época balnear (Jun-Set 2015-2025,
     8 praias, sem chuva): NADA muda abaixo dos 90 % de nuvens (0 em 17 383).
     Com 100 % de nuvens a mediana desce de 57 para 55. Mudam de cor 36 em
     19 705 — 0,18 % —, todas de amarelo para vermelho e todas já a 45-46, um
     ponto acima do corte.

     O que isto NÃO resolve, e é preciso ficar escrito: a queixa que o originou
     era uma manhã de 72 no Furadouro, e essa passa a 71. A aritmética é
     fechada — 4 pontos de céu mais 68 de vento, calor, água e ausência de
     chuva. O peso do céu (26) não se mexeu porque o BCI mede 27 % com pessoas
     a sério, e o HCI:Beach dá a esse mesmo dia exactamente 72. */
  var CURVA_CEU = [[0, 26], [20, 26], [30, 23], [50, 17], [70, 9], [90, 4], [100, 2.5]];
  function pontosCeu(n) {
    if (n == null) return null;
    return interpolar(CURVA_CEU, n);
  }

  /* Temperatura APARENTE, não a do termómetro: é a que inclui o vento, a
     humidade E a radiação solar. Curva com dois lados: 25-34 °C é o planalto,
     e cai para os dois extremos — 16 °C tem veto próprio («frio a mais»), e
     acima de 40,5 °C também não é dia de areia.

     O LADO QUENTE FOI RECALIBRADO em Agosto de 2026, e a razão é um defeito
     reportado: a Praia da Rocha com 34 °C no termómetro (36,3 aparentes), sol
     aberto, sem vento e sem chuva, saía «assim-assim» — o calor dava 6 pontos
     em 18 e disparava a regra que despromove verde a amarelo. O joelho estava
     nos 31 °C aparentes, ou seja ABAIXO da mediana das tardes de Agosto no
     Algarve, o que é indefensável para um site de praias portuguesas.

     Onde ficam agora os cortes, medidos por varrimento da curva:
       18/18 até .......... 34,0 aparentes (~32 no termómetro)
       40 % (despromove) .. 37,4
       20 % (escreve a frase) 38,8
       8 % (vermelho) ..... 39,8

     A ÂNCORA dos 37,4: é o único ponto de desistência MEDIDO que existe para o
     Mediterrâneo — 867 inquéritos em 18 praias da Catalunha (Sardá et al.,
     2023): 35,6 °C reais (dp 4,2) é a temperatura a que deixariam de ir à
     praia. E 34 °C aparentes é o topo do intervalo ideal declarado em quatro
     amostras europeias independentes. Abaixo disso não há uma única fonte que
     diga que se perde qualidade de dia de praia.

     O declive máximo mantém-se em 3,33 pontos por °C, igual ao de antes: meio
     grau de diferença entre duas corridas de previsão não pode virar a cor do
     dia.

     DÍVIDA POR PAGAR, e é MENOR do que aqui esteve escrito até 13 de Agosto de
     2026: a `apparent_temperature` da Open-Meteo inclui a RADIAÇÃO SOLAR, mas
     medido em 90 072 horas de praia (8 praias, Jun-Set de 2015 a 2025) o termo
     da radiação vale 0,1 a 0,5 °C entre céu limpo e céu tapado — 1,7 pontos em
     18 no declive mais íngreme, e ZERO no planalto. O que é grande é a aparente
     descer 5,1 °C com o céu tapado, e a maior parte disso é o termómetro a
     estar mais baixo por não ter havido sol: isso é física e não é dupla
     contagem, e não desaparece quando a dívida for paga. Esta secção dizia que
     era a dupla contagem que produzia o caso reportado; não era.
     Alargar o planalto COMPENSA a parte pequena deslocando o joelho. No dia em
     que alguém trocar a variável por uma sem radiação (ou o `maximo` da janela
     pelo percentil 75, que é a outra dívida), esta curva fica errada e tem de
     ser remedida. Está escrito aqui para que ninguém faça as duas coisas ao
     mesmo tempo e depois não saiba qual delas produziu o quê. */
  var CURVA_AR = [[15.5, 0], [17.5, 3], [20.5, 7], [23.5, 13], [25, 18],
                  [34, 18], [35.5, 13], [37.5, 7], [39, 3], [40.5, 0]];
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
     tinha razão em relação à média e nenhuma em relação ao que se sente.

     CUIDADO com a intuição sobre amostras pequenas, porque já houve quem a
     tivesse ao contrário e construísse uma correcção em cima do erro: com 4
     valores o p75 fica a um QUARTO do caminho do 3.º para o 4.º —
     percentil([10,12,14,20], 0.75) = 15,5, e não «quase o máximo». Com 5
     valores dá exactamente o 4.º: percentil([10,12,14,20,22], 0.75) = 20.
     Ou seja, das duas metades do dia é a TARDE (5 horas) que é medida com o
     estimador mais alto, e não a manhã (4 horas). */
  function percentil(a, p) {
    var v = a.filter(function (x) { return x != null; }).sort(function (x, y) { return x - y; });
    if (!v.length) return null;
    if (v.length === 1) return v[0];
    var i = (v.length - 1) * p, b = Math.floor(i), r = i - b;
    return v[b + 1] != null ? v[b] + (v[b + 1] - v[b]) * r : v[b];
  }

  /* Índices das horas que caem numa lista de blocos, para um dia. A união, e
     por ordem: é isto que permite ao dia ser dois pedaços com um buraco no
     meio em vez de um intervalo corrido. */
  function indices(horas, dia, blocos) {
    var ix = [];
    for (var b = 0; b < blocos.length; b++) {
      var j = janela(horas, dia, blocos[b][0], blocos[b][1]);
      for (var k = 0; k < j.length; k++) ix.push(j[k]);
    }
    return ix.sort(function (x, y) { return x - y; });
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

  /* -------------------------------------------- as duas partes do dia -----
     Manhã das 9h às 13h, tarde das 15h às 19h. Cinco horas cada — e blocos do
     mesmo tamanho importam mais do que parece: o percentil 75 do vento é o
     mesmo estimador nos dois, coisa que uma divisão em 4 e 5 horas nunca teve.

     AS 13h-15h FICAM DE FORA, e é de propósito: é a hora de almoço e do sol a
     pique, e quem vai à praia não está lá. O dia é a UNIÃO dos dois blocos e
     não o intervalo 9h-19h — não há uma única conta neste ficheiro que olhe
     para as 14h.

     Houve uma versão com três partes (Manhã / Meio-dia / Tarde, blocos de três
     horas dentro de 11h-19h). Foi tirada a pedido: duas partes são o número em
     que uma comparação se faz sem contar, e «de manhã sim, de tarde não» é uma
     frase que toda a gente já disse. */
  var PARTES = [
    { id: 'manha', nome: 'Manhã', ini: 9,  fim: 13 },
    { id: 'tarde', nome: 'Tarde', ini: 15, fim: 19 }
  ];
  var BLOCOS_DIA = PARTES.map(function (p) { return [p.ini, p.fim]; });

  function fatia(arr, ix) {
    if (!arr) return [];
    return ix.map(function (i) { return arr[i]; });
  }

  /* Códigos de tempo do WMO que são trovoada. */
  var CODIGOS_TROVOADA = [95, 96, 99];

  /* Exige que pelo menos DOIS modelos vejam trovoada na mesma hora.
     Medido a 8 de Agosto de 2026, em 21 dias-praia com aviso de trovoada:
       1 modelo em 4 concorda ..... 19  (90 %)
       2 modelos ..................  1
       3 modelos ..................  1
       4 modelos ..................  0
     Ou seja, nove em cada dez avisos vinham de um modelo isolado a contrariar
     os outros três. Em Caminha, nesse dia: o UKMO via trovoada às 18h, e às
     mesmas 18h o ECMWF dizia chuvisco, o ICON dizia nuvens e o GFS dizia céu
     limpo. O site avisava; mais nenhum sítio avisava, e com razão.

     Com um único modelo disponível, um chega — senão a regra desligava-se
     sozinha em vez de ficar mais exigente. */
  function temTrovoada(contagens, quantosModelos) {
    var precisa = Math.min(2, quantosModelos || 1);
    return contagens.some(function (q) { return (q || 0) >= precisa; });
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
  /**
   * @param d   agregado de uma janela de horas
   * @param op  {nota: N} — se vier, N substitui a nota calculada. É assim que o
   *            dia passa a valer a MÉDIA das suas duas partes.
   *
   * PORQUÊ UM OBJECTO e não um número solto: com um número, um inocente
   * `dias.map(classificarDia)` passava o ÍNDICE como segundo argumento e o dia
   * 0 saía com nota 0 — em silêncio, com cor e frase de dia péssimo. Aconteceu,
   * e foi apanhado pelo testar-praias. Um objecto torna o acidente impossível:
   * o índice é um número e não tem `.nota`.
   *
   * PORQUÊ a nota do dia deixou de ser a sua própria soma: as nove horas são
   * medidas com MÁXIMOS (calor, probabilidade de chuva, ondulação) e SOMAS
   * (milímetros), e nove horas acumulam sempre mais do que três. O resultado
   * era um dia sistematicamente mais severo do que as suas partes — medido em
   * 1200 dias-praia, a média das três partes fica 2 pontos acima da nota que o
   * dia dava a si próprio (mediana; até +12 no pior caso). Com as três notas no
   * ecrã ao lado da do dia, isso lia-se como conta mal feita, porque era.
   *
   * O que NÃO mudou: os vetos, o factor limitante, a nortada e a frase saem
   * todos do agregado das nove horas, como sempre saíram. Um veto continua a
   * zerar a nota. A segurança não foi recalibrada — só a aritmética do número.
   */
  function classificarDia(d, op) {
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
    var notaPropria = nota;
    if (op && op.nota != null) nota = op.nota;

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
    /* A RAZÃO, sem o prefixo. A frase inteira («Dá para ir, mas está muito
       vento.») serve quando é o dia a falar; quando é uma PARTE do dia, o
       prefixo mente — «dá para ir» por cima de uma tarde vermelha. Expor a
       razão em separado evita um segundo gerador de frases a dizer o mesmo
       de outra maneira, que foi como se chegou a ter quatro na mesma caixa. */
    var razao, frase;
    if (vetos.length) {
      razao = vetos[0].t;
      frase = (vetos[0].perigo ? 'Não vá: ' : 'Não vale a pena: ') + razao + '.';
    } else if (cor === 'verde') {
      razao = pior ? ressalva(pior) : '';
      frase = piorPerda <= 4 ? 'Está tudo a favor.'
            : (piorPerda >= 8 && pior ? 'Bom dia de praia, ' + razao + '.'
                                      : 'Bom dia de praia.');
      if (piorPerda <= 4) razao = 'está tudo a favor';
    } else if (cor === 'amarelo') {
      razao = queixa(limitante && pior_racio < 0.20 ? limitante : pior, nortada);
      frase = 'Dá para ir, mas ' + razao + '.';
    } else {
      razao = queixa(pior_racio < 0.08 ? limitante : pior, nortada);
      frase = 'Fica para outro dia: ' + razao + '.';
    }

    return {
      nota: vetos.length ? null : nota, notaBruta: nota, razao: razao,
      /* A nota que esta janela daria a si própria, sem a média das partes.
         É a que as PARTES usam para se somarem, e a que o teste da média
         compara — sem ela, impor a média e depois medi-la era circular. */
      notaPropria: notaPropria,
      cor: cor, frase: frase, vetos: vetos.map(function (v) { return v.t; }),
      avisos: avisos.map(function (a) { return a.t; }),
      perigo: vetos.concat(avisos).some(function (v) { return v.perigo; }),
      /* OS PERIGOS, à parte e por nome. O `vetos` acima é um `map` que deita
         fora a bandeira `perigo`, e a interface, sem ela, não tinha como saber
         QUAL dos vetos é uma questão de segurança — lia o primeiro da lista.
         Como a chuva é empilhada antes do mar, um dia com chuva a sério E mar
         a 3,2 m escrevia, na caixa vermelha, «Aviso de segurança: chuva quase
         certa», e escondia o mar. A única coisa no ecrã que pode impedir
         alguém de se magoar estava a nomear a coisa errada. */
      perigos: vetos.concat(avisos)
        .filter(function (v) { return v.perigo; })
        .map(function (v) { return v.t; }),
      factores: f,
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
      /* Sem o «só», ao contrário das outras: é a única ressalva com um verbo
         de acção, e «só sopra algum vento» lê-se como se o vento fosse a
         única coisa que o dia faz. «Bom dia de praia, sopra algum vento.» */
      case 'vento': return 'sopra algum vento';
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
      var oc = new Array(n), ot = new Array(n);
      for (var i2 = 0; i2 < n; i2++) {
        var m = null, quantos = 0;
        for (var j2 = 0; j2 < cod.length; j2++) {
          var v2 = h[cod[j2]][i2];
          if (v2 == null) continue;
          if (m == null || v2 > m) m = v2;
          if (CODIGOS_TROVOADA.indexOf(v2) >= 0) quantos++;
        }
        oc[i2] = m;
        ot[i2] = quantos;
      }
      saida.weather_code = oc;
      /* Quantos modelos vêem trovoada NESTA hora. O weather_code é colapsado
         para o máximo — «erra do lado da segurança» — e isso apaga a
         informação de que só um dos quatro é que a viu. Sem esta coluna, o
         `temTrovoada` não tem como saber a diferença entre um modelo isolado
         e os quatro de acordo. */
      saida.trovoada_modelos = ot;
      saida.n_modelos = cod.length;
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
    /* A matéria-prima, guardada para quem precise de saber o DESACORDO entre
       modelos e não só a média deles. O consenso é uma média, e uma média não
       diz se os quatro concordavam ou se dois puxavam para cada lado — que é
       exactamente a diferença entre um sinal e ruído. Usa-o o `metadesDoDia`.
       São duas referências, não duas cópias: os arrays já estão vivos na
       resposta em sessionStorage, e nada aqui itera as chaves de `hourly` (os
       acessos são todos por nome), portanto não há risco de estes dois campos
       entrarem numa média. */
    saida._bruto = h;
    saida._modelos = modelos.slice();
    return { hourly: saida, daily: sd };
  }

  /* ------------------------------------------------- agregação dos dados */

  /**
   * Agrega um dia a um intervalo de horas QUALQUER — não obrigatoriamente a
   * janela de praia inteira. É o corpo que a `agregar()` usava lá dentro,
   * posto de fora para que as metades do dia possam ser pontuadas exactamente
   * pelas mesmas contas: as mesmas estatísticas (p75 do vento, máximo do
   * calor, soma dos milímetros), as mesmas curvas, os mesmos pesos. Metades
   * medidas de outra maneira não seriam comparáveis com o dia nem uma com a
   * outra.
   *
   * Devolve `null` se não houver uma única hora no intervalo. Isso é
   * deliberado e é a guarda mais importante do ficheiro: o `classificarDia({})`
   * devolve cor VERMELHA, nota nula, zero vetos e «Fica para outro dia: as
   * condições não ajudam» — ou seja, ausência de dados sai daqui com todo o ar
   * de um veredicto. Quem chamar isto tem de distinguir «não sei» de «é mau».
   *
   * Não devolve `mmDia` nem `codigo`: esses vêm do bloco diário da API, são do
   * dia inteiro e não fazem sentido pedidos a um intervalo.
   */
  function agregarBlocos(tempo, marinho, praia, dia, blocos) {
    var horas = (tempo.hourly && tempo.hourly.time) || [];
    var ix = indices(horas, dia, blocos);
    if (!ix.length) return null;

    var mh = (marinho && marinho.hourly) || null;
    var mHoras = (mh && mh.time) || [];
    var ixm = mHoras.length ? indices(mHoras, dia, blocos) : [];

    var ventosJanela = fatia(tempo.hourly.wind_speed_10m, ix);
    /* p75 e não média: é o vento da parte ventosa da tarde, sem ser refém de
       uma hora isolada como seria o máximo. */
    var vento = percentil(ventosJanela, 0.75);
    var agua = ixm.length ? media(fatia(mh.sea_surface_temperature, ixm)) : null;
    var ondas = ixm.length ? maximo(fatia(mh.wave_height, ixm)) : null;
    var mares = extremosMare(mh, dia);

    return {
      dia: dia,
      vento: vento == null ? null : Math.round(vento),
      ventoMin: percentil(ventosJanela, 0.10) != null ? Math.round(percentil(ventosJanela, 0.10)) : null,
      ventoMax: maximo(ventosJanela) != null ? Math.round(maximo(ventosJanela)) : null,
      rajada: maximo(fatia(tempo.hourly.wind_gusts_10m, ix)),
      dirVento: mediaDir(fatia(tempo.hourly.wind_direction_10m, ix)),
      ceu: media(fatia(tempo.hourly.cloud_cover, ix)),
      ar: maximo(fatia(tempo.hourly.apparent_temperature, ix)),
      arReal: maximo(fatia(tempo.hourly.temperature_2m, ix)),
      agua: agua,
      chuva: maximo(fatia(tempo.hourly.precipitation_probability, ix)),
      /* Acumulado DENTRO da janela, não do dia inteiro. Medido pela revisão:
         79% dos vetos de chuva vinham de chuva que caía de madrugada ou à
         noite, e chumbavam tardes de sol. */
      mm: soma(fatia(tempo.hourly.precipitation || [], ix)),
      ondas: ondas,
      mares: mares,
      uv: maximo(fatia(tempo.hourly.uv_index, ix)),
      trovoada: temTrovoada(
        fatia(tempo.hourly.trovoada_modelos || [], ix).filter(function (x) { return x != null; }),
        tempo.hourly.n_modelos),
      lat: praia.la, lon: praia.lo, mar: praia.m === 1
    };
  }

  /* Um bloco só, que é o caso comum: as partes do dia e os testes. Mantém a
     assinatura de sempre. */
  function agregarJanela(tempo, marinho, praia, dia, ini, fim) {
    return agregarBlocos(tempo, marinho, praia, dia, [[ini, fim]]);
  }

  /* O que a `agregar()` devolvia para um dia sem uma única hora na janela.
     Tem de continuar a ser um OBJECTO e não `null`: o array que sai da
     `agregar()` é indexado pelo dia escolhido e o app.js lê `d.uv` sem
     perguntar. Um `null` no meio deixava a página com o HTML e mais nada. */
  function janelaVazia(dia, praia) {
    return {
      dia: dia, vento: null, ventoMin: null, ventoMax: null, rajada: null,
      dirVento: null, ceu: null, ar: null, arReal: null, agua: null,
      chuva: null, mm: null, ondas: null, mares: null, uv: null, trovoada: false,
      lat: praia.la, lon: praia.lo, mar: praia.m === 1
    };
  }

  /* ------------------------------------------------------------- a maré */
  /* AS HORAS da preia-mar e da baixa-mar, e mais nada. Duas decisões, ambas
     medidas, e as duas contra marégrafos verdadeiros do IOC Sea Level
     Monitoring (Vigo, Marín, Cascais e Huelva):

     1. NÃO SE MOSTRAM METROS. O zero desta fonte é o GEÓIDE, não o nível médio
        — a média anual em Cascais é −0,369 m — e o Zero Hidrográfico das
        tabelas portuguesas está ~2,6 m abaixo dele. O Instituto Hidrográfico
        só publica esse afastamento para uns 16 portos e este site tem 995
        praias: escrever «1,74 m» no Furadouro seria dar precisão de tabela
        náutica a um número tirado de uma constante média. O problema do datum
        não se resolve com 995 praias — evita-se.
        E a AMPLITUDE também não se mostra, por outra razão: medida em 80
        praias, ela é 99,6 % explicada pelo DIA e 0,3 % pela PRAIA. Moledo e
        Monte Gordo, a 520 km, dão r = 0,9955. Seria uma linha a escrever o
        mesmo número nas 995. A HORA não: a mesma preia-mar espalha-se 39
        minutos de norte a sul, contra os ~50 min/dia a que a maré se atrasa.

     2. +30 MINUTOS, e não é um acerto a olho. Esta fonte é a média horária do
        Copernicus (maré do atlas FES2014) carimbada no INÍCIO do intervalo, e
        vem sistematicamente adiantada. Contra o marégrafo de Cascais, o erro
        quadrático médio cai de 0,187 m para 0,027 m ao deslocar +30 min; as
        quatro estações, de 42,4 N a 37,1 N, dão 29,5 a 32,9 minutos.

     E o pico lê-se por PARÁBOLA sobre três horas, não pela hora mais próxima:
     medido contra o marégrafo ao minuto, o erro na hora cai de 16,1 min de
     média (47 no pior caso) para 6,9 (29,7). Na altura seria indiferente — 1,8
     contra 0,9 cm — mas a altura não se mostra. */
  var MARE_ATRASO_MIN = 30;

  function extremosMare(mh, dia) {
    var t = mh && mh.time, v = mh && mh.sea_level_height_msl;
    if (!t || !v) return null;
    var out = [];
    for (var i = 1; i < v.length - 1; i++) {
      if (v[i] == null || v[i - 1] == null || v[i + 1] == null) continue;
      var alto = v[i] >= v[i - 1] && v[i] >= v[i + 1];
      var baixo = v[i] <= v[i - 1] && v[i] <= v[i + 1];
      if (!alto && !baixo) continue;
      /* Parábola pelos três pontos: o pico verdadeiro cai ENTRE horas. */
      var d2 = v[i - 1] - 2 * v[i] + v[i + 1];
      var desl = d2 ? 0.5 * (v[i - 1] - v[i + 1]) / d2 : 0;
      if (!(desl > -1 && desl < 1)) desl = 0;      /* três pontos iguais, ou pior */
      var ms = new Date(t[i]).getTime() + (desl * 60 + MARE_ATRASO_MIN) * 60000;
      var q = new Date(ms);
      var iso = q.getFullYear() + '-' + ('0' + (q.getMonth() + 1)).slice(-2)
              + '-' + ('0' + q.getDate()).slice(-2);
      if (iso !== dia) continue;                   /* o deslocamento pode mudar o dia */
      /* UM PATAMAR conta uma vez, não duas. Com `>=` nos dois lados, duas
         horas com o mesmo valor satisfazem ambas a condição e a maré saía
         «baixa-mar 05h00 · baixa-mar 05h00». Extremos consecutivos verdadeiros
         distam 5,9 a 6,6 h (mediana 6,2), portanto dois do MESMO tipo a menos
         de três horas são o mesmo — e fica o do meio do patamar. */
      var ant = out[out.length - 1];
      if (ant && ant.tipo === (alto ? 'preia' : 'baixa')
          && Math.abs((q.getHours() * 60 + q.getMinutes()) - (ant.h * 60 + ant.min)) < 180) {
        var meio = ((ant.h * 60 + ant.min) + (q.getHours() * 60 + q.getMinutes())) / 2;
        ant.h = Math.floor(meio / 60) % 24;
        ant.min = Math.round(meio % 60);
        continue;
      }
      out.push({ tipo: alto ? 'preia' : 'baixa',
                 h: q.getHours(), min: q.getMinutes() });
    }
    return out.length ? out : null;
  }

  /**
   * Junta a resposta das duas APIs num objecto por dia, já agregado à janela
   * de praia. Devolve um array de dias.
   */
  function agregar(tempo, marinho, praia) {
    var dias = (tempo.daily && tempo.daily.time) || [];
    return dias.map(function (dia, iDia) {
      var d = agregarBlocos(tempo, marinho, praia, dia, BLOCOS_DIA)
        || janelaVazia(dia, praia);
      d.mmDia = (tempo.daily.precipitation_sum || [])[iDia];
      d.codigo = (tempo.daily.weather_code || [])[iDia];
      return d;
    });
  }

  /* ------------------------------------------- as duas metades do dia */

  /* Aqui viveu, até Agosto de 2026, um detector que dizia «Vai de manhã — o
     céu deve fechar à tarde» em cerca de 5 % dos dias, com quatro portões em
     conjunção e uma calibração de 2400 dias-praia contra o ERA5.

     Saiu porque o ecrã passou a mostrar as duas partes SEMPRE, com a nota de
     cada uma. Um detector existe para revelar o que está escondido; quando as
     duas notas estão à vista em corpo grande, o ecrã É o detector, e a frase
     passava a dizer por palavras o que dois números já diziam.

     A medição não se perdeu: está em `_source/medir-portao.js` e no MODELO.md,
     e o dia em que se voltar a precisar de afirmar qual das partes é a melhor,
     recomeça-se dali e não do zero. */

  /**
   * O dia inteiro E as suas três partes, de uma vez. É o que a interface pede
   * ao modelo: um objecto por dia com tudo o que vai para o ecrã.
   *
   *   { d, v, partes: [{ id, nome, d, v }, …] }
   *
   * A nota de `v` é a MÉDIA das três partes. Os vetos, a cor, o factor
   * limitante e a frase continuam a sair das nove horas.
   *
   * Se faltar uma parte — buraco nos dados horários — a média não se faz com
   * as que sobram: o dia volta a valer a sua própria soma. Uma média de duas
   * partes chamada «o dia» seria pior do que um número honesto.
   */
  function avaliarDia(tempo, marinho, praia, dia) {
    var d = agregarBlocos(tempo, marinho, praia, dia, BLOCOS_DIA);
    var partes = PARTES.map(function (P) {
      var g = agregarJanela(tempo, marinho, praia, dia, P.ini, P.fim);
      /* A água e a ondulação são do DIA, e são copiadas para cada parte antes
         de a pontuar. Sem isto a `agregarJanela` recalcula-as dentro de cada
         bloco — a água pela média das horas marinhas, as ondas pelo máximo — e
         as três partes passavam a pontuar contra três águas diferentes por
         décimas. O ecrã diz «igual nas três partes», e tem de ser verdade:
         mostrar um número que a conta não usou é a mesma classe de defeito que
         esta alteração toda veio corrigir. */
      if (g && d) { g.agua = d.agua; g.ondas = d.ondas; }
      return { id: P.id, nome: P.nome, ini: P.ini, fim: P.fim,
               d: g, v: g ? classificarDia(g) : null };
    });
    if (!d) return { d: null, v: null, partes: partes, media: null };

    var notas = partes.map(function (p) { return p.v && p.v.notaPropria; })
                      .filter(function (n) { return n != null; });
    var media = notas.length === PARTES.length
      ? notas.reduce(function (s, n) { return s + n; }, 0) / notas.length
      : null;
    return { d: d, v: classificarDia(d, media == null ? null : { nota: Math.round(media) }),
             partes: partes,
             /* por arredondar: é com ela que o painel escreve «75,7 → 76» */
             media: media };
  }

  raiz.Modelo = {
    classificarDia: classificarDia,
    avaliarDia: avaliarDia,
    PARTES: PARTES,
    agregar: agregar,
    agregarJanela: agregarJanela,
    agregarBlocos: agregarBlocos,
    BLOCOS_DIA: BLOCOS_DIA,
    beaufort: beaufort,
    percentil: percentil,
    consenso: consenso,
    _mediaDir: mediaDir,
    palavrasOndas: palavrasOndas,
    PESOS: PESOS,
    HORA_INI: HORA_INI,
    HORA_FIM: HORA_FIM,
    /* expostos para os testes */
    _extremosMare: extremosMare,
    _pontos: { vento: pontosVento, ceu: pontosCeu, ar: pontosAr, agua: pontosAgua, chuva: pontosChuva }
  };
})(typeof window !== 'undefined' ? window : globalThis);
