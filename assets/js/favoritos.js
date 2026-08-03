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

  var CHAVE = 'favoritos';
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
      itens.unshift({ id: k, n: p.n });
      gravar({ tipo: 'marcada', id: k, n: p.n });
      return 'marcada';
    },

    /* Depois de entrar na conta: a lista passa a ser a união do que estava
       neste aparelho com o que estava guardado na conta. Não se apaga nada
       de um lado nem do outro — quem marcou uma praia no telemóvel não a quer
       perder por ter aberto o site no computador. */
    substituir: function (arr) {
      var vistos = {};
      itens = arr.filter(function (x) {
        if (!x || !x.id || vistos[x.id]) return false;
        vistos[x.id] = 1; return true;
      }).slice(0, LIMITE);
      gravar();
      return itens.slice();
    },

    /* Resolve os favoritos guardados contra a lista de praias carregada.
       Primeiro pela coordenada; se o ficheiro de praias for regenerado e o
       ponto tiver andado uns metros, tenta pelo nome antes de desistir. */
    resolver: function (praias) {
      var porId = {};
      praias.forEach(function (p) { porId[id(p)] = p; });
      var vivos = [], resolvidas = [];
      itens.forEach(function (f) {
        var p = porId[f.id];
        if (!p) p = praias.find(function (x) { return x.n === f.n; });
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
