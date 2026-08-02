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

  /* Pesos. Somam 100 nas praias de mar. */
  var PESOS = { ceu: 28, vento: 26, ar: 20, agua: 16, chuva: 10 };

  /* --------------------------------------------------- tabelas de pontos */

  /* Vento médio, km/h a 10 m. O degrau grande está nos 20-25 km/h: é aí que
     começa o transporte de areia por saltação (~19 km/h, convertido da
     velocidade de atrito) e é aí que a nortada é definida (25 km/h). */
  function pontosVento(v) {
    if (v == null) return null;
    if (v <= 12) return 26;
    if (v <= 19) return 22;
    if (v <= 25) return 14;
    if (v <= 32) return 6;
    if (v <= 40) return 2;
    return 0;
  }

  function pontosCeu(n) {
    if (n == null) return null;
    if (n <= 20) return 28;
    if (n <= 40) return 25;
    if (n <= 60) return 18;
    if (n <= 80) return 10;
    return 4;
  }

  /* Temperatura APARENTE, não a do termómetro: é a que inclui vento e humidade. */
  function pontosAr(t) {
    if (t == null) return null;
    if (t >= 25 && t <= 31) return 20;
    if ((t >= 22 && t < 25) || (t > 31 && t <= 34)) return 15;
    if ((t >= 19 && t < 22) || (t > 34 && t <= 37)) return 8;
    if ((t >= 16 && t < 19) || (t > 37 && t <= 40)) return 3;
    return 0;
  }

  /* A escala portuguesa. O Atlântico continental anda nos 17-20 °C em Agosto;
     uma escala mediterrânica marcava o país inteiro a vermelho todo o ano. */
  function pontosAgua(t) {
    if (t == null) return null;
    if (t >= 22) return 16;
    if (t >= 20) return 13;
    if (t >= 18) return 9;
    if (t >= 16) return 5;
    if (t >= 14) return 2;
    return 0;
  }

  function pontosChuva(p) {
    if (p == null) return null;
    if (p < 10) return 10;
    if (p <= 25) return 7;
    if (p <= 45) return 4;
    if (p <= 70) return 1;
    return 0;
  }

  /* ------------------------------------------------------------ palavras */

  function palavrasVento(v) {
    if (v == null) return '';
    if (v <= 12) return 'A toalha fica quieta';
    if (v <= 19) return 'Brisa agradável';
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
  function maximo(a) {
    var v = a.filter(function (x) { return x != null; });
    return v.length ? Math.max.apply(null, v) : null;
  }

  /* Índices das horas que caem na janela de praia, para um dia. */
  function janela(horas, dia) {
    var ix = [];
    for (var i = 0; i < horas.length; i++) {
      if (horas[i].slice(0, 10) !== dia) continue;
      var h = +horas[i].slice(11, 13);
      if (h >= HORA_INI && h <= HORA_FIM) ix.push(i);
    }
    return ix;
  }
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
    var vetos = [];
    if (d.trovoada) vetos.push('trovoada prevista');
    if (d.chuva != null && d.chuva > 70) vetos.push('chuva quase certa');
    if (d.mm != null && d.mm >= 2) vetos.push('chuva a sério');
    if (d.vento != null && d.vento > 45) vetos.push('vento demasiado forte');
    if (d.rajada != null && d.rajada > 65) vetos.push('rajadas perigosas');
    if (d.ar != null && d.ar < 16) vetos.push('frio a mais');
    if (mar && d.ondas != null && d.ondas > 2.5) vetos.push('mar muito cavado');

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

    var cor;
    if (vetos.length) cor = 'vermelho';
    else if (pior_racio < 0.08) cor = 'vermelho';
    else {
      cor = nota >= 70 ? 'verde' : (nota >= 45 ? 'amarelo' : 'vermelho');
      /* Um dia com o céu mais tapado do que aberto (>60% de nuvens) não é um
         dia de praia a sério, por muito que o resto some. Medido em Carcavelos:
         72% de nuvens com tudo o resto bom dava 71 pontos e «Vai dar praia».
         O corte em 0,40 é exactamente o degrau dos 60% de nebulosidade. */
      if (cor === 'verde' && pior_racio < 0.40) cor = 'amarelo';
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
      frase = 'Não vale a pena: ' + vetos[0] + '.';
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
      nota: nota, cor: cor, frase: frase, vetos: vetos, factores: f,
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
      var ixm = mHoras.length ? janela(mHoras, dia) : [];

      var vento = media(fatia(tempo.hourly.wind_speed_10m, ix));
      var agua = ixm.length ? media(fatia(mh.sea_surface_temperature, ixm)) : null;
      var ondas = ixm.length ? maximo(fatia(mh.wave_height, ixm)) : null;

      return {
        dia: dia,
        vento: vento == null ? null : Math.round(vento),
        rajada: maximo(fatia(tempo.hourly.wind_gusts_10m, ix)),
        dirVento: media(fatia(tempo.hourly.wind_direction_10m, ix)),
        ceu: media(fatia(tempo.hourly.cloud_cover, ix)),
        ar: maximo(fatia(tempo.hourly.apparent_temperature, ix)),
        arReal: maximo(fatia(tempo.hourly.temperature_2m, ix)),
        agua: agua,
        chuva: maximo(fatia(tempo.hourly.precipitation_probability, ix)),
        mm: (tempo.daily.precipitation_sum || [])[iDia],
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
    palavrasOndas: palavrasOndas,
    PESOS: PESOS,
    HORA_INI: HORA_INI,
    HORA_FIM: HORA_FIM,
    /* expostos para os testes */
    _pontos: { vento: pontosVento, ceu: pontosCeu, ar: pontosAr, agua: pontosAgua, chuva: pontosChuva }
  };
})(typeof window !== 'undefined' ? window : globalThis);
