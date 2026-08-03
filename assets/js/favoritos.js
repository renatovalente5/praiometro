/* =============================================================
   FAVORITOS
   =============================================================
   Guarda a lista das praias que a pessoa marcou. Hoje só no dispositivo,
   em localStorage. Quando houver login, é aqui — e só aqui — que entra a
   sincronização: o resto da aplicação fala com este módulo e não sabe
   se por baixo está o localStorage ou uma conta.

   A CHAVE NÃO É O NOME. Há 50 nomes repetidos no ficheiro de praias, e
   quatro «Praia dos Pescadores» diferentes: marcar uma marcaria as quatro.
   A chave é a coordenada, com 4 casas decimais (~11 m), que é única.
   ============================================================= */
(function () {
  'use strict';

  /* O prefixo não é decoração. Todos os sites em renatovalente5.github.io
     partilham UMA origem e portanto UM localStorage: uma chave chamada
     «favoritos» seria lida e escrita por todos os outros projectos que lá
     vivem. Enquanto não houver domínio próprio, é isto que os separa. */
  var CHAVE = 'pm:favoritos';
  /* 15 e não mais: as cores da tira vêm todas num pedido só, e cada praia
     custa ~8 KB nesse pedido. Com 30 eram 246 KB medidos, para uma tira que
     ninguém percorre até ao fim. */
  var LIMITE = 15;
  var itens = [];           /* [{id, n}] pela ordem em que foram marcados */
  var ouvintes = [];

  function id(p) {
    if (!p) return '';
    return Number(p.la).toFixed(4) + ',' + Number(p.lo).toFixed(4);
  }

  function ler() {
    try {
      var v = JSON.parse(localStorage.getItem(CHAVE) || '[]');
      if (!Array.isArray(v)) return [];
      /* Só entra o que tem forma de favorito: um localStorage estragado por
         outra coisa qualquer não pode deitar a página abaixo. */
      return v.filter(function (x) { return x && typeof x.id === 'string' && x.id.indexOf(',') > 0; })
              .slice(0, LIMITE);
    } catch (e) { return []; }
  }

  function gravar(mudanca) {
    try { localStorage.setItem(CHAVE, JSON.stringify(itens)); } catch (e) { }
    ouvintes.forEach(function (f) { try { f(itens, mudanca || null); } catch (e) { } });
  }

  itens = ler();

  /* Outro separador do mesmo browser mexeu nos favoritos: acompanha. */
  window.addEventListener('storage', function (e) {
    if (e.key !== CHAVE) return;
    itens = ler();
    ouvintes.forEach(function (f) { try { f(itens); } catch (e) { } });
  });

  window.Favoritos = {
    id: id,

    lista: function () { return itens.slice(); },

    tem: function (p) {
      var k = id(p);
      return itens.some(function (x) { return x.id === k; });
    },

    limite: LIMITE,

    /* 'marcada', 'removida' ou 'cheio'. Deitar fora a praia mais antiga sem
       dizer nada seria pior do que recusar: a pessoa carregava na estrela e
       perdia outra sem perceber porquê. */
    alternar: function (p) {
      var k = id(p);
      var i = -1;
      itens.forEach(function (x, n) { if (x.id === k) i = n; });
      if (i >= 0) { itens.splice(i, 1); gravar({ tipo: 'removida', id: k, n: p.n }); return 'removida'; }
      if (itens.length >= LIMITE) return 'cheio';
      itens.unshift({ id: k, n: p.n, t: new Date().getTime() });
      gravar({ tipo: 'marcada', id: k, n: p.n });
      return 'marcada';
    },

    /* Ao entrar na conta, junta o que está na conta com o que já está neste
       aparelho. Duas coisas que a primeira versão fazia mal:

       1. Fundia sobre uma cópia da lista tirada ANTES do pedido à rede. Uma
          estrela marcada durante esses centenas de milissegundos era escrita
          por cima e desaparecia. Agora funde sobre `itens`, lido agora.
       2. Cortava aos 15 com os locais sempre à frente, e as praias da conta
          evaporavam-se do ecrã sem aviso. Agora a ordem é a data em que foram
          marcadas — as 15 mais recentes ficam, venham de onde vierem — e quem
          fica de fora é devolvido para se poder dizer à pessoa. */
    fundir: function (novos) {
      var vistos = {}, todos = [];
      function juntar(x) {
        if (!x || !x.id || vistos[x.id]) return;
        vistos[x.id] = 1;
        todos.push({ id: x.id, n: x.n, t: x.t || 0 });
      }
      itens.forEach(juntar);
      (novos || []).forEach(juntar);
      todos.sort(function (a, b) { return b.t - a.t; });
      var deixados = todos.slice(LIMITE);
      itens = todos.slice(0, LIMITE);
      gravar();
      return { lista: itens.slice(), deixados: deixados };
    },

    /* A união acima só está certa UMA vez por conta e por aparelho: na primeira
       sincronização, para não perder o que já estava marcado sem conta. Depois
       disso é ela que impedia as remoções de viajar — apagar uma praia no
       computador não a tirava do telemóvel, porque a união do telemóvel voltava
       a juntar a cópia local, e o passo de subida ainda a punha outra vez na
       conta, desfazendo a remoção nos dois lados.

       A partir da segunda vez, quem manda é a conta. `protegidos` são os ids
       que ainda estão na fila para subir: esses não estão na conta por ainda
       não terem chegado lá, e não podem ser confundidos com apagados. */
    substituir: function (novos, protegidos) {
      var manter = {};
      (protegidos || []).forEach(function (id) { manter[id] = 1; });
      var vistos = {}, todos = [];
      function juntar(x) {
        if (!x || !x.id || vistos[x.id]) return;
        vistos[x.id] = 1;
        todos.push({ id: x.id, n: x.n, t: x.t || 0 });
      }
      (novos || []).forEach(juntar);
      itens.forEach(function (x) { if (manter[x.id]) juntar(x); });
      todos.sort(function (a, b) { return b.t - a.t; });
      var deixados = todos.slice(LIMITE);
      itens = todos.slice(0, LIMITE);
      gravar();
      return { lista: itens.slice(), deixados: deixados };
    },

    /* Guardar e repor a lista que existia antes de entrar na conta. Sem isto,
       num computador partilhado, as praias da conta de quem entrou ficavam no
       aparelho depois de terminar sessão — e a pessoa seguinte carregava-as
       para a conta dela sem nunca as ter marcado. */
    guardarAntesDeEntrar: function () {
      try { localStorage.setItem(CHAVE + '-antes', JSON.stringify(itens)); } catch (e) { }
    },
    reporDeAntesDeEntrar: function () {
      var antes = null;
      try {
        antes = JSON.parse(localStorage.getItem(CHAVE + '-antes') || 'null');
        localStorage.removeItem(CHAVE + '-antes');
      } catch (e) { }
      if (!Array.isArray(antes)) return false;
      itens = antes.filter(function (x) { return x && typeof x.id === 'string'; }).slice(0, LIMITE);
      gravar();
      return true;
    },

    /* Resolve os favoritos guardados contra a lista de praias carregada.
       Primeiro pela coordenada; se o ficheiro de praias for regenerado e o
       ponto tiver andado uns metros, tenta pelo nome antes de desistir.

       O recurso ao nome SÓ vale quando o nome é único. Há quatro «Praia dos
       Pescadores»: apanhar a primeira da lista trocaria calmamente a praia
       guardada em Aljezur por outra a 300 km, e a pessoa só descobria pela
       previsão errada. Se o nome for ambíguo, tenta-se a mais próxima da
       coordenada antiga; se nem isso, desiste-se. */
    resolver: function (praias) {
      var porId = {};
      praias.forEach(function (p) { porId[id(p)] = p; });
      var vivos = [], resolvidas = [];
      itens.forEach(function (f) {
        var p = porId[f.id];
        if (!p) {
          var iguais = praias.filter(function (x) { return x.n === f.n; });
          if (iguais.length === 1) p = iguais[0];
          else if (iguais.length > 1) {
            var c = f.id.split(','), la = parseFloat(c[0]), lo = parseFloat(c[1]);
            if (!isNaN(la) && !isNaN(lo)) {
              var melhor = null, dist = Infinity;
              iguais.forEach(function (x) {
                var d = Math.abs(x.la - la) + Math.abs(x.lo - lo);
                if (d < dist) { dist = d; melhor = x; }
              });
              /* ~0,05° é uns 5 km: mais do que isso já não é «a mesma praia
                 que andou uns metros», é outra praia com o mesmo nome. */
              if (melhor && dist < 0.05) p = melhor;
            }
          }
        }
        if (!p) return;                       /* desapareceu: cai fora em silêncio */
        if (id(p) !== f.id) f.id = id(p);     /* recolocada: actualiza a chave */
        vivos.push(f);
        resolvidas.push(p);
      });
      if (vivos.length !== itens.length) { itens = vivos; gravar(); }
      return resolvidas;
    },

    aoMudar: function (f) { ouvintes.push(f); }
  };
})();
