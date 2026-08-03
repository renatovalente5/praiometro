/* =============================================================
   CONTA — entrar com Google e sincronizar as praias guardadas
   =============================================================
   Fala directamente com o Supabase por HTTP, sem SDK: o oficial traz
   realtime, storage e functions que aqui não se usam, são ~120 KB e mais
   um pedido a um CDN, num site que não tem dependências externas nenhumas.

   O fluxo é PKCE, não implícito: o código que volta do Google só serve
   acompanhado de um segredo que nunca sai deste browser, e o token de
   acesso nunca aparece na barra de endereço nem no histórico.

   A chave que está aqui em baixo é PÚBLICA por desenho — é a «anon», e
   sozinha não dá acesso a nada: quem manda são as políticas de Row Level
   Security na base de dados, que só deixam cada pessoa ver e mexer nas
   suas linhas. Verificado: sem sessão, ler devolve vazio e escrever dá 401.
   ============================================================= */
(function () {
  'use strict';

  var URL_BASE = 'https://nfcqzkhivbsqwiyopjca.supabase.co';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mY3F6a2hpdmJzcXdpeW9wamNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MDU0NTQsImV4cCI6MjEwMTI4MTQ1NH0.8TvdKiBuSHanwLRnirEPu7hDqBRKG_2fnrtHCXebHv8';

  /* O cliente OAuth existe e a cadeia foi verificada até ao ecrã do Google.
     Nota: enquanto a aplicação estiver em «modo de testes» no Google Cloud, só
     entram os emails da lista de utilizadores de teste — para toda a gente
     poder entrar é preciso carregar em «Publicar aplicação». */
  var GOOGLE_PRONTO = true;

  /* Prefixadas: renatovalente5.github.io é uma origem só, partilhada com todos
     os outros sites que lá vivem, e portanto um localStorage só. */
  var CHAVE_SESSAO = 'pm:sessao';
  var CHAVE_VERIF = 'pm:pkce';
  var sessao = null;
  var ouvintes = [];

  /* ------------------------------------------------------------ ajudas */

  function b64url(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function aleatorio(n) {
    var a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return b64url(a);
  }
  function sha256(s) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(b64url);
  }

  function guardarSessao(s) {
    sessao = s;
    try {
      if (s) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s));
      else localStorage.removeItem(CHAVE_SESSAO);
    } catch (e) { }
    ouvintes.forEach(function (f) { try { f(s); } catch (e) { } });
  }

  function lerSessao() {
    try {
      var s = JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null');
      return s && s.access_token && s.refresh_token ? s : null;
    } catch (e) { return null; }
  }

  function daResposta(d) {
    if (!d || !d.access_token) return null;
    var u = d.user || {};
    return {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      /* Renova-se um minuto antes de expirar, para nunca se usar um token
         que morre a meio do pedido. */
      expira: new Date().getTime() + ((d.expires_in || 3600) - 60) * 1000,
      id: u.id,
      email: u.email,
      nome: (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || u.email || '',
      foto: (u.user_metadata && (u.user_metadata.avatar_url || u.user_metadata.picture)) || ''
    };
  }

  function pedirToken(corpo, tipo) {
    return fetch(URL_BASE + '/auth/v1/token?grant_type=' + tipo, {
      method: 'POST',
      headers: { 'apikey': ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) {
          var e = new Error(d.error_description || d.msg || d.error || ('HTTP ' + r.status));
          e.estado = r.status;   /* quem apanha precisa de saber se foi recusa ou rede */
          throw e;
        }
        return d;
      });
    });
  }

  /* Devolve um token válido, renovando-o se estiver a expirar. */
  function token() {
    if (!sessao) return Promise.reject(new Error('sem sessão'));
    if (new Date().getTime() < sessao.expira) return Promise.resolve(sessao.access_token);

    function renovar(refresh) {
      return pedirToken({ refresh_token: refresh }, 'refresh_token').then(function (d) {
        var s = daResposta(d);
        /* A resposta da renovação nem sempre traz o utilizador outra vez. */
        if (s && !s.id) { s.id = sessao.id; s.email = sessao.email; s.nome = sessao.nome; s.foto = sessao.foto; }
        guardarSessao(s);
        return s.access_token;
      });
    }

    return renovar(sessao.refresh_token).catch(function (e) {
      /* Outro separador pode ter renovado entretanto e rodado o token: a nossa
         cópia em memória ficou velha, mas a boa está no localStorage. */
      var guardada = lerSessao();
      if (guardada && sessao && guardada.refresh_token !== sessao.refresh_token) {
        sessao = guardada;
        return renovar(guardada.refresh_token).catch(function (e2) { return desistir(e2); });
      }
      return desistir(e);
    });

    /* Só se apaga a sessão quando o servidor DIZ que o token não presta. Uma
       falha de rede — wifi de hotel, avião, túnel — não pode obrigar a pessoa
       a entrar outra vez: o refresh token dela continua bom. */
    function desistir(e) {
      if (e && e.estado >= 400 && e.estado < 500) guardarSessao(null);
      throw e;
    }
  }

  /* ------------------------------------------------------------ entrar */

  function entrar() {
    /* crypto.subtle só existe em contexto seguro. Em http:// que não seja
       localhost — testar no telemóvel por http://192.168.1.x, um portal
       cativo — a chamada atirava de forma SÍNCRONA, escapava ao .catch de quem
       chamou, e o botão ficava morto sem explicação. */
    if (!(window.crypto && crypto.subtle && window.TextEncoder)) {
      return Promise.reject(new Error('contexto-inseguro'));
    }
    var verificador = aleatorio(48);
    /* Sem o verificador não há regresso possível: mais vale não sair da página
       do que mandar a pessoa ao Google para voltar a um erro. Acontece no iOS
       com «Bloquear todos os cookies» e em webviews de aplicações. */
    try {
      sessionStorage.setItem(CHAVE_VERIF, verificador);
      if (sessionStorage.getItem(CHAVE_VERIF) !== verificador) throw new Error('não gravou');
    } catch (e) {
      return Promise.reject(new Error('armazenamento-bloqueado'));
    }
    return sha256(verificador).then(function (desafio) {
      var volta = location.origin + location.pathname;
      location.href = URL_BASE + '/auth/v1/authorize'
        + '?provider=google'
        + '&redirect_to=' + encodeURIComponent(volta)
        + '&code_challenge=' + desafio
        + '&code_challenge_method=s256';
    });
  }

  function sair() {
    var t = sessao && sessao.access_token;
    /* Sair devolve o aparelho ao estado de antes de entrar, e a lista que volta
       é a local: se entrar outra vez, tem de haver fusão de novo. */
    try { localStorage.removeItem(CHAVE_FUNDIDO); } catch (e) { }
    guardarSessao(null);
    if (!t) return Promise.resolve();
    return fetch(URL_BASE + '/auth/v1/logout?scope=local', {
      method: 'POST',
      headers: { 'apikey': ANON, 'Authorization': 'Bearer ' + t }
    }).catch(function () { });
  }

  /* Volta do Google: troca o código pelo par de tokens e limpa o endereço. */
  function tratarRegresso() {
    var p = new URLSearchParams(location.search);
    var codigo = p.get('code'), erro = p.get('error_description') || p.get('error');
    if (!codigo && !erro) return Promise.resolve(null);

    var limpo = location.pathname + (location.hash || '');
    history.replaceState(null, '', limpo);
    if (erro) return Promise.reject(new Error(erro));

    var verificador = '';
    try { verificador = sessionStorage.getItem(CHAVE_VERIF) || ''; } catch (e) { }
    try { sessionStorage.removeItem(CHAVE_VERIF); } catch (e) { }
    if (!verificador) return Promise.reject(new Error('sessão de entrada perdida'));

    return pedirToken({ auth_code: codigo, code_verifier: verificador }, 'pkce')
      .then(function (d) {
        var s = daResposta(d);
        guardarSessao(s);
        return s;
      });
  }

  /* ---------------------------------------------------------- favoritos */

  function pedir(caminho, opcoes) {
    return token().then(function (t) {
      var o = opcoes || {};
      o.headers = Object.assign({
        'apikey': ANON,
        'Authorization': 'Bearer ' + t,
        'Content-Type': 'application/json'
      }, o.headers || {});
      return fetch(URL_BASE + '/rest/v1/' + caminho, o);
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(r.status + ' ' + t); });
      /* Ler o texto e só depois decidir, em vez de perguntar pelo status. O
         `return=minimal` do juntarNuvem responde 201 com corpo VAZIO, não 204:
         a versão anterior tratava só o 204, caía no r.json() e lançava
         «Unexpected end of JSON input» em TODAS as marcações bem-sucedidas.

         O estrago não era só um erro na consola. O catch punha um `add` na fila
         de pendentes, o drenar() repetia-o em cada arranque, e se a pessoa
         entretanto removesse a praia, esse `add` esquecido voltava a metê-la na
         conta — uma praia removida a reaparecer, sem nada à vista que o
         explicasse. Medido: INSERT devolve 201 com content-length 0. */
      return r.text().then(function (t) { return t ? JSON.parse(t) : null; });
    });
  }

  function lerNuvem() {
    return pedir('favoritos?select=praia_id,nome,criado_em&order=criado_em.desc');
  }
  function juntarNuvem(itens) {
    if (!itens.length) return Promise.resolve(null);
    return pedir('favoritos?on_conflict=user_id,praia_id', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(itens.map(function (f) {
        return { user_id: sessao.id, praia_id: f.id, nome: f.n };
      }))
    });
  }
  /* Um DELETE que não encontra nada responde 204, exactamente como um que
     apagou — e o 204 aqui passava por sucesso. Era invisível e tinha
     consequência: nada ia para a fila, e a praia que a pessoa tirou voltava na
     fusão seguinte, porque continuava na conta.

     `return=representation` obriga a resposta a trazer as linhas apagadas, e
     zero linhas passa a ser erro — que é o que manda isto para a fila.

     O VALOR VAI SEM ASPAS. Já foi com aspas duplas, por se supor que a vírgula
     das coordenadas era carácter reservado e precisava delas. Medido contra a
     base de dados real, com sessão de utilizador: o PostgREST NÃO as retira,
     procura um valor que inclui os caracteres `"` e não encontra linha nenhuma
     — 200 com `[]`, ou seja nunca apagava nada. Sem aspas apaga e devolve a
     linha. Para o operador `eq` a vírgula não precisa de tratamento. */
  function apagarNuvem(praiaId) {
    return pedir('favoritos?praia_id=eq.' + encodeURIComponent(praiaId), {
      method: 'DELETE',
      headers: { 'Prefer': 'return=representation' }
    }).then(function (linhas) {
      if (!linhas || !linhas.length) throw new Error('DELETE sem efeito: 0 linhas apagadas');
      return linhas;
    });
  }

  /* ------------------------------------------------ operações por cumprir */
  /* Uma escrita na nuvem que falhe não pode simplesmente evaporar-se. No caso
     de uma remoção é visível: a praia que a pessoa tirou volta na fusão
     seguinte, porque continua na conta. Fica aqui à espera da próxima
     oportunidade — e a fusão sabe ignorar o que está marcado para apagar. */
  var CHAVE_PEND = 'pm:pendentes';

  function pendentes() {
    try {
      var v = JSON.parse(localStorage.getItem(CHAVE_PEND) || '[]');
      return Array.isArray(v) ? v.filter(function (x) { return x && x.id && x.op; }) : [];
    } catch (e) { return []; }
  }
  function gravarPend(v) {
    try { localStorage.setItem(CHAVE_PEND, JSON.stringify(v.slice(-50))); } catch (e) { }
  }
  /* A última acção sobre uma praia manda: marcar e desmarcar sem rede não pode
     deixar as duas na fila a lutar uma com a outra. */
  function adiar(op) {
    gravarPend(pendentes().filter(function (x) { return x.id !== op.id; }).concat([op]));
  }
  /* Uma remoção cuja praia já não está na conta está cumprida, venha isso do
     DELETE ter funcionado ou de a linha nunca lá ter estado. Sem isto, agora
     que zero linhas conta como erro, essa remoção ficava na fila a ser tentada
     em cada arranque para sempre. */
  function esquecerRemocoes(idsCumpridos) {
    var fora = {};
    (idsCumpridos || []).forEach(function (i) { fora[i] = 1; });
    if (!Object.keys(fora).length) return;
    gravarPend(pendentes().filter(function (x) { return !(x.op === 'del' && fora[x.id]); }));
  }
  /* ------------------------------------------- primeira fusão por aparelho */
  /* A união entre a lista do aparelho e a da conta serve para não perder o que
     alguém marcou antes de entrar. Mas só pode acontecer UMA vez por conta e
     por aparelho: se acontecesse em todas as sincronizações, uma praia apagada
     noutro aparelho voltava sempre a ser juntada aqui. Guarda-se o id da conta
     e não um simples «sim», para que entrar com outra conta volte a fundir. */
  var CHAVE_FUNDIDO = 'pm:fundido';
  function jaFundiu() {
    if (!sessao || !sessao.id) return false;
    try { return localStorage.getItem(CHAVE_FUNDIDO) === sessao.id; } catch (e) { return false; }
  }
  function marcarFundido() {
    if (!sessao || !sessao.id) return;
    try { localStorage.setItem(CHAVE_FUNDIDO, sessao.id); } catch (e) { }
  }

  function drenar() {
    var v = pendentes();
    if (!v.length || !sessao) return Promise.resolve([]);
    return Promise.all(v.map(function (o) {
      var p = o.op === 'add' ? juntarNuvem([{ id: o.id, n: o.n }]) : apagarNuvem(o.id);
      return p.then(function () { return null; }).catch(function () { return o; });
    })).then(function (r) {
      var falhados = r.filter(Boolean);
      gravarPend(falhados);
      return falhados;
    });
  }
  /* Apagar mesmo, incluindo o email e o ID do Google — o art. 17.º do RGPD dá
     direito a isso, e apagar só os favoritos não cumpriria. A linha de
     auth.users exige a chave de serviço, que nunca pode estar num browser,
     por isso quem apaga é uma função no servidor. Ela não aceita nenhum id
     vindo daqui: usa o do token, e os favoritos vão atrás por ON DELETE
     CASCADE (verificado: 2 linhas -> 0). */
  function apagarConta() {
    return token().then(function (t) {
      return fetch(URL_BASE + '/functions/v1/apagar-conta', {
        method: 'POST',
        headers: { 'apikey': ANON, 'Authorization': 'Bearer ' + t }
      });
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return sair();
    });
  }

  /* ------------------------------------------------------------ público */

  sessao = lerSessao();

  window.Conta = {
    /* Não basta o cliente OAuth existir: sem contexto seguro o PKCE não é
       sequer possível, e mais vale não mostrar o botão do que mostrá-lo morto. */
    disponivel: function () {
      return GOOGLE_PRONTO && !!(window.crypto && crypto.subtle && window.TextEncoder);
    },
    activa: function () { return !!sessao; },
    quem: function () { return sessao ? { id: sessao.id, email: sessao.email, nome: sessao.nome, foto: sessao.foto } : null; },
    entrar: entrar,
    sair: sair,
    tratarRegresso: tratarRegresso,
    lerNuvem: lerNuvem,
    juntarNuvem: juntarNuvem,
    apagarNuvem: apagarNuvem,
    pendentes: pendentes,
    adiar: adiar,
    esquecerRemocoes: esquecerRemocoes,
    jaFundiu: jaFundiu,
    marcarFundido: marcarFundido,
    drenar: drenar,
    apagarConta: apagarConta,
    aoMudar: function (f) { ouvintes.push(f); }
  };
})();
