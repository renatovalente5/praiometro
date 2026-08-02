/* =============================================================
   VAI DAR PRAIA? — aplicação
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

  var PRAIAS = [];
  var praiaActual = null;
  var dias = [];          /* dados agregados por dia */
  var veredictos = [];    /* classificação por dia */
  var diaEscolhido = 0;

  /* Praias conhecidas para arrancar, para o ecrã inicial não estar vazio.
     Escolhidas por serem conhecidas de norte a sul, não por serem as melhores. */
  var ATALHOS = ['Praia de Carcavelos', 'Praia da Rocha', 'Praia de Matosinhos',
                 'Praia da Nazaré', 'Praia de Odeceixe-Mar', 'Praia do Guincho'];

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
    verde:    { hoje: 'Vai dar praia',  outro: 'Vai dar praia' },
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

  function mostrarSugestoes(arr, titulo) {
    if (!arr.length) { esconderSugestoes(); return; }
    lista.innerHTML = (titulo ? '<li class="sugestao sugestao--titulo" aria-disabled="true"><span class="sugestao__meta">' + esc(titulo) + '</span></li>' : '') +
      arr.map(function (p, i) {
        return '<li role="option" id="sug-' + i + '" aria-selected="false">' +
          '<button class="sugestao" type="button" data-i="' + PRAIAS.indexOf(p) + '">' +
          '<span class="sugestao__nome">' + esc(p.n) + '</span>' +
          (p.m ? '' : '<span class="sugestao__rio">rio</span>') +
          '<span class="sugestao__meta">' + esc(p.c ? p.c + ' · ' + p.r : p.r) +
            (p.d != null ? ' · ' + num(p.d) + ' km' : '') + '</span>' +
          '</button></li>';
      }).join('');
    lista.hidden = false;
    caixa.setAttribute('aria-expanded', 'true');
    marcado = -1;
  }
  function esconderSugestoes() {
    lista.hidden = true; lista.innerHTML = '';
    caixa.setAttribute('aria-expanded', 'false');
    marcado = -1;
  }

  caixa.addEventListener('input', function () {
    var r = procurar(caixa.value);
    if (caixa.value.trim().length >= 2 && !r.length) {
      lista.innerHTML = '<li class="sugestao" aria-disabled="true">Não encontrámos nenhuma praia com esse nome.</li>';
      lista.hidden = false;
    } else {
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
        o.parentElement.setAttribute('aria-selected', i === marcado ? 'true' : 'false');
      });
      caixa.setAttribute('aria-activedescendant', 'sug-' + marcado);
      opcoes[marcado].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (marcado >= 0 && opcoes[marcado]) { e.preventDefault(); opcoes[marcado].click(); }
      else if (opcoes.length) { e.preventDefault(); opcoes[0].click(); }
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

  el('perto').addEventListener('click', function () {
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

  function urlTempo(p) {
    return 'https://api.open-meteo.com/v1/forecast'
      + '?latitude=' + p.la + '&longitude=' + p.lo
      + '&hourly=temperature_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,'
      + 'wind_direction_10m,cloud_cover,precipitation,precipitation_probability,uv_index,weather_code'
      + '&daily=weather_code,precipitation_sum'
      + '&timezone=auto&forecast_days=6'
      + '&models=' + MODELOS.join(',');
  }

  function urlMar(p) {
    return 'https://marine-api.open-meteo.com/v1/marine'
      + '?latitude=' + p.la + '&longitude=' + p.lo
      + '&hourly=sea_surface_temperature,wave_height'
      + '&timezone=auto&forecast_days=6';
  }

  function escolher(praia) {
    praiaActual = praia;
    esconderSugestoes();
    caixa.value = praia.n;
    caixa.blur();
    estado.textContent = 'A ver como está…';
    el('vazio').hidden = true;

    var pedidos = [fetch(urlTempo(praia)).then(function (r) {
      if (!r.ok) throw new Error('tempo ' + r.status);
      return r.json();
    })];
    /* A API marinha só responde em pontos com mar. Numa praia de rio o pedido
       nem se faz; noutras pode falhar, e isso não pode deitar a página abaixo. */
    pedidos.push(praia.m
      ? fetch(urlMar(praia)).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      : Promise.resolve(null));

    Promise.all(pedidos).then(function (r) {
      dias = M.agregar(M.consenso(r[0], MODELOS), r[1], praia);
      veredictos = dias.map(M.classificarDia);
      diaEscolhido = 0;
      estado.textContent = '';
      desenhar();
      try {
        localStorage.setItem('praia', JSON.stringify({ n: praia.n }));
        history.replaceState(null, '', '#' + encodeURIComponent(praia.n));
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
  }

  function desenharDias() {
    el('dias').innerHTML = dias.map(function (d, i) {
      var v = veredictos[i];
      return '<button class="dia dia--' + v.cor + '" type="button" role="tab" data-i="' + i + '"' +
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

  el('dias').addEventListener('click', function (e) {
    var b = e.target.closest('.dia');
    if (!b) return;
    diaEscolhido = +b.dataset.i;
    desenhar();
  });

  function desenharVeredicto() {
    var d = dias[diaEscolhido], v = veredictos[diaEscolhido];
    doc.body.setAttribute('data-cor', v.cor);
    el('v-praia').textContent = praiaActual.n;
    el('v-praia').setAttribute('title', praiaActual.c ? praiaActual.c + ', ' + praiaActual.r : praiaActual.r);
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
    /* Um veto de segurança não é um aviso amarelo: muda de cor e de tom. */
    av.classList.toggle('veredicto__aviso--perigo', !!v.perigo);
    if (v.perigo) { av.hidden = false; av.textContent = 'Aviso de segurança: ' + v.vetos[0] + '. ' + avisos.join(' · '); }
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

    el('detalhe-corpo').innerHTML = linhas + '<p class="detalhe__rodape">' + esc(rodape) + '</p>';
  }

  /* ------------------------------------------------------------ arranque */

  function atalhos() {
    var caixaA = el('atalhos');
    caixaA.innerHTML = ATALHOS.map(function (nome) {
      var p = PRAIAS.find(function (x) { return x.n === nome && x.m === 1; });
      return p ? '<button class="atalho" type="button" data-i="' + PRAIAS.indexOf(p) + '">' + esc(p.n.replace(/^Praia (da |de |do |dos )?/, '')) + '</button>' : '';
    }).join('');
    caixaA.addEventListener('click', function (e) {
      var b = e.target.closest('.atalho');
      if (b) escolher(PRAIAS[+b.dataset.i]);
    });
  }

  fetch('data/praias.json')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      PRAIAS = d;
      atalhos();
      /* Volta à última praia: quem abre isto abre-o quase sempre para a mesma. */
      var quero = decodeURIComponent((location.hash || '').slice(1));
      if (!quero) {
        try { quero = (JSON.parse(localStorage.getItem('praia') || '{}')).n || ''; } catch (e) { }
      }
      if (quero) {
        var p = PRAIAS.find(function (x) { return x.n === quero; });
        if (p) escolher(p);
      }
    })
    .catch(function () {
      estado.textContent = 'Não conseguimos carregar a lista de praias.';
    });
})();
