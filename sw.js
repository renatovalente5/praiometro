/* O SERVICE WORKER. Existe por uma razão concreta: quem está na areia, com uma
   barra de rede, tem de conseguir abrir isto e ver a previsão que já tinha.

   A REGRA QUE GOVERNA TUDO O QUE ESTÁ AQUI: NUNCA se serve uma PREVISÃO velha
   sem se dizer que é velha. Um site de praia que mostra o sol de ontem por
   baixo de chuva é pior do que um site que não abre. Por isso este ficheiro
   trata de DUAS coisas e mais nenhuma:

     · o ESQUELETO — o HTML, o CSS, o JavaScript, os ícones e as listas de
       praias, que mudam quando eu publico e não de hora a hora;
     · e mais NADA. Os pedidos à Open-Meteo e ao Supabase passam por aqui sem
       serem tocados, como se este ficheiro não existisse. A previsão já tem a
       sua própria cache de 30 minutos no sessionStorage, escrita no app.js,
       que sabe dizer a que horas foi buscada.

   A VERSÃO é escrita pelo _build/gerar.js a partir do conteúdo dos ficheiros.
   Um número à mão aqui era a armadilha clássica: no dia em que alguém mudasse
   o CSS e se esquecesse de o subir, metade das pessoas ficava com o site
   antigo para sempre, e sem erro nenhum à vista. */
'use strict';

const VERSAO = '__VERSAO__';
const CACHE = 'praiometro-' + VERSAO;

/* O que é preciso para o site abrir com a rede desligada. As páginas de praia
   e a metodologia NÃO estão aqui de propósito: são 8 ficheiros grandes que
   ninguém precisa na areia, e enchiam a cache de quem só quer ver se hoje dá. */
const ESQUELETO = [
  '/',
  '/assets/css/estilo.css',
  '/assets/css/texto.css',
  '/assets/js/modelo.js',
  '/assets/js/app.js',
  '/assets/js/favoritos.js',
  '/assets/js/conta.js',
  '/data/praias.json',
  '/manifest.webmanifest',
  '/assets/img/icon-192.png',
  '/assets/img/icon-512.png',
  '/assets/img/favicon.svg',
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      /* Um a um e sem rebentar: `addAll` desiste do lote inteiro se UM
         ficheiro falhar, e aí não fica cache nenhuma — o pior dos mundos,
         porque não há erro e não há offline. */
      .then(function (c) {
        return Promise.all(ESQUELETO.map(function (u) {
          return c.add(u).catch(function () { });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ns) {
        return Promise.all(ns.map(function (n) {
          return n !== CACHE && n.indexOf('praiometro-') === 0 ? caches.delete(n) : null;
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  /* TUDO o que não é deste domínio passa como se este ficheiro não existisse:
     a Open-Meteo, o Supabase, o que vier. Guardar uma resposta de previsão
     aqui seria servir o tempo de ontem sem ninguém dar por isso. */
  if (url.origin !== self.location.origin) return;

  /* A NAVEGAÇÃO vai primeiro à rede: quem tem rede recebe sempre a versão
     nova. A cache é a rede de segurança, não o caminho normal. */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(function (r) {
          const copia = r.clone();
          caches.open(CACHE).then(function (c) { c.put('/', copia); });
          return r;
        })
        .catch(function () {
          return caches.match('/').then(function (r) { return r || Response.error(); });
        })
    );
    return;
  }

  /* Os ficheiros do esqueleto: responde-se da cache e vai-se buscar a versão
     nova por trás, para a visita seguinte. Com a versão da cache atada ao
     conteúdo, «a visita seguinte» é no máximo uma. */
  e.respondWith(
    caches.match(req).then(function (guardado) {
      const rede = fetch(req).then(function (r) {
        if (r && r.ok) {
          const copia = r.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copia); });
        }
        return r;
      }).catch(function () { return guardado; });
      return guardado || rede;
    })
  );
});
