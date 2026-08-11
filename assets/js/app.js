/* =============================================================
   PRAIÓMETRO — aplicação
   =============================================================
   Site estático: não há servidor nenhum. Tudo o que acontece aqui acontece no
   browser de quem visita, e as duas APIs da Open-Meteo são públicas, sem chave
   e com CORS aberto — verificado antes de escolher.

   Este ficheiro trata da interface. Quem decide se o dia é bom é o modelo.js,
   que não sabe o que é o DOM.
   ============================================================= */
(function () {
  'use strict';

  var doc = document;
  var el = function (id) { return doc.getElementById(id); };
  var M = window.Modelo;

  /* Ligar um ouvinte a um elemento que pode não existir nesta página.
     Hoje o ficheiro faz `el('perto').addEventListener(...)` quinze vezes ao
     nível de cima. Basta faltar UM desses id para dar `TypeError: null is not
     an object` — e, como isto corre tudo dentro do mesmo IIFE, nada a seguir
     chega a correr, incluindo o fetch do praias.json que está no fim. A página
     fica com o HTML e mais nada, sem erro nenhum à vista.
     As páginas de praia que aí vêm não vão ter os diálogos da conta. Replicar
     o esqueleto inteiro em cada uma delas era a outra saída, e era pior: o
     mesmo texto literal repetido em centenas de páginas é exactamente o que
     não se quer. */
  function on(id, ev, fn) {
    var n = el(id);
    if (n) n.addEventListener(ev, fn);
    return n;
  }

  var PRAIAS = [];
  var praiaActual = null;
  var dias = [];          /* dados agregados por dia */
  var veredictos = [];    /* classificação por dia */
  var diaEscolhido = 0;

  /* Praias conhecidas para arrancar, para o ecrã inicial não estar vazio.
     Escolhidas por serem conhecidas, não por serem as melhores, e postas por
     ORDEM GEOGRÁFICA, de norte para sul — a latitude está ao lado para se ver
     que a ordem é essa e não outra.

     São cinco e não mais: no computador têm de caber todas numa linha, e o
     `nowrap` do CSS não deixa a lista quebrar. Quem acrescentar uma praia aqui
     tem de confirmar que continua a caber — sobretudo com nomes compridos. */
  var ATALHOS = [
    'Praia de Matosinhos',   /* 41,18 — Porto */
    'Praia da Barra',        /* 40,64 — Aveiro */
    'Praia da Nazaré',       /* 39,60 — Leiria */
    'Praia de Carcavelos',   /* 38,68 — Lisboa */
    'Praia da Rocha'         /* 37,12 — Algarve */
  ];

  /* ------------------------------------------------------------ ícones */
  /* Cada veredicto tem uma FORMA diferente, não só uma cor: sol, sol com
     nuvem, e nuvem com chuva. Quem não distingue verde de vermelho continua a
     perceber, e a WCAG 1.4.1 exige exactamente isto. */
  var ICONES = {
    verde: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="24" cy="24" r="9" fill="currentColor" stroke="none"/><path d="M24 5v5M24 38v5M5 24h5M38 24h5M10.6 10.6l3.5 3.5M33.9 33.9l3.5 3.5M10.6 37.4l3.5-3.5M33.9 14.1l3.5-3.5"/></svg>',
    amarelo: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="17" cy="17" r="7" fill="currentColor" stroke="none"/><path d="M17 4v4M4 17h4M8.3 8.3l2.8 2.8"/><path d="M35 40H16a8 8 0 0 1 0-16 10 10 0 0 1 19.3-2.4A7.5 7.5 0 0 1 35 40Z" fill="var(--carta)"/></svg>',
    vermelho: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M34 29H15a8 8 0 0 1 0-16 10 10 0 0 1 19.3-2.4A7.5 7.5 0 0 1 34 29Z"/><path d="M16 35l-2 6M25 35l-2 6M34 35l-2 6"/></svg>'
  };
  /* «Hoje não» num cartão de sexta-feira é simplesmente falso — e é também o
     que o leitor de ecrã lê em voz alta. A palavra passa a depender do dia. */
  var PALAVRAS = {
    verde:    { hoje: 'Dia de praia',   outro: 'Dia de praia' },
    amarelo:  { hoje: 'Assim-assim',    outro: 'Assim-assim' },
    vermelho: { hoje: 'Hoje não',       outro: 'Não vale a pena' }
  };
  function palavra(cor, i) { return PALAVRAS[cor][i === 0 ? 'hoje' : 'outro']; }

  var ICONES_FACTOR = {
    ceu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5"/></svg>',
    vento: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8h11a3 3 0 1 0-3-3M3 16h14a3 3 0 1 1-3 3M3 12h7"/></svg>',
    ar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4.5 4.5 0 1 1-4 0Z"/></svg>',
    agua: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 15c2 0 2-1.6 4-1.6s2 1.6 4 1.6 2-1.6 4-1.6 2 1.6 4 1.6M3 19c2 0 2-1.6 4-1.6s2 1.6 4 1.6 2-1.6 4-1.6 2 1.6 4 1.6"/><path d="M12 3c2.5 3.4 4 5.6 4 7.4a4 4 0 0 1-8 0C8 8.6 9.5 6.4 12 3Z"/></svg>',
    chuva: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 15H8a4.5 4.5 0 0 1 0-9 5.6 5.6 0 0 1 10.8-1.3A4.2 4.2 0 0 1 17 15Z"/><path d="M9 19l-1 3M14 19l-1 3"/></svg>'
  };

  /* ------------------------------------------------------------ ajudas */

  /* Tem de fazer EXACTAMENTE a mesma limpeza que fez o ficheiro de praias,
     senão escrever o nome tal como o site o mostra não encontra nada: em
     «Praia do Furadouro - Norte» o hífen virou espaço nos dados, e na pesquisa
     ficava um termo «-» que não existe em lado nenhum. */
  function normalizar(s) {
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
  }
  /* Vírgula decimal. Em português escreve-se 18,3 °C, não 18.3 °C. */
  function num(v, casas) {
    if (v == null) return '—';
    return v.toFixed(casas == null ? 0 : casas).replace('.', ',');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function distancia(a, b, c, d) {
    var R = 6371, p = Math.PI / 180;
    var dl = (c - a) * p, dn = (d - b) * p;
    var x = Math.sin(dl / 2) * Math.sin(dl / 2) +
            Math.cos(a * p) * Math.cos(c * p) * Math.sin(dn / 2) * Math.sin(dn / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function nomeDia(iso, i) {
    var d = new Date(iso + 'T12:00:00');
    if (i === 0) return 'Hoje';
    if (i === 1) return 'Amanhã';
    return d.toLocaleDateString('pt-PT', { weekday: 'short' }).replace('.', '');
  }
  function dataCurta(iso) {
    var d = new Date(iso + 'T12:00:00');
    return d.getDate() + '/' + (d.getMonth() + 1);
  }
  function dataLonga(iso, i) {
    var d = new Date(iso + 'T12:00:00');
    var s = d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
    s = (i === 0 ? 'hoje, ' : i === 1 ? 'amanhã, ' : '') + s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /* ------------------------------------------------------------ procura */

  var caixa = el('procura');
  var lista = el('sugestoes');
  var estado = el('procura-estado');
  var marcado = -1;

  /* Pontua cada praia contra o que foi escrito. Começar pelo nome vale mais do
     que aparecer a meio: quem escreve «carca» quer Carcavelos, não «Praia do
     Carcavelos de Baixo» de outro sítio qualquer. */
  function procurar(q) {
    var n = normalizar(q).trim();
    if (n.length < 2) return [];
    var termos = n.split(/\s+/);
    var res = [];
    for (var i = 0; i < PRAIAS.length; i++) {
      var p = PRAIAS[i], alvo = p.b, pontos = 0, falhou = false;
      for (var t = 0; t < termos.length; t++) {
        var k = alvo.indexOf(termos[t]);
        if (k === -1) { falhou = true; break; }
        pontos += k === 0 ? 100 : (alvo[k - 1] === ' ' ? 60 : 20);
        pontos -= Math.min(k, 30) * 0.3;
      }
      if (falhou) continue;
      /* praias de mar primeiro: é o que a esmagadora maioria procura */
      if (p.m) pontos += 12;
      pontos -= alvo.length * 0.08;
      res.push({ p: p, s: pontos });
    }
    res.sort(function (a, b) { return b.s - a.s; });
    return res.slice(0, 8).map(function (x) { return x.p; });
  }

  /* Um listbox só pode conter `option`, e uma `option` não pode conter nada
     interactivo — tinha aqui um <button> dentro de cada uma. Num combobox as
     opções não se percorrem com o Tab: o foco fica na caixa de escrita e é o
     aria-activedescendant que diz ao leitor de ecrã qual está marcada. */
  function mostrarSugestoes(arr, titulo) {
    if (!arr.length) { esconderSugestoes(); return; }
    lista.innerHTML =
      (titulo ? '<li class="sugestao sugestao--titulo" role="presentation"><span class="sugestao__meta">' + esc(titulo) + '</span></li>' : '') +
      arr.map(function (p, i) {
        return '<li class="sugestao" role="option" id="sug-' + i + '" aria-selected="false"' +
          ' data-i="' + PRAIAS.indexOf(p) + '">' +
          '<span class="sugestao__nome">' + esc(p.n) + '</span>' +
          (p.m ? '' : '<span class="sugestao__rio">rio</span>') +
          '<span class="sugestao__meta">' + esc(p.c ? p.c + ' · ' + p.r : p.r) +
            (p.d != null ? ' · ' + num(p.d) + ' km' : '') + '</span>' +
          '</li>';
      }).join('');
    lista.hidden = false;
    caixa.setAttribute('aria-expanded', 'true');
    desmarcar();
  }
  /* Apontar para uma opção que já não existe é pior do que não apontar para
     nenhuma: o leitor de ecrã fica a anunciar um id fantasma. */
  function desmarcar() {
    marcado = -1;
    caixa.removeAttribute('aria-activedescendant');
  }
  function esconderSugestoes() {
    lista.hidden = true; lista.innerHTML = '';
    caixa.setAttribute('aria-expanded', 'false');
    desmarcar();
  }

  caixa.addEventListener('input', function () {
    var r = procurar(caixa.value);
    /* «Não encontrámos» num <li role=presentation> dentro do listbox não é
       anunciado por leitor nenhum, e dizer aria-expanded="true" sobre uma lista
       sem opções é mentira. A mensagem vai para a região que já é live. */
    if (caixa.value.trim().length >= 2 && !r.length) {
      esconderSugestoes();
      estado.textContent = 'Não encontrámos nenhuma praia com esse nome.';
    } else {
      estado.textContent = r.length ? r.length + (r.length === 1 ? ' praia encontrada' : ' praias encontradas') : '';
      mostrarSugestoes(r);
    }
  });

  caixa.addEventListener('keydown', function (e) {
    var opcoes = [].slice.call(lista.querySelectorAll('.sugestao[data-i]'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!opcoes.length) return;
      e.preventDefault();
      marcado += (e.key === 'ArrowDown' ? 1 : -1);
      if (marcado < 0) marcado = opcoes.length - 1;
      if (marcado >= opcoes.length) marcado = 0;
      opcoes.forEach(function (o, i) {
        o.setAttribute('aria-selected', i === marcado ? 'true' : 'false');
      });
      caixa.setAttribute('aria-activedescendant', opcoes[marcado].id);
      opcoes[marcado].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Home' || e.key === 'End') {
      if (!opcoes.length) return;
      e.preventDefault();
      marcado = e.key === 'Home' ? 0 : opcoes.length - 1;
      opcoes.forEach(function (o, i) { o.setAttribute('aria-selected', i === marcado ? 'true' : 'false'); });
      caixa.setAttribute('aria-activedescendant', opcoes[marcado].id);
      opcoes[marcado].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (marcado >= 0 && opcoes[marcado]) { e.preventDefault(); escolher(PRAIAS[+opcoes[marcado].dataset.i]); }
      else if (opcoes.length) { e.preventDefault(); escolher(PRAIAS[+opcoes[0].dataset.i]); }
    } else if (e.key === 'Escape') {
      esconderSugestoes();
    }
  });

  lista.addEventListener('click', function (e) {
    var b = e.target.closest('.sugestao[data-i]');
    if (!b) return;
    escolher(PRAIAS[+b.dataset.i]);
  });

  doc.addEventListener('click', function (e) {
    if (!e.target.closest('.procura')) esconderSugestoes();
  });

  /* --------------------------------------------------------- geolocalização */

  on('perto', 'click', function () {
    var b = this;
    if (!navigator.geolocation) {
      estado.textContent = 'O teu browser não permite saber onde estás.';
      return;
    }
    b.setAttribute('aria-busy', 'true');
    estado.textContent = 'À procura de onde estás…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      b.removeAttribute('aria-busy');
      var la = pos.coords.latitude, lo = pos.coords.longitude;
      var perto = PRAIAS.filter(function (p) { return p.m; })
        .map(function (p) { p.d = distancia(la, lo, p.la, p.lo); return p; })
        .sort(function (x, y) { return x.d - y.d; })
        .slice(0, 6);
      if (!perto.length || perto[0].d > 300) {
        estado.textContent = 'Não encontrámos praias perto de ti.';
        return;
      }
      estado.textContent = '';
      caixa.value = '';
      mostrarSugestoes(perto, 'Mais perto de ti');
      caixa.focus();
    }, function (err) {
      b.removeAttribute('aria-busy');
      estado.textContent = err.code === 1
        ? 'Não deste permissão para saber onde estás. Escreve o nome da praia.'
        : 'Não conseguimos saber onde estás. Escreve o nome da praia.';
    }, { timeout: 10000, maximumAge: 300000 });
  });

  /* ------------------------------------------------------------- dados */

  /* Quatro centros meteorológicos independentes em vez de um.
     Medido no Furadouro, mesmo ponto e mesma janela: ECMWF 10,8 · ICON 11,2 ·
     KNMI 12,7 · Météo-France 13,5 · UKMO 13,8 · GFS 16,0 km/h. A dispersão
     entre modelos é de 1,6x, e o modelo por omissão calhava no extremo baixo —
     era por isso que o site dizia menos vento do que os outros sítios.
     Custa 26 KB em vez de 8, num único pedido. */
  var MODELOS = ['ecmwf_ifs025', 'icon_seamless', 'gfs_seamless', 'ukmo_seamless'];

  /* Um só construtor para uma praia ou para muitas. A Open-Meteo aceita
     coordenadas separadas por vírgula e devolve um array pela mesma ordem —
     verificado nas duas APIs. Interessa que seja o MESMO construtor: se a
     tira de favoritos pedisse menos variáveis do que a página, a bolinha
     podia dizer verde e a praia aberta dizer amarelo. */
  function urlTempo(pontos, dias) {
    var a = [].concat(pontos);
    return 'https://api.open-meteo.com/v1/forecast'
      + '?latitude=' + a.map(function (p) { return p.la; }).join(',')
      + '&longitude=' + a.map(function (p) { return p.lo; }).join(',')
      + '&hourly=temperature_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,'
      + 'wind_direction_10m,cloud_cover,precipitation,precipitation_probability,uv_index,weather_code'
      + '&daily=weather_code,precipitation_sum'
      + '&timezone=auto&forecast_days=' + (dias || 6)
      + '&models=' + MODELOS.join(',');
  }

  function urlMar(pontos, dias) {
    var a = [].concat(pontos);
    return 'https://marine-api.open-meteo.com/v1/marine'
      + '?latitude=' + a.map(function (p) { return p.la; }).join(',')
      + '&longitude=' + a.map(function (p) { return p.lo; }).join(',')
      + '&hourly=sea_surface_temperature,wave_height'
      + '&timezone=auto&forecast_days=' + (dias || 6);
  }

  /* Com uma coordenada a resposta é um objecto, com várias é um array. */
  function comoArray(x) { return x == null ? [] : (Array.isArray(x) ? x : [x]); }

  /* Guarda a resposta durante meia hora. Sem isto, cada abertura da página
     eram dois pedidos, e os favoritos passariam a quatro — a Open-Meteo é
     gratuita e sem chave, mas responde 429 a quem abusa. */
  var TTL = 30 * 60 * 1000;
  function buscar(url) {
    var agora = new Date().getTime();
    try {
      var c = JSON.parse(sessionStorage.getItem('pm:c:' + url) || 'null');
      if (c && agora - c.t < TTL) return Promise.resolve(c.d);
    } catch (e) { }
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (d) {
      try { sessionStorage.setItem('pm:c:' + url, JSON.stringify({ t: agora, d: d })); } catch (e) { }
      return d;
    });
  }

  /* `automatico` é true quando a praia vem do endereço ou da última visita —
     aí não se mexe no foco, porque ninguém pediu nada. */
  function escolher(praia, automatico) {
    praiaActual = praia;
    var focoAoPedir = doc.activeElement;
    esconderSugestoes();
    caixa.value = praia.n;
    caixa.blur();
    estado.textContent = 'A ver como está…';
    el('vazio').hidden = true;

    var pedidos = [buscar(urlTempo(praia))];
    /* A API marinha só responde em pontos com mar. Numa praia de rio o pedido
       nem se faz; noutras pode falhar, e isso não pode deitar a página abaixo. */
    pedidos.push(praia.m
      ? buscar(urlMar(praia)).catch(function () { return null; })
      : Promise.resolve(null));

    Promise.all(pedidos).then(function (r) {
      dias = M.agregar(M.consenso(r[0], MODELOS), r[1], praia);
      veredictos = dias.map(M.classificarDia);
      diaEscolhido = 0;
      estado.textContent = '';
      /* Já sabemos a cor de hoje desta praia: a tira de favoritos aproveita-a
         em vez de a voltar a pedir. */
      if (veredictos[0]) coresFav[F.id(praia)] = veredictos[0].cor;
      desenhar();
      /* Sem isto o foco ficava no <body> depois de escolher: quem anda de
         teclado tinha de percorrer a página toda outra vez para chegar ao
         resultado que acabou de pedir. Mas a resposta pode demorar segundos
         numa rede móvel, e roubar o foco a quem já está a escrever noutro
         sítio é pior do que não o mover. */
      if (!automatico && (doc.activeElement === focoAoPedir || doc.activeElement === doc.body)) {
        /* `preventScroll` porque mover o foco é para orientar quem usa teclado
           ou leitor de ecrã, não para levar a página a passear: sem isto o
           browser rolava até ao resultado a cada praia escolhida, e quem
           escolheu a partir da caixa de procura ou da tira de favoritos —
           ambas acima do resultado — perdia de vista onde estava. */
        el('resultado').focus({ preventScroll: true });
      }
      try {
        localStorage.setItem('pm:praia', JSON.stringify({ id: F.id(praia), n: praia.n }));
        history.replaceState(null, '', '#' + endereco(praia));
      } catch (e) { }
    }).catch(function (e) {
      estado.textContent = 'Não conseguimos ir buscar a previsão. Tenta outra vez daqui a pouco.';
      el('vazio').hidden = false;
    });
  }

  /* ---------------------------------------------------------- desenhar */

  function desenhar() {
    el('resultado').hidden = false;
    desenharDias();
    desenharVeredicto();
    desenharDetalhe();
    /* Fica para o fim e é assíncrono: o mapa é a coisa menos urgente do ecrã,
       e o ficheiro dos contornos só se pede na primeira praia escolhida. */
    if (praiaActual) mostrarMapa(praiaActual);
  }

  function desenharDias() {
    el('dias').innerHTML = dias.map(function (d, i) {
      var v = veredictos[i];
      /* tabindex a saltar de um para o outro («roving»): o Tab entra na tira
         uma vez e sai; lá dentro anda-se com as setas, que é o que a WAI-ARIA
         manda num tablist e o que qualquer pessoa espera de uma tira de dias. */
      return '<button class="dia dia--' + v.cor + '" type="button" role="tab" data-i="' + i + '"' +
        ' id="dia-' + i + '" aria-controls="veredicto"' +
        ' tabindex="' + (i === diaEscolhido ? '0' : '-1') + '"' +
        ' aria-selected="' + (i === diaEscolhido) + '"' +
        ' aria-label="' + esc(nomeDia(d.dia, i) + ', ' + palavra(v.cor, i) +
          (v.nota == null ? '' : ', nota ' + v.nota + ' em 100')) + '">' +
        '<span class="dia__nome">' + esc(nomeDia(d.dia, i)) + '</span>' +
        '<span class="dia__data">' + dataCurta(d.dia) + '</span>' +
        '<span class="dia__bolha" aria-hidden="true">' + ICONES[v.cor] + '</span>' +
        '<span class="dia__nota" aria-hidden="true">' + (v.nota == null ? '✕' : v.nota) + '</span>' +
        '</button>';
    }).join('');
  }

  on('dias', 'click', function (e) {
    var b = e.target.closest('.dia');
    if (!b) return;
    diaEscolhido = +b.dataset.i;
    desenhar();
  });

  on('dias', 'keydown', function (e) {
    var n = dias.length;
    if (!n) return;
    var novo = null;
    if (e.key === 'ArrowRight') novo = (diaEscolhido + 1) % n;
    else if (e.key === 'ArrowLeft') novo = (diaEscolhido - 1 + n) % n;
    else if (e.key === 'Home') novo = 0;
    else if (e.key === 'End') novo = n - 1;
    if (novo === null) return;
    e.preventDefault();
    diaEscolhido = novo;
    desenhar();
    /* Depois de redesenhar, o botão é outro: o foco tem de o seguir, senão
       fica no <body> e a seguinte seta não faz nada. */
    var b = el('dias').querySelector('.dia[data-i="' + novo + '"]');
    if (b) { b.focus(); b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  });

  function desenharVeredicto() {
    var d = dias[diaEscolhido], v = veredictos[diaEscolhido];
    doc.body.setAttribute('data-cor', v.cor);
    el('veredicto').setAttribute('aria-labelledby', 'dia-' + diaEscolhido);
    el('v-praia').textContent = praiaActual.n;
    el('v-praia').setAttribute('title', praiaActual.c ? praiaActual.c + ', ' + praiaActual.r : praiaActual.r);
    desenharEstrela();
    desenharFavoritos();
    el('v-dia').textContent = dataLonga(d.dia, diaEscolhido);
    el('v-icone').innerHTML = ICONES[v.cor];
    el('v-palavra').textContent = palavra(v.cor, diaEscolhido);
    el('v-frase').textContent = v.frase;
    /* Sem nota quando há veto: «Nota 94 em 100» ao lado de «Hoje não» destrói a
       confiança no resto. E a incerteza começa a aparecer ao 3.º dia, não ao 5.º. */
    var incerteza = diaEscolhido >= 2
      ? 'Previsão a ' + (diaEscolhido + 1) + ' dias' + (diaEscolhido >= 4 ? ' — ainda pode mudar bastante' : ' — pode mudar')
      : '';
    el('v-nota').textContent = (v.nota == null ? '' : 'Nota ' + v.nota + ' em 100')
      + (v.nota != null && incerteza ? ' · ' : '') + incerteza;

    /* Avisos que não entram na nota mas que interessam a quem vai. */
    var avisos = [];
    if (d.uv != null && d.uv >= 8) avisos.push('Sol muito forte — protector, chapéu e sombra entre as 12h e as 16h');
    else if (d.uv != null && d.uv >= 6) avisos.push('Sol forte — põe protector');
    /* A informação mais útil do site num Verão português: se de manhã está
       muito melhor do que de tarde, diz-se para ir cedo. */
    if (d.ventoManha != null && d.ventoTarde != null && d.ventoTarde - d.ventoManha >= 7) {
      avisos.push('De manhã ' + d.ventoManha + ' km/h, à tarde ' + d.ventoTarde + ' km/h — vale a pena ir cedo');
    } else if (v.nortada) {
      avisos.push('É nortada: costuma levantar-se de tarde');
    }
    if (d.mar && d.ondas != null && d.ondas >= 1.5) avisos.push('Mar cavado (' + num(d.ondas, 1) + ' m) — atenção com crianças');
    var av = el('v-aviso');
    av.hidden = !avisos.length;
    av.textContent = avisos.join(' · ');
    /* Um aviso de segurança não é um aviso amarelo: muda de cor e de tom.
       Pode vir de um veto (o dia está chumbado) ou de um aviso (o dia está
       bom E há um risco) — desde que a trovoada deixou de vetar, o segundo
       caso existe e é o mais comum. Ler `v.vetos[0]` às cegas dava
       «Aviso de segurança: undefined» num dia de nota 86. */
    av.classList.toggle('veredicto__aviso--perigo', !!v.perigo);
    if (v.perigo) {
      var perigos = (v.vetos || []).concat(v.avisos || []);
      var texto = 'Aviso de segurança: ' + perigos[0] + '.';
      /* Um aviso que não diz o que fazer não serve de nada a quem já está na
         areia — e este agora aparece ao lado de «Dia de praia». */
      if ((v.avisos || []).indexOf('pode haver trovoada') >= 0) {
        texto += ' Se ouvires trovões, sai da água e da praia.';
      }
      av.hidden = false;
      av.textContent = texto + (avisos.length ? ' · ' + avisos.join(' · ') : '');
    }
  }

  function desenharDetalhe() {
    var d = dias[diaEscolhido], v = veredictos[diaEscolhido];

    var linhas = v.factores.map(function (f) {
      var racio = f.pontos == null ? 0 : f.pontos / f.peso;
      var classe = racio >= 0.7 ? 'bom' : (racio >= 0.35 ? 'medio' : 'mau');
      var valor = '', extra = '';
      switch (f.id) {
        case 'ceu':
          /* «Sol: 82% de nuvens» era uma contradição em duas palavras. Mostra-se
             quanto céu está limpo, que é o que o nome do factor promete. */
          valor = f.valor == null ? '—' : (100 - Math.round(f.valor)) + '% de céu limpo';
          break;
        case 'vento':
          valor = f.valor == null ? '—' : f.valor + ' km/h';
          /* O intervalo é o que torna isto comparável com os outros sites: eles
             mostram o máximo do dia ou as rajadas, este mostra o vento típico da
             tarde. Sem o intervalo, parecia que estava errado. */
          extra = f.valor == null ? '' :
            'É o que se chama ' + M.beaufort(f.valor) + '. '
            + (d.ventoMin != null && d.ventoMax != null && d.ventoMax > d.ventoMin
                ? 'Ao longo da tarde varia entre ' + d.ventoMin + ' e ' + d.ventoMax + ' km/h. ' : '')
            + (d.rajada ? 'Rajadas até ' + Math.round(d.rajada) + ' km/h. ' : '')
            + 'Média de quatro modelos meteorológicos.';
          break;
        case 'ar':
          valor = f.valor == null ? '—' : Math.round(f.valor) + ' °C';
          extra = d.arReal != null && Math.abs(d.arReal - f.valor) >= 1
                  ? 'O termómetro marca ' + Math.round(d.arReal) + ' °C; com o vento e a humidade sente-se ' + Math.round(f.valor) + ' °C'
                  : 'Temperatura que se sente, já com o vento e a humidade';
          break;
        case 'agua':
          valor = num(f.valor, 1) + ' °C';
          extra = d.ondas != null ? M.palavrasOndas(d.ondas) + ' (' + num(d.ondas, 1) + ' m)' : '';
          break;
        case 'chuva':
          valor = f.valor == null ? '—' : Math.round(f.valor) + '% de hipótese';
          extra = d.mm ? 'Até ' + num(d.mm, 1) + ' mm previstos' : '';
          break;
      }
      return '<div class="factor factor--' + classe + '">' +
        '<div class="factor__topo">' +
        '<span class="factor__icone" aria-hidden="true">' + (ICONES_FACTOR[f.id] || '') + '</span>' +
        '<span class="factor__nome">' + esc(f.nome) + '</span>' +
        '<span class="factor__valor">' + esc(valor) + '</span></div>' +
        '<p class="factor__texto">' + esc(f.texto) + '</p>' +
        '<div class="factor__barra"><i style="width:' + Math.round(racio * 100) + '%"></i></div>' +
        (extra ? '<p class="factor__extra">' + esc(extra) + '</p>' : '') +
        '</div>';
    }).join('');

    var rodape = 'Contas feitas com a previsão entre as ' + M.HORA_INI + 'h e as ' + M.HORA_FIM + 'h.';
    if (!d.mar) rodape += ' Esta é uma praia de rio: não há dados de temperatura da água nem de ondulação.';
    else if (d.agua == null) rodape += ' Não há dados de mar para este ponto.';

    /* A licença da Open-Meteo exige o link «junto ao local onde os dados são
       mostrados», e a documentação marinha exige também referência ao DWD.
       Só no rodapé da página não cumpria. */
    var credito = '<p class="detalhe__credito">Dados de '
      + '<a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a>'
      + (d.mar && d.agua != null ? ', com dados marinhos do <abbr title="Deutscher Wetterdienst">DWD</abbr>' : '')
      + '.</p>';

    el('detalhe-corpo').innerHTML = linhas + '<p class="detalhe__rodape">' + esc(rodape) + '</p>' + credito;
  }

  /* ---------------------------------------------------------- favoritos */

  var F = window.Favoritos;
  var coresFav = {};        /* id da praia -> cor de hoje, durante esta visita */
  var LEGENDA = { verde: 'hoje vai dar praia', amarelo: 'hoje assim-assim', vermelho: 'hoje não vale a pena' };

  /* Nome curto para o chip: «Praia de Matosinhos» não cabe seis vezes numa
     tira de telemóvel, e quem a guardou sabe bem qual é. */
  function curto(n) {
    return n.replace(/^Praia (Fluvial )?(da |de |do |dos |das )?/, '').replace(/^Prainha d[ao] /, '');
  }

  function desenharEstrela() {
    var b = el('v-estrela');
    if (!praiaActual) return;
    var marcada = F.tem(praiaActual);
    b.setAttribute('aria-pressed', marcada ? 'true' : 'false');
    el('v-estrela-texto').textContent = marcada ? 'Guardada' : 'Guardar';
    /* O rótulo nomeia o OBJECTO, não a acção. Com «Remover…» mais
       aria-pressed="true" o leitor de ecrã dizia «Remover Carcavelos das tuas
       praias, botão, premido» — e ninguém percebe se acabou de guardar ou de
       apagar. Fixo no objecto, lê-se «Guardar Carcavelos…, premido». */
    b.setAttribute('aria-label', 'Guardar ' + praiaActual.n + ' nas tuas praias');
  }

  on('v-estrela', 'click', function () {
    if (!praiaActual) return;
    var r = F.alternar(praiaActual);
    /* Quando dá 'cheio' nada muda, e portanto o F.aoMudar não dispara: sem esta
       mensagem quem não vê carregava na estrela e não recebia retorno nenhum. */
    avisar(r === 'cheio'
      ? 'Já tens ' + F.limite + ' praias guardadas. Tira uma da lista para guardares esta.'
      : '');
    if (r === 'cheio') { desenharEstrela(); desenharFavoritos(); }
  });

  function desenharFavoritos() {
    var arr = PRAIAS.length ? F.resolver(PRAIAS) : [];
    el('favoritos').hidden = !arr.length;
    if (!arr.length) return;
    el('favoritos-lista').innerHTML = arr.map(function (p) {
      var k = F.id(p), cor = coresFav[k];
      var aqui = praiaActual && F.id(praiaActual) === k;
      return '<li>' +
        '<button class="fav' + (cor ? ' fav--' + cor : '') + '" type="button" data-id="' + esc(k) + '"' +
        (aqui ? ' aria-current="true"' : '') +
        ' aria-label="' + esc(p.n + (p.m ? '' : ', praia de rio') + (cor ? ', ' + LEGENDA[cor] : '')) + '">' +
        /* A cor sozinha não chega (WCAG 1.4.1): cada veredicto tem a mesma
           FORMA que tem no cartão grande — sol, sol com nuvem, chuva. */
        '<span class="fav__ponto" aria-hidden="true">' + (cor ? ICONES[cor] : '') + '</span>' +
        '<span class="fav__nome">' + esc(curto(p.n)) + '</span>' +
        /* Numa praia de rio não entra a temperatura da água, e por isso a nota
           sai ~6 pontos acima da de uma praia de mar com o mesmo tempo. Lado a
           lado numa tira, isso enganaria sem esta marca. */
        (p.m ? '' : '<span class="fav__rio" aria-hidden="true">rio</span>') +
        '</button></li>';
    }).join('');
  }

  on('favoritos-lista', 'click', function (e) {
    var b = e.target.closest('.fav');
    if (!b) return;
    var p = PRAIAS.find(function (x) { return F.id(x) === b.dataset.id; });
    if (p) escolher(p);
  });

  /* Todas as cores em falta num único par de pedidos, em vez de um par por
     praia: a Open-Meteo aceita várias coordenadas de uma vez. */
  function coresDosFavoritos() {
    var arr = PRAIAS.length ? F.resolver(PRAIAS) : [];
    var falta = arr.filter(function (p) { return !coresFav[F.id(p)]; });
    if (!falta.length) return;
    var mar = falta.filter(function (p) { return p.m; });

    Promise.all([
      buscar(urlTempo(falta, 1)).catch(function () { return null; }),
      mar.length ? buscar(urlMar(mar, 1)).catch(function () { return null; }) : Promise.resolve(null)
    ]).then(function (r) {
      var tempo = comoArray(r[0]), marinho = comoArray(r[1]);
      if (!tempo.length) return;
      var porMar = {};
      mar.forEach(function (p, i) { porMar[F.id(p)] = marinho[i] || null; });
      falta.forEach(function (p, i) {
        if (!tempo[i]) return;
        try {
          var d = M.agregar(M.consenso(tempo[i], MODELOS), porMar[F.id(p)], p);
          if (d && d[0]) coresFav[F.id(p)] = M.classificarDia(d[0]).cor;
        } catch (e) { }
      });
      desenharFavoritos();
    });
  }

  /* -------------------------------------------------------------- conta */

  var C = window.Conta;

  function desenharConta() {
    /* As páginas de praia não vão ter a caixa da conta. Sem esta guarda, a
       primeira linha rebentava e levava atrás tudo o que corre depois. */
    if (!el('conta')) return;
    var quem = C.quem();
    el('conta-entrar').hidden = !!quem || !C.disponivel();
    /* Sem nada para mostrar, não se reserva a altura: só faz sentido guardá-la
       para o caso em que algo vai mesmo aparecer. */
    el('conta').classList.toggle('conta--vazia', !quem && !C.disponivel());
    el('conta-menu').hidden = !quem;
    if (!quem) { el('conta-menu').open = false; return; }
    var nome = quem.nome || quem.email || '';
    el('conta-inicial').textContent = (nome.trim()[0] || '?').toUpperCase();
    el('conta-nome').textContent = nome;
    el('conta-email').textContent = quem.email && quem.email !== nome ? quem.email : '';
    el('conta-menu').querySelector('summary').setAttribute('aria-label', 'A tua conta: ' + nome);
  }

  on('conta-entrar', 'click', function () {
    this.disabled = true;
    /* Antes de sair da página, guarda a lista que existe agora: é ela que
       volta se a pessoa terminar sessão neste aparelho. */
    F.guardarAntesDeEntrar();
    C.entrar().catch(function (e) {
      el('conta-entrar').disabled = false;
      estado.textContent = e && e.message === 'armazenamento-bloqueado'
        ? 'O teu browser está a bloquear o armazenamento e sem ele não é possível entrar. Experimenta fora da navegação privada.'
        : 'Não conseguimos abrir a entrada com o Google. Tenta outra vez.';
    });
  });

  /* Depois de terminar sessão, o aparelho não pode ficar com as praias da
     conta: num computador partilhado, a pessoa seguinte carregava-as para a
     conta dela sem nunca as ter marcado. */
  function fecharSessao(msg) {
    F.reporDeAntesDeEntrar();
    desenharConta();
    desenharEstrela();
    desenharFavoritos();
    coresDosFavoritos();
    estado.textContent = msg;
    var alvo = C.disponivel() ? el('conta-entrar') : el('procura');
    if (alvo) alvo.focus();
  }

  on('conta-sair', 'click', function () {
    C.sair().then(function () { fecharSessao('Sessão terminada.'); });
  });

  /* ------------------------------------------------------------- perfil */

  /* Quem abriu o painel, para lhe devolver o foco ao fechar: um `<dialog>`
     devolve-o sozinho, mas só quando é ele a fechar-se — e aqui há dois
     encadeados, e um deles termina com a sessão fechada e o avatar já
     desaparecido do ecrã. */
  var focoAntesDoPainel = null;

  function abrirPainel(id) {
    var d = el(id);
    focoAntesDoPainel = doc.activeElement;
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');          /* sem <dialog>: fica inline, mas abre */
  }
  function fecharPainel(id) {
    var d = el(id);
    if (typeof d.close === 'function' && d.open) d.close();
    else d.removeAttribute('open');
  }

  function desenharPerfil() {
    var quem = C.quem();
    if (!quem) return;
    var nome = quem.nome || quem.email || '';
    el('perfil-nome').textContent = nome;
    el('perfil-email').textContent = quem.email && quem.email !== nome ? quem.email : '';
    var n = F.lista().length;
    el('perfil-quantas').textContent = n === 0 ? 'Nenhuma praia guardada'
      : (n === 1 ? '1 praia guardada' : n + ' praias guardadas');
  }

  on('conta-perfil', 'click', function () {
    el('conta-menu').open = false;
    desenharPerfil();
    abrirPainel('perfil');
  });
  on('perfil-fechar', 'click', function () { fecharPainel('perfil'); });
  /* Clicar fora, no backdrop: o clique cai no próprio <dialog>, porque o corpo
     está num filho. Sem isto só se fechava pelo X ou pelo Escape. */
  on('perfil', 'click', function (e) {
    if (e.target === this) fecharPainel('perfil');
  });
  on('perfil', 'close', function () {
    if (focoAntesDoPainel && doc.contains(focoAntesDoPainel)) focoAntesDoPainel.focus();
  });

  /* Apagar é irreversível, e o texto tem de dizer o que apaga mesmo — a versão
     anterior falava só das praias e a operação apaga a conta inteira. A
     confirmação é um painel e não o `confirm()` do browser: o nativo aparece
     desenraizado da página, no telemóvel dá-se-lhe «OK» sem ler, e em algumas
     situações o browser simplesmente não o mostra. */
  on('conta-apagar', 'click', function () {
    abrirPainel('confirmar');
  });
  on('confirmar-nao', 'click', function () { fecharPainel('confirmar'); });
  on('confirmar', 'click', function (e) {
    if (e.target === this) fecharPainel('confirmar');
  });

  on('confirmar-sim', 'click', function () {
    var b = this, nao = el('confirmar-nao'), texto = el('confirmar-texto');
    b.disabled = nao.disabled = true;
    b.textContent = 'A apagar…';
    C.apagarConta().then(function () {
      fecharPainel('confirmar');
      fecharPainel('perfil');
      fecharSessao('Conta apagada.');
    }).catch(function () {
      /* A falha fica dentro do painel: um `alert()` por cima de um diálogo é
         um empilhamento que ninguém percebe, e o painel é onde a pessoa está. */
      texto.textContent = 'Não conseguimos apagar agora. Tenta outra vez daqui a pouco.';
    }).then(function () {
      b.disabled = nao.disabled = false;
      b.textContent = 'Apagar para sempre';
    });
  });

  /* Um <details> não fecha sozinho: sem isto o menu da conta ficava aberto por
     cima da página até se voltar a carregar no avatar. */
  doc.addEventListener('click', function (e) {
    if (!e.target.closest('#conta')) el('conta-menu').open = false;
  });
  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var m = el('conta-menu');
    if (!m.open) return;
    m.open = false;
    m.querySelector('summary').focus();
  });

  function avisar(texto) {
    var av = el('favoritos-aviso');
    av.textContent = texto || '';
    av.hidden = !texto;
  }

  /* Entrar não substitui: junta. Quem marcou praias no telemóvel sem conta
     não as pode perder por ter entrado no computador. */
  function sincronizar() {
    if (!C.activa()) return Promise.resolve();
    /* Primeiro cumprem-se as operações que ficaram por fazer da última vez —
       sobretudo as remoções, senão a praia que a pessoa tirou reaparece. Só
       depois se lê a conta, que a esta altura já está certa. */
    return C.drenar().then(function () { return C.lerNuvem(); }).then(function (naConta) {
      naConta = naConta || [];
      /* O que ainda estiver por apagar não pode voltar a entrar pela fusão. */
      var porApagar = {};
      C.pendentes().forEach(function (o) { if (o.op === 'del') porApagar[o.id] = 1; });
      /* E o que está por apagar mas já não está na conta está cumprido: sai da
         fila, senão ficava a ser tentado em cada arranque para sempre. */
      var estaNaConta = {};
      naConta.forEach(function (x) { estaNaConta[x.praia_id] = 1; });
      C.esquecerRemocoes(Object.keys(porApagar).filter(function (id) { return !estaNaConta[id]; }));
      var nuvem = naConta.filter(function (x) { return !porApagar[x.praia_id]; });
      /* A fusão lê a lista DENTRO do then, e não antes do pedido: uma estrela
         marcada durante a ida-e-volta à rede seria escrita por cima. */
      var daConta = (nuvem || []).map(function (x) {
        return { id: x.praia_id, n: x.nome, t: Date.parse(x.criado_em) || 1 };
      });
      /* Da primeira vez nesta conta e neste aparelho, junta — é o que salva as
         praias marcadas antes de entrar. Daí para a frente manda a conta, senão
         uma praia apagada noutro aparelho era ressuscitada aqui pela união e
         voltava a subir. O que está na fila para subir é protegido: ainda não
         chegou à conta, e não é o mesmo que ter sido apagado. */
      var porSubir = C.pendentes().filter(function (o) { return o.op === 'add'; })
                                  .map(function (o) { return o.id; });
      var r;
      if (C.jaFundiu()) {
        r = F.substituir(daConta, porSubir);
      } else {
        r = F.fundir(daConta);
        C.marcarFundido();
      }
      desenharEstrela();
      desenharFavoritos();
      coresDosFavoritos();

      if (r.deixados.length) {
        avisar('Tens mais de ' + F.limite + ' praias entre este aparelho e a tua conta. '
             + 'Ficaram de fora as ' + r.deixados.length + ' mais antigas.');
      }

      /* Sobe o que só existia aqui, sem passar do limite do lado de lá. */
      var naNuvem = {};
      (nuvem || []).forEach(function (x) { naNuvem[x.praia_id] = 1; });
      var subir = F.lista().filter(function (x) { return !naNuvem[x.id]; })
                           .slice(0, Math.max(0, F.limite - (nuvem || []).length));
      if (!subir.length) return null;
      return C.juntarNuvem(subir).catch(function () {
        avisar('Guardámos as praias neste aparelho, mas não conseguimos pô-las na tua conta.');
      });
    });
  }

  /* Dois papéis diferentes, e antes estavam colados: o desenho tem de acontecer
     SEMPRE que a lista muda — também quando muda por fusão ou por outro
     separador — senão a estrela fica a mostrar o estado anterior e o clique
     seguinte apaga onde a pessoa queria guardar. Subir para a nuvem é que só
     acontece numa mudança deliberada e com sessão aberta. */
  F.aoMudar(function (itens, mudanca) {
    desenharEstrela();
    desenharFavoritos();
    if (!mudanca || !C.activa()) return;
    var p = mudanca.tipo === 'marcada'
      ? C.juntarNuvem([{ id: mudanca.id, n: mudanca.n }])
      : C.apagarNuvem(mudanca.id);
    p.then(function () {
      /* Cumprido: o que estivesse na fila para esta praia já não faz sentido.
         Sem isto, um 'add' que ficou de uma falha de rede sobrevivia a uma
         remoção bem-sucedida, e o drenar() do arranque seguinte voltava a
         inserir a praia na conta. */
      C.cumprido(mudanca.id);
    }).catch(function () {
      /* Fica na fila em vez de se perder: tenta-se outra vez no arranque
         seguinte, e até lá a fusão respeita esta intenção. */
      C.adiar({ op: mudanca.tipo === 'marcada' ? 'add' : 'del', id: mudanca.id, n: mudanca.n });
      /* Sem aviso, de propósito: para quem marca a praia, a estrela já mudou e
         a praia já está na tira — a sincronização é problema nosso, não dela.
         A fila em cima é que garante que não se perde. */
    });
  });

  /* Sem isto, uma sessão que morre a meio da visita continuava a aparecer como
     activa no cabeçalho até alguém recarregar a página. */
  C.aoMudar(function () { desenharConta(); });

  /* ------------------------------------------------------------ arranque */

  /* O nome não identifica uma praia: há quatro «Praia dos Pescadores». O link
     partilhado continua legível, mas leva a coordenada quando é preciso. */
  function endereco(p) {
    var repetido = PRAIAS.filter(function (x) { return x.n === p.n; }).length > 1;
    return encodeURIComponent(p.n) + (repetido ? '@' + F.id(p) : '');
  }
  function doEndereco(h) {
    if (!h) return null;
    var k = h.lastIndexOf('@');
    var nome = decodeURIComponent(k > 0 ? h.slice(0, k) : h);
    var coord = k > 0 ? h.slice(k + 1) : '';
    return PRAIAS.find(function (x) { return x.n === nome && (!coord || F.id(x) === coord); })
        || PRAIAS.find(function (x) { return x.n === nome; }) || null;
  }

  /* O que fica por cumprir enquanto a lista de praias não chegou. Quem carrega
     num atalho nos primeiros instantes clicava no vazio; agora a intenção
     fica guardada e cumpre-se assim que o fetch acabar. */
  var atalhoPendente = null;

  /* Os botões já vêm escritos no index.html — este ficheiro deixou de os
     montar. Eram a última coisa a aparecer e empurravam a página com ela já à
     vista. A chave passou a ser a coordenada (F.id) em vez do índice em
     PRAIAS, porque esse índice não existe antes do ficheiro ter chegado. */
  function atalhos() {
    on('atalhos', 'click', function (e) {
      var b = e.target.closest('.atalho');
      if (!b) return;
      var p = porId(b.dataset.id);
      if (p) escolher(p); else atalhoPendente = b.dataset.id;
    });
  }
  function porId(id) {
    if (!id || !PRAIAS.length) return null;
    return PRAIAS.find(function (x) { return F.id(x) === id; }) || null;
  }

  /* Ligado ANTES do fetch, e já não lá dentro: os botões estão no HTML desde o
     primeiro instante, e sem isto um clique nesses instantes não fazia nada. */
  atalhos();


  /* =========================================================== ONDE FICA ===
     Desenha o contorno dos concelhos à volta da praia, em SVG, a partir de
     /data/mapa.json. Sem tiles e sem pedidos a terceiros: um mapa de tiles
     manda o IP de quem visita para um servidor de outra pessoa a cada
     quadrado, e este site promete que não segue ninguém entre sites.

     Os polígonos da CAOP acabam na linha de costa, por isso o fundo da tela é
     o mar e as formas são a terra — o litoral desenha-se sozinho. */

  var MAPA = null, mapaPedido = null;

  function carregarMapa() {
    if (mapaPedido) return mapaPedido;
    mapaPedido = fetch('/data/mapa.json')
      .then(function (r) { return r.json(); })
      .then(function (d) { MAPA = d; return d; })
      .catch(function () { MAPA = null; return null; });
    return mapaPedido;
  }

  /* Meia-largura da vista, em graus de longitude. 0,26 dá ~44 km a 40° de
     latitude: chega para se ver a praia, a costa e os concelhos à volta. */
  var MAPA_MEIA = 0.26;
  var MAPA_W = 640, MAPA_H = 420;

  function desenharMapa(praia) {
    var caixa = el('mapa'), tela = el('mapa-tela');
    if (!caixa || !tela || !MAPA) return;

    var lat = praia.la, lon = praia.lo;
    var kx = Math.cos(lat * Math.PI / 180);          /* graus de lon são mais curtos */
    var meiaLon = MAPA_MEIA, meiaLat = meiaLon * kx * (MAPA_H / MAPA_W);
    var x0 = lon - meiaLon, x1 = lon + meiaLon;
    var y0 = lat - meiaLat, y1 = lat + meiaLat;
    var px = function (lo) { return (lo - x0) / (x1 - x0) * MAPA_W; };
    var py = function (la) { return (1 - (la - y0) / (y1 - y0)) * MAPA_H; };

    var formas = [], rotulos = [];
    MAPA.concelhos.forEach(function (c) {
      var b = c.b;
      if (b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1) return;   /* fora da vista */
      c.f.forEach(function (anel) {
        var d = '';
        for (var i = 0; i < anel.length; i++) {
          d += (i ? 'L' : 'M') + px(anel[i][0]).toFixed(1) + ' ' + py(anel[i][1]).toFixed(1);
        }
        formas.push('<path class="m-terra" d="' + d + 'Z"/>');
      });
      /* O rótulo vai ao centro da caixa, limitado à parte visível: um concelho
         que entra pela borda deve escrever o nome DENTRO da tela, não fora. */
      var cx = px(Math.min(x1, Math.max(x0, (Math.max(b[0], x0) + Math.min(b[2], x1)) / 2)));
      var cy = py(Math.min(y1, Math.max(y0, (Math.max(b[1], y0) + Math.min(b[3], y1)) / 2)));
      if (cy < 20 || cy > MAPA_H - 14) return;
      /* Meia largura do nome, estimada. Sem isto a verificação olhava só para
         o CENTRO do texto, e «Oliveira de Azeméis» — 19 letras — saía pela
         borda com o centro ainda dentro da tela. */
      /* 5,4 px por letra: são MAIÚSCULAS a negrito a 15 px. Com 4,4 — a
         estimativa de minúsculas — o «AROUCA» ainda saía pela borda. */
      var meia = c.n.length * 5.4;
      if (cx - meia < 4 || cx + meia > MAPA_W - 4) {
        cx = Math.min(MAPA_W - 4 - meia, Math.max(4 + meia, cx));
        if (cx - meia < 4) return;      /* nome maior do que a tela: desiste */
      }
      rotulos.push({ n: c.n, x: cx, y: cy, meia: meia });
    });

    /* Nomes a mais numa tela pequena é ruído. Fica-se pelos que não se tocam,
       e os primeiros são os concelhos maiores — o ficheiro já vem por tamanho. */
    var postos = [];
    rotulos.forEach(function (r) {
      if (postos.length >= 6) return;
      for (var i = 0; i < postos.length; i++) {
        /* Sobreposição a sério: compara as larguras dos dois nomes, e não uma
           distância fixa que trata «Ovar» como se fosse «Vila Nova de Gaia». */
        if (Math.abs(postos[i].x - r.x) < postos[i].meia + r.meia + 12
            && Math.abs(postos[i].y - r.y) < 30) return;
      }
      postos.push(r);
    });

    var pontoX = px(lon), pontoY = py(lat);
    var svg = '<svg viewBox="0 0 ' + MAPA_W + ' ' + MAPA_H + '" role="img" aria-label="'
      + esc('Mapa: ' + praia.n + ' fica no litoral, com os concelhos à volta assinalados.') + '">'
      + '<rect class="m-mar" width="' + MAPA_W + '" height="' + MAPA_H + '"/>'
      + formas.join('')
      + postos.map(function (r) {
          return '<text class="m-nome" x="' + r.x.toFixed(0) + '" y="' + r.y.toFixed(0)
            + '" font-size="15">' + esc(r.n.toUpperCase()) + '</text>';
        }).join('')
      + '<circle class="m-halo" cx="' + pontoX.toFixed(1) + '" cy="' + pontoY.toFixed(1) + '" r="18"/>'
      + '<circle class="m-ponto" cx="' + pontoX.toFixed(1) + '" cy="' + pontoY.toFixed(1) + '" r="7"/>'
      + '</svg>';

    tela.innerHTML = svg;
    var pe = el('mapa-pe');
    if (pe) pe.textContent = 'Contornos da CAOP (Direcção-Geral do Território). '
      + 'O mapa é desenhado aqui — não há pedidos a servidores de mapas.';
    caixa.hidden = false;
  }

  function mostrarMapa(praia) {
    var caixa = el('mapa');
    if (!caixa) return;
    if (MAPA) { desenharMapa(praia); return; }
    /* Só se pede o ficheiro quando alguém escolhe uma praia: a página de
       entrada não paga os 78 KB de quem nunca chega aqui. */
    carregarMapa().then(function () {
      if (MAPA && praiaActual === praia) desenharMapa(praia);
    });
  }

  /* A troca do código do Google não depende da lista de praias para nada, e
     estava presa ao mesmo .then: se o praias.json falhasse — deploy a meio,
     cache a devolver 404 em HTML, rede fraca — o código OAuth expirava sem ser
     trocado e a entrada falhava por uma razão sem relação nenhuma. */
  var regresso = C.tratarRegresso()
    .catch(function () {
      estado.textContent = 'Não conseguimos concluir a entrada. Tenta outra vez.';
      return null;
    })
    .then(function () { desenharConta(); });

  /* Absoluto, e é a única linha do ficheiro com um pedido relativo. De uma
     página em /praia/x/ isto ia pedir /praia/x/data/praias.json e dar 404 —
     com a agravante de o GitHub Pages devolver HTML no 404, portanto o erro
     que aparecia era um SyntaxError de JSON, que não diz nada a ninguém.
     Tem de continuar igual, letra a letra, ao href do <link rel=preload>. */
  fetch('/data/praias.json')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      PRAIAS = d;
      desenharFavoritos();
      /* A troca do código já foi feita no arranque, fora desta cadeia. Aqui só
         falta juntar as listas, que precisa das praias carregadas.
         Fica ANTES da escolha da praia e nunca depois de um `return`: é o que
         sincroniza os favoritos com a conta, e não tem nada que ver com qual é
         a praia que se vai abrir. */
      regresso
        .then(function () { return sincronizar().catch(function () { }); })
        .then(function () { coresDosFavoritos(); });

      /* Um atalho carregado antes de a lista ter chegado fica à espera aqui, e
         ganha a quem for: foi um clique de agora, contra uma praia guardada da
         última visita. */
      var p = null;
      if (atalhoPendente) { p = porId(atalhoPendente); atalhoPendente = null; }
      if (p) { escolher(p); return; }

      /* Volta à última praia: quem abre isto abre-o quase sempre para a mesma. */
      p = doEndereco((location.hash || '').slice(1));
      if (!p) {
        try {
          var g = JSON.parse(localStorage.getItem('pm:praia') || '{}');
          p = (g.id && PRAIAS.find(function (x) { return F.id(x) === g.id; }))
              || (g.n && PRAIAS.find(function (x) { return x.n === g.n; })) || null;
        } catch (e) { }
      }
      if (p) escolher(p, true);
    })
    .catch(function () {
      estado.textContent = 'Não conseguimos carregar a lista de praias.';
    });
})();
