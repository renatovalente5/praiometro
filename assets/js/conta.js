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

  /* Enquanto o cliente OAuth do Google não existir, carregar em «Entrar» daria
     uma página de erro do Supabase. Passa a true quando estiver criado. */
  var GOOGLE_PRONTO = false;

  var CHAVE_SESSAO = 'sessao';
  var CHAVE_VERIF = 'pkce';
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
        if (!r.ok) throw new Error(d.error_description || d.msg || d.error || ('HTTP ' + r.status));
        return d;
      });
    });
  }

  /* Devolve um token válido, renovando-o se estiver a expirar. */
  function token() {
    if (!sessao) return Promise.reject(new Error('sem sessão'));
    if (new Date().getTime() < sessao.expira) return Promise.resolve(sessao.access_token);
    return pedirToken({ refresh_token: sessao.refresh_token }, 'refresh_token')
      .then(function (d) {
        var s = daResposta(d);
        /* A resposta da renovação nem sempre traz o utilizador outra vez. */
        if (s && !s.id) { s.id = sessao.id; s.email = sessao.email; s.nome = sessao.nome; s.foto = sessao.foto; }
        guardarSessao(s);
        return s.access_token;
      })
      .catch(function (e) { guardarSessao(null); throw e; });
  }

  /* ------------------------------------------------------------ entrar */

  function entrar() {
    var verificador = aleatorio(48);
    try { sessionStorage.setItem(CHAVE_VERIF, verificador); } catch (e) { }
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
      return r.status === 204 ? null : r.json();
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
  function apagarNuvem(praiaId) {
    return pedir('favoritos?praia_id=eq.' + encodeURIComponent(praiaId), { method: 'DELETE' });
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
    disponivel: function () { return GOOGLE_PRONTO; },
    activa: function () { return !!sessao; },
    quem: function () { return sessao ? { id: sessao.id, email: sessao.email, nome: sessao.nome, foto: sessao.foto } : null; },
    entrar: entrar,
    sair: sair,
    tratarRegresso: tratarRegresso,
    lerNuvem: lerNuvem,
    juntarNuvem: juntarNuvem,
    apagarNuvem: apagarNuvem,
    apagarConta: apagarConta,
    aoMudar: function (f) { ouvintes.push(f); }
  };
})();
