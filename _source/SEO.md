<!-- Roteiro de SEO do Praiómetro.

     Produzido a 5 de Agosto de 2026 a partir de investigação em doze
     frentes (procura de palavras-chave em PT, análise das SERPs e da
     concorrência, auditoria técnica, política de conteúdo em escala do
     Google, e inventário de fontes de dados), com duas verificações
     adversariais — uma de risco de penalização e outra de engenharia.
     Onde a verificação contradisse a estratégia, manda a verificação.

     Vive em _source/ e por isso não é servido: o Jekyll ignora as
     pastas que começam por underscore. É documentação interna, como o
     MODELO.md e o MONETIZACAO.md — que estavam publicados por engano
     até ao dia em que este ficheiro foi escrito. -->

# ROTEIRO SEO DO PRAIÓMETRO — VERSÃO FINAL EXECUTÁVEL
**5 de Agosto de 2026 · `/Users/renatovalente/Websites/Praiometro` → https://praiometro.pt**

Esta versão incorpora as duas críticas. Onde o roteiro anterior e as críticas divergiram, **manda a crítica**. Os pontos revertidos estão marcados com ⚠️ REVERTIDO e a razão.

---

## 1. DIAGNÓSTICO — porque é que o Praiómetro hoje não pode rankear (8 linhas)

1. **Só existem 2 URLs indexáveis** (`/` e `/privacidade.html`); as 996 praias vivem em fragmentos `#Nome`, que o Google nunca indexa como páginas. Cauda longa indexável = zero.
2. **Não há `robots.txt`, `sitemap.xml`, nem um único `rel=canonical`** — o site não declara nada sobre si próprio.
3. **`og:image` aponta para `renatovalente5.github.io`**, domínio antigo; toda a partilha social parte ou passa por redirect que os crawlers do WhatsApp/LinkedIn não seguem.
4. **`/MODELO.md` e `/MONETIZACAO.md` devolvem 200** (verificado: `.md` sem front matter é copiado tal e qual pelo Jekyll) — documentos internos publicados e indexáveis.
5. **O `<main>` tem ~59 palavras**; o único texto substantivo (230 palavras) está dentro de um `<details>` colapsado dentro do `<footer>`.
6. **Zero dados estruturados, zero navegação interna** — a homepage tem 2 links internos, ambos para `privacidade.html`, e nenhum `<nav>`.
7. **O conteúdo é 100% client-side** e o `app.js` rebenta com `TypeError` se faltar um único dos 40 `id` que exige — ou seja, **hoje é tecnicamente impossível gerar uma página de praia que funcione**.
8. **`fetch('data/praias.json')` é relativo** (`app.js:898`): qualquer página fora da raiz não carrega a lista.

---

## 2. VAGA 0 — HIGIENE (dias 1-2, ~6 horas)

### Ordem obrigatória do dia 1

**Passo 0 (fora do repositório, e é o que ninguém se lembra depois):**
Supabase → Authentication → URL Configuration:
- Site URL: `https://praiometro.pt`
- Redirect URLs: acrescentar `https://praiometro.pt/**` (com dois asteriscos — `*` só cobre um segmento e as páginas de praia têm dois).

Sem isto, quem carregar em «Entrar» numa página de praia é despejado na homepage silenciosamente (`conta.js:157` envia `location.origin + location.pathname`, que o Supabase descarta se não estiver na lista branca). O Google Cloud **não** é afectado — o `redirect_uri` registado lá é o do Supabase.

**Passo 0b:** Search Console, propriedade de **domínio** por DNS TXT. Bing Webmaster Tools por importação do GSC.

---

### 0.1 — `_config.yml` (parar a fuga de documentos internos)

Criar `/Users/renatovalente/Websites/Praiometro/_config.yml`:

```yaml
# O `exclude` do Jekyll SUBSTITUI a lista por omissão, não a acrescenta.
# Por isso os defaults (Gemfile, node_modules, vendor) têm de ser repetidos aqui.
# `_source` já está fora por começar por `_` — fica listado só para documentar a intenção.
exclude:
  - README.md
  - MODELO.md
  - MONETIZACAO.md
  - LICENSE
  - .gitignore
  - _source
  - _build
  - _site
  - medicoes
  - Gemfile
  - Gemfile.lock
  - node_modules
  - vendor
```

**NÃO criar `.nojekyll`.** É o Jekyll que hoje esconde `/_source/` (filtragem de prefixo `_`, mecanismo separado do `exclude`); `.nojekyll` exporia `cdp.py`, `verificar.py` e 300 KB de JSON em bruto.

**A pasta do gerador chama-se `_build/`, não `build/`** ⚠️ CORRIGIDO — assim fica protegida por construção (prefixo `_`), tal como `_source`, em vez de depender de uma linha de configuração que alguém pode apagar. Se um dia alguém correr `npm i` numa pasta `build/`, o `node_modules` inteiro seria publicado.

**Verificação:**
```bash
for u in MODELO.md MONETIZACAO.md README.md LICENSE _source/verificar.py; do
  curl -s -o /dev/null -w "$u %{http_code}\n" "https://praiometro.pt/$u"
done
```
Os cinco têm de dar 404. Hoje os três primeiros dão **200**.

---

### 0.2 — `robots.txt` ⚠️ SIMPLIFICADO

Criar `/Users/renatovalente/Websites/Praiometro/robots.txt` com **exactamente isto**:

```
# Nenhum bot é bloqueado, incluindo os de IA. Decisão deliberada: a licença
# não-comercial da Open-Meteo impede publicidade, logo o site não perde nada
# com zero-click e ganha tudo com citação. Ver /metodologia/.

User-agent: *
Allow: /

Sitemap: https://praiometro.pt/sitemap.xml
```

⚠️ **REVERTIDO: os blocos nomeados `User-agent: GPTBot` / `ClaudeBot` / `Google-Extended` saem.** Razão: (i) `Allow: /` é o comportamento por omissão — os blocos são inertes; (ii) em robots.txt um agente segue **apenas o grupo mais específico que lhe corresponde**, portanto qualquer `Disallow` futuro no grupo `*` deixaria silenciosamente de se aplicar a esses seis agentes, e quem o escrever daqui a um ano não vai saber; (iii) `Google-Extended` não é um crawler, é um token de controlo de utilização — não faz pedidos. A decisão editorial fica no comentário.

**Nunca `Disallow: /data/`** — o `praias.json` é necessário para o Googlebot renderizar a homepage.

---

### 0.3 — `sitemap.xml` inicial

Criar `/Users/renatovalente/Websites/Praiometro/sitemap.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://praiometro.pt/</loc>
    <lastmod>2026-08-05</lastmod>
  </url>
  <url>
    <loc>https://praiometro.pt/privacidade.html</loc>
    <lastmod>2026-08-05</lastmod>
  </url>
</urlset>
```

Sem `changefreq` nem `priority` (ignorados pelo Google desde 2023). **Regra dura do `lastmod`, que fica escrita e não se negoceia:** é a data da última alteração de **conteúdo estável**, nunca a data do build. Se 500 URLs levarem `lastmod` de hoje todos os dias, o Google aprende em duas semanas que o `lastmod` deste site não significa nada — e esse sinal não se recupera.

Submeter no GSC e no Bing.

---

### 0.4 — `index.html`: metas, canonical, Open Graph

Substituir a **linha 6**:
```html
<title>Vale a pena ir à praia hoje? — Praiómetro</title>
```

Substituir a **linha 7**:
```html
<meta name="description" content="Escolhe entre 996 praias de Portugal e vê a nota de hoje e dos próximos 5 dias: vento, sol, calor e temperatura da água num semáforo. Sem termos técnicos." />
```

Substituir o bloco das **linhas 11-16** por:
```html
<link rel="canonical" href="https://praiometro.pt/" />

<meta property="og:type" content="website" />
<meta property="og:locale" content="pt_PT" />
<meta property="og:site_name" content="Praiómetro" />
<meta property="og:url" content="https://praiometro.pt/" />
<meta property="og:title" content="Vale a pena ir à praia hoje? — Praiómetro" />
<meta property="og:description" content="Escolhe uma praia de Portugal e vê logo se vale a pena ir, hoje e nos próximos 5 dias." />
<meta property="og:image" content="https://praiometro.pt/assets/img/og.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Praiómetro — semáforo verde, amarelo e vermelho para saber se vale a pena ir à praia." />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="https://praiometro.pt/assets/img/og.png" />
```

Recomprimir `assets/img/og.png` (182 KB) para <60 KB: `pngquant --quality=70-92 --force --output assets/img/og.png assets/img/og.png`.

---

### 0.5 — Caminhos absolutos (⚠️ este passo é pré-requisito de tudo o resto)

Substituir nas **linhas 18-23** de `index.html`:
```html
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/assets/img/icon-180.png" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="preconnect" href="https://api.open-meteo.com" />
<link rel="dns-prefetch" href="https://marine-api.open-meteo.com" />
<link rel="stylesheet" href="/assets/css/estilo.css" />
<link rel="preload" href="/data/praias.json" as="fetch" crossorigin />
```

⚠️ **REVERTIDO parcialmente:** o roteiro mandava trocar **os dois** `preconnect` por `dns-prefetch`. Mantém-se o `preconnect` para `api.open-meteo.com` — os 5 atalhos existem precisamente para serem clicados e o `#perto` também dispara a API; poupar dois handshakes ociosos ao custo de 200-300 ms na primeira interacção é optimizar a métrica errada num produto cujo valor é a resposta imediata. Só o `marine-api` (que só é usado em praias de mar) desce a `dns-prefetch`.

⚠️ **O `crossorigin` no preload é obrigatório e a razão não é a que o roteiro dava.** `fetch()` usa modo `cors` por omissão; um `<link rel=preload as=fetch>` sem `crossorigin` é `no-cors`; os modos não casam, o preload é descartado e **o ficheiro é descarregado duas vezes**. E o `href` do preload tem de ser byte-a-byte igual ao argumento do `fetch` — daí este passo e o 0.9 terem de ir **no mesmo commit**.

**NÃO usar `<base href="/">`.** É a armadilha que parece elegante: com `<base>`, `href="#resultado"` (linha 26, «Saltar para o resultado») deixa de ser um salto na página e passa a navegar para `/#resultado`. Este site vive de fragmentos internos.

Nas **linhas 87, 233** trocar `href="privacidade.html"` por `href="/privacidade.html"`.
Nas **linhas 237-240**, os `src` passam a `/assets/js/...`.

`privacidade.html`: linha 11 → `/assets/img/favicon.svg`; linha 12 → `/assets/css/estilo.css`; linhas 16 e 106 → `href="/"`. Acrescentar depois da linha 10:
```html
<link rel="canonical" href="https://praiometro.pt/privacidade.html" />
<meta property="og:type" content="article" />
<meta property="og:locale" content="pt_PT" />
<meta property="og:site_name" content="Praiómetro" />
<meta property="og:url" content="https://praiometro.pt/privacidade.html" />
<meta property="og:title" content="Privacidade — Praiómetro" />
<meta property="og:image" content="https://praiometro.pt/assets/img/og.png" />
```

`manifest.webmanifest` — substituir por:
```json
{
  "name": "Praiómetro",
  "short_name": "Praiómetro",
  "description": "Vê se vale a pena ir à praia, hoje e nos próximos 5 dias.",
  "lang": "pt-PT",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#f3f7fa",
  "theme_color": "#0e7490",
  "icons": [
    { "src": "/assets/img/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/assets/img/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

### 0.6 — Mover os dois `<dialog>` para fora do `<header>` — **impacto BAIXO** ⚠️ RECLASSIFICADO

`index.html`: cortar as **linhas 61-113** (o comentário `<!-- ==== PERFIL ==== -->` até `</dialog>` do `confirmar`) e colar imediatamente antes de `</body>` (linha 241).

Seguro: os diálogos são acedidos só por `getElementById` (`app.js:703-737`), o CSS `.painel` não tem selector ancestral, e `showModal()` promove ao top layer independentemente da posição no DOM.

⚠️ **Impacto reclassificado de «alto» para «baixo».** A ordem de headings é sinal residual há anos. Faz-se pelos 15 minutos e pela acessibilidade, não por ranking.

Na **linha 79**: `<h3 class="painel__sub">Praias guardadas</h3>` (havia dois «As tuas praias», nas linhas 79 e 146).

---

### 0.7 — Tirar o conteúdo de dentro do `<footer>` — **impacto BAIXO**, e com resumo REESCRITO ⚠️ CORRIGIDO

Cortar as **linhas 209-228** (`<details class="comofunciona">`) e substituir por uma secção **nova, de ~80 palavras, escrita de raiz** dentro de `<main>`, imediatamente antes de `</main>` (linha 206):

```html
<section class="comofunciona" aria-labelledby="como-t">
  <h2 id="como-t">Como decidimos se vale a pena ir</h2>
  <p>Cada dia leva uma nota de 0 a 100. O vento pesa 34 pontos, o sol 26, o calor
  que se sente 18, a temperatura da água 14 e a chuva 8. Há condições que sozinhas
  chumbam o dia — trovoada, chuva a sério, vento acima de 45 km/h. O vento é a média
  de quatro modelos meteorológicos e mede-se na parte ventosa da tarde, não na média
  do dia inteiro, que esconderia a nortada.</p>
  <p><a href="/metodologia/">Os limiares todos, e o que este modelo não sabe →</a></p>
</section>
```

⚠️ **REVERTIDO: não mover o texto de 230 palavras.** Motivo: a §1.4 promove o mesmo `MODELO.md` a `/metodologia/`. Se o texto longo ficar também na homepage — que tem toda a autoridade do domínio — a homepage rouba à `/metodologia/` exactamente as queries que a `/metodologia/` existe para ganhar («como se calcula se está bom para a praia»). O texto longo é **exclusivo** de `/metodologia/`. Na homepage fica este resumo curto e reescrito.

No rodapé fica só a atribuição de fontes (linhas 230-234, inalteradas salvo o caminho absoluto).

---

### 0.8 — Headings

- Linha 115-120: `<h1>` passa a `Praiómetro <span class="marca__claim">— vale a pena ir à praia hoje?</span></h1>` (manter o `<span class="marca__icone">`).
- Linha 127: `Escolher a praia` → `Escolher uma praia de Portugal`.
- Linha 153: `Previsão` → `Previsão para hoje e para os próximos 5 dias`.

Os `visually-hidden` contam (`estilo.css:82` usa `clip`, não `display:none`); o problema nunca foi serem invisíveis, é serem genéricos.

⚠️ Sobre a `description`: escrever e seguir em frente. **Não medir CTR isoladamente às 3 semanas** — num domínio novo não há dados interpretáveis, e o Google reescreve a maioria das descriptions.

---

### 0.9 — Patch mínimo ao `app.js` (⚠️ P0 — **sem isto nenhuma página de praia funciona**)

**(a) Guardar os `addEventListener` de topo.** Acrescentar junto de `el()`:
```js
function on(id, ev, fn) { var n = el(id); if (n) n.addEventListener(ev, fn); }
```
E substituir os 16 sítios: linhas **176, 190, 218, 230, 398, 405, 554, 588, 641, 668, 703, 708, 711, 714, 723, 726, 727, 731**. (`doc.addEventListener` nas linhas 224, 751, 754 não precisa.)

Hoje, um `id` em falta dá `TypeError: null is not an object` e **nada a seguir corre, incluindo o `fetch` que está no fim do ficheiro** — a página fica com o HTML e mais nada, sem erro visível.

⚠️ **Nota que resolve uma contradição do roteiro:** a alternativa de replicar o esqueleto DOM completo em cada página cairia no próprio teste anti-*scaled content* da §2.4 (os `<dialog>` são texto literal idêntico em 100% das páginas). Guardar é a única saída que não se auto-sabota. Envolver `desenharConta()` em `if (el('conta'))`.

**(b) Linha 898:** `fetch('data/praias.json')` → `fetch('/data/praias.json')`. É a única linha do ficheiro com pedido relativo e a que produz o erro mais confuso.

**(c) Linha 361:** guardar o `replaceState`, manter o `setItem`:
```js
if (!doc.getElementById('pm-praia')) history.replaceState(null, '', '#' + endereco(praia));
```

---

### 0.10 — CLS e atalhos ⚠️ CORRIGIDO (o roteiro tinha um erro de execução)

**Sessão antes do primeiro paint** — script inline síncrono no `<head>`, a seguir ao `<meta charset>`:
```html
<script>try{document.documentElement.dataset.sessao=localStorage.getItem('pm:sessao')?'1':'0'}catch(e){document.documentElement.dataset.sessao='0'}</script>
```
(`pm:sessao` é a chave real, confirmada em `conta.js:31`.) O CSS passa a mostrar o botão certo à primeira, em vez de reservar 38 px e colapsar (`estilo.css:138,140`).

**Os 5 atalhos escritos no HTML** (linha 204), mas ⚠️ **não** como o roteiro dizia: o handler actual faz `escolher(PRAIAS[+b.dataset.i])`, e o índice em `PRAIAS` não existe antes do fetch. Escrever com a chave de coordenada (a mesma de `favoritos.js:28`):
```html
<div class="vazio__sugestoes" id="atalhos">
  <button class="atalho" type="button" data-id="41.1830,-8.7000">Matosinhos</button>
  <button class="atalho" type="button" data-id="40.6400,-8.7500">Barra</button>
  <button class="atalho" type="button" data-id="39.6000,-9.0700">Nazaré</button>
  <button class="atalho" type="button" data-id="38.6800,-9.3300">Carcavelos</button>
  <button class="atalho" type="button" data-id="37.1200,-8.5400">Rocha</button>
</div>
```
(As coordenadas exactas saem de `data/praias.json` com `F.id()`; gerar a linha com um script, não à mão.)
Em `atalhos()` (linha 875): apagar o `innerHTML =`, manter só o `addEventListener`, e trocar o corpo por lookup por `F.id`, com clique pendente:
```js
var pendente = null;
// no handler: var p = PRAIAS && PRAIAS.find(x => F.id(x) === b.dataset.id);
// if (p) escolher(p); else pendente = b.dataset.id;
// e no .then do fetch: if (pendente) { var q = PRAIAS.find(x => F.id(x) === pendente); if (q) escolher(q); }
```

**Contraste:** `.marca__lead` de `#4a6274` para `#2c4453` (3,75:1 → 5,2:1 sobre `--ceu-a`); `padding:.35rem 0` nos links do rodapé.

---

### 0.11 — `404.html`

Criar `/Users/renatovalente/Websites/Praiometro/404.html`, em pt-PT, **com todos os caminhos absolutos** (é servido a partir de qualquer profundidade — um `404.html` com caminhos relativos servido em `/praia/xpto/` fica irrecuperavelmente partido). Conteúdo: `<h1>Não encontrámos essa praia</h1>`, a caixa de procura (markup de `index.html:128-140`), links para `/praias/` e para as 7 regiões. Sem front matter.

**Verificação:** `curl -s -o /dev/null -w "%{http_code}" https://praiometro.pt/naoexiste-xpto` continua **404** (confirmar que não passou a 200).

---

### 0.12 — JSON-LD (orçamentar **20 minutos**, não 1h15) ⚠️ RECLASSIFICADO

No `<head>` de `index.html`:
```html
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
 {"@type":"WebSite","@id":"https://praiometro.pt/#site",
  "url":"https://praiometro.pt/","name":"Praiómetro","alternateName":"Praiometro",
  "inLanguage":"pt-PT","publisher":{"@id":"https://praiometro.pt/#autor"}},
 {"@type":"Person","@id":"https://praiometro.pt/#autor","name":"Renato Valente",
  "sameAs":["https://github.com/renatovalente5"]},
 {"@type":"WebApplication","@id":"https://praiometro.pt/#app",
  "name":"Praiómetro","url":"https://praiometro.pt/",
  "applicationCategory":"WeatherApplication","operatingSystem":"Web",
  "inLanguage":"pt-PT","isAccessibleForFree":true,
  "author":{"@id":"https://praiometro.pt/#autor"},
  "areaServed":{"@type":"Country","name":"Portugal"}}
]}
</script>
```

`Person` e não `Organization` — `privacidade.html:31` diz «a título pessoal, sem fins comerciais»; declarar pessoa colectiva seria inventar. ⚠️ **`offers.price: 0` sai** (o rich result de Software App exige `aggregateRating`, que aqui não pode existir). ⚠️ **Expectativa corrigida: nenhum destes tipos produz rich result.** Só o `BreadcrumbList` (Vaga 2) é elegível. Faz-se porque é barato e alimenta grafos de conhecimento e LLMs — não por SERP.

`README.md`: trocar `renatovalente5.github.io/praiometro` por `https://praiometro.pt`; corrigir «999 praias, 785 mar, 214 rio» para **996 / 761 / 235**. Preencher *Website* e *Topics* no GitHub.

### ⚠️ 0.13 — REVERTIDO POR COMPLETO: **não tocar em `renatovalente5/vai-dar-praia`**

O roteiro mandava arquivá-lo. **Não existe como repositório separado — é este, renomeado.** Verificado:
```
github.com/renatovalente5/vai-dar-praia    → 301 → github.com/renatovalente5/praiometro
renatovalente5.github.io/vai-dar-praia/    → 404
git remote -v                              → github.com/renatovalente5/praiometro.git
```
Executar o item à letra **arquivaria o repositório de produção** — congelando o repo, desactivando Actions (o que mata a Vaga 1 inteira) e podendo quebrar o Pages. Não fazer nada: o 301 permanente resolve-se sozinho no índice. Se o resultado #2 persistir a 3 meses, pedir remoção no GSC.

### 0.14 — Testar empiricamente a barra final antes de congelar D1

Publicar `/teste-barra/index.html` com uma linha de texto e medir:
```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://praiometro.pt/teste-barra
curl -s -o /dev/null -w "%{http_code}\n" https://praiometro.pt/teste-barra/
```
Verificado que este host é permissivo: `/privacidade` devolve **200**, não 301 (fallback extensionless sem redirect). Independentemente do resultado, **canonical auto-referencial absoluto em todas as páginas é obrigatório** — se o Pages devolver 200 nas duas variantes, é a única defesa. Apagar a pasta de teste a seguir.

---

## 3. VAGA 1 — FUNDAÇÃO INDEXÁVEL (semanas 1-4)

### 3.1 — Arquitectura de URLs. Congelada.

```
/                                 app (homepage)
/metodologia/                     como o modelo decide
/nortada/                         pilar editorial (absorve «praias abrigadas»)
/praias/                          índice nacional
/praias/<regiao>/                 7 hubs de região
/praias/<regiao>/<concelho>/      hubs de concelho (só se ≥3 praias)
/praia/<slug>/                    páginas de praia — PLANAS, sem hierarquia
/listas/<slug>/                   ≤4 URLs (era 6)
/mapa/                            o país hoje (absorve «melhores de hoje»)
/dados/                           dataset + DOI
/estudos/<slug>/                  4 estudos
/privacidade.html                 fica como está
```

**Praias planas, hubs hierárquicos.** O concelho vem de point-in-polygon e vai ser corrigido; se estiver no caminho, corrigir geografia parte URLs. A hierarquia comunica-se por breadcrumb e ligações internas.

**Regra em falta no roteiro, agora explícita:** um concelho com **<3 praias no total não gera hub** — geraria uma página com conteúdo idêntico à única página de praia (mesma nota, mesma climatologia, mesma prosa derivada). Nesses casos a página de praia canoniza a intenção «praias de X» com uma secção própria.

### 3.2 — Cadeado de slugs ⚠️ CORRIGIDO (a função do roteiro não produz slugs)

O `normalizar()` de `app.js:72` **não pode ser usado como slugificador nem alterado**. Medido:
```
"Praia do Furadouro - Norte"      → "praia do furadouro   norte"   (3 espaços)
"Praia dos Pescadores (Ericeira)" → "praia dos pescadores  ericeira "
```
Substitui cada não-alfanumérico por **um espaço**, não colapsa runs, não faz `trim()`. E não se pode corrigir: o campo `b` do `praias.json` foi produzido com ele e a pesquisa casa contra `p.b` — mexer parte a procura em silêncio para os 996 registos.

Criar `/Users/renatovalente/Websites/Praiometro/_build/lib/slug.js`:
```js
'use strict';
// EMBRULHA normalizar(), nunca a substitui. Ver app.js:68-74.
function normalizar(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
}
function slugificar(s) { return normalizar(s).trim().replace(/\s+/g, '-'); }
module.exports = { normalizar: normalizar, slugificar: slugificar };
```
Confirmado com esta versão: **927 slugs únicos, 51 colisões, 120 registos envolvidos**, zero slugs vazios, o mais comprido com 51 caracteres (`praia-fluvial-da-nossa-senhora-da-ribeira-de-parada`).

`data/slugs.json` commitado, chave `la.toFixed(4)+','+lo.toFixed(4)` (a mesma de `favoritos.js:28`). **Um slug emitido nunca muda.** Desambiguação: `<slug>-<concelho>`.

⚠️ **Consequência que o roteiro não tirava: o cadeado é sobre `la`/`lo`, não só sobre o slug.** Se o slug fica trancado à coordenada, a coordenada passa a ser tão imutável quanto ele — uma actualização do OSM que mova uma praia 30 m parte simultaneamente o favorito local, o favorito na nuvem (`praia_id` no Supabase) e a chave do `slugs.json`. `_source/testar-slugs.js` tem de falhar se **um slug OU uma coordenada existente** mudar.

⚠️ **O slug entra em `data/praias.json` como campo `s`.** Razão: o redirect de fragmentos legados (`#Praia%20do%20Furadouro`, com `@la,lo` colado quando o nome se repete — `app.js:862-866`) **não pode ser um script inline**, porque um script inline não tem o mapa nome→slug. Com o campo `s`, o redirect faz-se dentro do `.then` que já existe. Custo: 104 → ~130 KB. O `slugs.json` continua a existir como cadeado revisto em PR, mas é *input* do gerador, não *runtime*.

### 3.3 — Pipeline de build (sair do Jekyll) ⚠️ com a razão forte que faltava

Criar `.github/workflows/publicar.yml` (Actions como fonte do Pages, `upload-pages-artifact` + `deploy-pages`, cron `0 5 * * *`) e `_build/gerar.js` (Node 18+, `fetch` global, **zero dependências**).

⚠️ **A razão mais forte para Actions, que o roteiro não escrevia:** se o pré-render diário for **commitado**, são ~500 ficheiros de ~35 KB reescritos por dia. Mesmo com compressão delta, são dezenas de MB de objectos novos por mês num histórico que nunca encolhe — **passa o 1 GB recomendado em poucos meses e não há `git gc` que resolva**, só reescrita de histórico. Publicação **tem de ser por artefacto**, `_site/` no `.gitignore`, **zero HTML gerado commitado**.

⚠️ **Ordem inegociável, e porquê:** `_config.yml` (Vaga 0) → Actions + `_site/` → **só depois a primeira página gerada**. Com Jekyll ligado, cada `.html` do repositório passa pelo Liquid; um único `{{` num nome de praia vindo do OSM rebenta o build inteiro do Pages e o site deixa de actualizar **sem erro visível** a não ser um email. Hoje não há `{{` em ficheiro nenhum — o roteiro manda emitir JSON-LD e `<script type="application/json">`, que é exactamente onde isso aparece.

**Armadilha dos 60 dias:** o GitHub desactiva workflows agendados em repositórios públicos ao fim de 60 dias sem **commits** (deploys por artefacto não criam commits; tags, issues e merges não contam). `.github/workflows/manter-vivo.yml` com `git commit --allow-empty` mensal e **PAT** — o `GITHUB_TOKEN` não reactiva.

**Teste de fumo no fim da Action:** 404 em `/MONETIZACAO.md`, `/_source/verificar.py`, `/README.md`; 200 em `/robots.txt`, `/sitemap.xml`, `/assets/css/estilo.css` (com `content-type: text/css`).

### 3.4 — Concelho para as 996 (bloqueador)

CAOP da DGT (CC BY 4.0) → GeoJSON leve commitado em `_build/dados/`; point-in-polygon em ~40 linhas de Node puro. 482 praias herdam da APA por junção espacial a **≤300 m com confirmação de nome** (a 686 praias a <1 km só 397 passam o teste de nome — travar em 300 m e deixar sem perfil o resto, em vez de atribuir a praia errada). Saída: `_build/dados/concelhos.json`. **Verificação: 996/996 com concelho e distrito.**

### 3.5 — As páginas de fundação

| URL | O que leva |
|---|---|
| `/metodologia/` | O `MODELO.md` promovido a página, com âncoras estáveis: `#pesos` (34/26/18/14/8), `#vento` (os dois limiares independentes que caem na mesma banda — 7 m/s da definição operacional de nortada e ≈19 km/h da saltação de areia; **é o parágrafo mais citável do site**), `#agua` (escala atlântica), `#janela` (11h-19h, percentil 75), `#direccao` (média vectorial), `#vetos`, `#limitacoes` («O que este modelo NÃO sabe», sem cortes — não é segurança balnear; a bandeira do nadador-salvador manda sempre), `#calibracao`, `#climatologia` (a nota do ERA5, ver 4.4). Nova pasta + `assets/css/texto.css` (~120 linhas de tipografia de artigo; o `estilo.css` é CSS de aplicação). **1,5 dias.** |
| `/nortada/` | 1200-1600 palavras à mão, zero IA: o que é em consequência prática, porque existe (afloramento, anticiclone dos Açores, porque a água está a 18 °C em Agosto), **a que horas costuma acalmar** com perfil horário por região, onde entra de frente e onde entra de lado, e — ⚠️ **absorvendo `/listas/praias-abrigadas-da-nortada/`** — uma secção com âncora `#abrigadas` com o top de praias abrigadas por região. 6 links vivos para páginas de praia. Fontes nomeadas: ECMWF, ICON, GFS, UKMO, ERA5, OpenStreetMap. Não perseguir «nortada» seca (as related queries são «nortada restaurante», «cerveja nortada»); indexar para as formulações de pergunta. **1,5 dias.** |
| `/praias/` + 7 hubs | Cada hub abre com **os números climatológicos daquela região** — deixa de ser índice e passa a conteúdo. O hub do Centro é caso especial: **118 praias de rio contra 78 de mar**, é a porta do cluster fluvial. `<nav>` novo no cabeçalho da homepage (hoje: 2 links internos, ambos para privacidade, zero `<nav>`). **1 dia.** |

### 3.6 — Sitemaps segmentados

`sitemap.xml` (índice) + `sitemap-nucleo.xml` + um `sitemap-praias-N.xml` **por vaga de publicação** — é a única forma de ver a taxa de indexação de cada vaga isoladamente, e essa taxa é o portão de tudo.

### 3.7 — Ficheiros a criar na Vaga 1

```
.github/workflows/publicar.yml
.github/workflows/manter-vivo.yml
_build/gerar.js
_build/lib/slug.js
_build/lib/html.js               esc(), envolver(head, corpo)
_build/lib/jsonld.js             Beach + WebPage + BreadcrumbList
_build/lib/celulas.js            grelha 4 km, representante por célula
_build/templates/metodologia.js
_build/templates/nortada.js
_build/templates/regiao.js
_build/templates/indice.js
_build/dados/concelhos.geojson   CAOP simplificada (commitada)
_build/dados/concelhos.json      derivado (commitado)
_build/validar.js
data/slugs.json                  CADEADO
assets/css/texto.css
_source/testar-slugs.js          slugs E coordenadas
metodologia/  nortada/  praias/  (gerados para _site/, não commitados)
```

`_site/` acrescentado ao `.gitignore`. `_source/osm-praias.json` **removido do `.gitignore` e commitado** (258 KB, 1046 elementos; vem do OSM sob ODbL, com a atribuição que já existe) — é o input de metade do conteúdo único do plano e existe hoje só num disco.

O `pm.js` é a concatenação de `modelo.js + favoritos.js + conta.js + app.js`, **nesta ordem, escrita à mão no gerador com um comentário a dizer porquê** — `app.js:16` faz `var M = window.Modelo;`, e um `glob` ordenado alfabeticamente daria `app, conta, favoritos, modelo` e partia tudo em silêncio.

Reutilizar o `modelo.js` sem o reescrever: `global.window = global; require('./assets/js/modelo.js')`. **Nunca fazer o mesmo com o `app.js`** — acede a `document` no topo.

**PORTÃO 0:** as ~13 URLs indexadas em ≤5 semanas (⚠️ não 3 — domínio novo). Se a homepage e a `/metodologia/` não indexarem, há problema técnico e **não se publica mais nada** até estar resolvido.

---

## 4. VAGA 2 — CAUDA LONGA (mês 2 a mês 9)

### 4.1 — Regra Tier A ⚠️ REESCRITA (a do roteiro produzia doorways)

⚠️ **A regra antiga (`≥2 de 5 critérios`) tinha um buraco:** (c) perfil APA e (d) Wikidata são atributos de **notoriedade**, não de **distinção de dados**. Seis praias contíguas na Costa da Caparica podem ter todas (c) e (d) → seis Tier A, todas na mesma célula de 4 km, com **a mesma previsão, a mesma climatologia e a mesma orientação**. Seis URLs, um conteúdo — a definição literal de doorway.

**Regra nova, mecânica:**
1. Cada praia cai numa célula de ~4 km. Medido: **465 células para 996 praias**.
2. **Uma célula tem exactamente um representante**, escolhido por: perfil APA a ≤300 m > `wikidata`/`wikipedia` no OSM > mais tags no OSM. O representante é Tier A.
3. **Excepção única, que promove uma segunda praia da mesma célula:** orientação de costa >45° distinta da do representante (com alongamento PCA fiável). Aí o conteúdo é mesmo diferente.
4. Praias fluviais têm célula própria de facto e são Tier A por direito.
5. **Todas as outras são Tier B**: âncora com `id` próprio na página do concelho.

Tecto derivado dos dados, não negociado: **~465-520**, sujeito ao corte da §4.7.

### 4.2 — A asserção anti-*scaled content* ⚠️ SUBSTITUÍDA

⚠️ **A defesa antiga media a coisa errada.** A política do Google (`developers.google.com/search/docs/essentials/spam-policies`) define scaled content abuse por *«little to no value to users»* e doorway por páginas *«created to rank for specific, similar search queries»*. **Em lado nenhum fala de unicidade textual.** Um verificador de frases repetidas não avalia nada do que a política avalia — e cria pressão de engenharia para *sinonimizar* texto de template até passar, o que é, essa sim, uma descrição de scaled content abuse.

**A asserção real, em `_build/validar.js`, que falha o build:**
- Cada página contém **≥3 numerais derivados exclusivamente dessa praia** (climatologia da célula própria, orientação PCA própria, distâncias próprias às vizinhas). Se uma praia partilha célula e não tem orientação fiável, **não tem 3 numerais próprios e por definição não é Tier A**.
- `<main>` com ≥250 palavras, das quais ≥120 de climatologia.
- Todo o JSON-LD parseia e todos os `@id` resolvem.
- Nenhuma página órfã.
- O hash de frases repetidas **mantém-se, mas como higiene de template, e contando só dentro de `<main>`** — nunca o chrome (cabeçalho, diálogos, rodapé), que é literalmente idêntico em 100% das páginas por construção.

### 4.3 — Orientação da costa por PCA (1 dia)

Alterar uma palavra em `_source/overpass.txt`: `out center tags` → `out geom`. PCA sobre o polígono → eixo e normal; desambiguar o lado do mar pela API de elevação da Open-Meteo (mar = 0.0) ou pelas ways `natural=coastline`. Guardar em `_build/dados/orientacao.json` **com o alongamento (√λ1/λ2) como indicador de confiança** — praia comprida = eixo fiável; enseada redonda = eixo sem significado, e nesses casos **não se publica a afirmação**.

Apaga uma limitação que o `MODELO.md:250` confessa em texto. É o único item que melhora o modelo e produz conteúdo único ao mesmo tempo.

**Verificação:** Mareta a sul, Carcavelos a sul, Furadouro e Amado a oeste, Guincho a NW.

### 4.4 — Climatologia pré-computada ⚠️ com o orçamento corrigido

`_build/clima-recolher.js` → `clima-adaptar.js` → `clima-calcular.js`, **reutilizando `assets/js/modelo.js` tal como está**. Nunca reescrever a lógica: se os números do estudo divergirem dos do site, o estudo deixa de valer nada.

⚠️ **Orçamento corrigido — o roteiro subestimava ~3×.** A Open-Meteo não conta pedidos HTTP, conta **peso**: *«Requests for data covering more than 10 weather variables or extending over a period of more than 2 weeks for a single location are considered multiple API calls»*. Cada pedido mensal (~31 dias) pesa ~2,2. Conta real: 258 células archive × 10 anos × 5 meses ≈ **28.000 chamadas contadas**, mais ~18.000 das 165 células marine = **~45.000**. A 10.000/dia (5.000/hora, 600/min) são **5 a 7 noites, não duas** — e com um retry passa o limite, apanha 429 a meio e **corrompe o dataset**.

**Obrigatório:** contabilidade de peso no recolector, checkpoint em disco, retoma idempotente. E **o email à Open-Meteo antes de arrancar, não depois** — recolha em lote por GitHub Action é exactamente o caso que eles querem ver perguntado.

**Decisão metodológica a escrever antes do código:** o ERA5 não tem `precipitation_probability`, que é o que alimenta os 8 pontos de chuva (`modelo.js:93,506`). Na climatologia a chuva é pontuada por acumulado real dentro da janela; o veto de ≥2 mm mantém-se. **Publicar esta nota em `/metodologia/#climatologia` é obrigatório** — é a diferença entre um estudo e um número inventado.

**Verificação:** correr duas vezes e obter `md5` idêntico.

### 4.5 — Template da página de praia (mar)

Ordem obrigatória do HTML servido — o que está em cima é o que é extraído para snippets e AI Overviews:

1. Breadcrumb visível + `<h1>` com o nome da praia + lead com 3 factos verificáveis (tipo, concelho, orientação, superfície).
2. **Veredicto pré-renderizado no build**, com carimbo visível `<time datetime="…">` e `#v-fresco` que o JS preenche com «actualizado agora».
3. **Tabela real dos 6 dias** com `<caption>` e `<th scope>`; o JS esconde-a (`hidden`) e monta a tira interactiva por cima. Sem JS a página continua a responder à pergunta. *(É a melhor decisão técnica do plano; não mexer.)*
4. Números de hoje + secção do vento («hoje acalma a partir das 18h: 24 km/h às 15h, 14 às 19h» — serve «a que horas o vento acalma», que ninguém serve, e `modelo.js:483-487` já calcula).
5. Água do mar com a escala atlântica explicada.
6. **«Quando é melhor ir»** — tabela mensal de % de dias verdes/amarelos/vermelhos, com a ressalva da célula de ~11 km.
7. Água balnear e segurança (APA/AEA + link ao SNIRH).
8. **6 praias vizinhas com a nota de hoje ao lado do link** (706 praias têm ≥3 vizinhas a 5 km; `app.js:86` já calcula).
9. `<script type="application/json" id="pm-praia">` para o `app.js` arrancar sem depender do URL.

⚠️ **Correcção do carimbo, que o roteiro não previa:** o build corre às 05:00; `nomeDia()` (`app.js:100`) devolve «Hoje» pelo índice `i === 0`, **não pela data**. Uma página servida às 00:10 diria «Hoje» sobre **ontem** — e mentiria exactamente na frase que o Google extrai para o snippet. O HTML gerado **tem de emitir a data ISO ao lado de cada dia** e o JS tem de comparar com `new Date()` antes de escolher a palavra.

`<title>`: `Praia do Furadouro: tempo, vento e nota de hoje · Praiómetro`. **Nunca «previsão»** — o autocomplete de «previsão praia X» devolve Brasil. `description` com pelo menos um numeral derivado desta praia.
JSON-LD: **`Beach` + `WebPage` + `BreadcrumbList`**, e nada mais. Só o `BreadcrumbList` é elegível a rich result.

⚠️ **Custo de API do pré-render, por medir antes de escrever o código:** o `urlTempo()` (`app.js:276-286`) aceita várias coordenadas por pedido, mas pede **10 variáveis horárias × 6 dias × 4 modelos** por praia — o comentário em `app.js:268` mede 26 KB para **uma** praia. Para ~500 praias/dia isto consome uma fracção significativa do limite gratuito, **antes** de contar as visitas reais, que usam a mesma API a partir do browser de cada visitante. Medir o peso real de um lote (a resposta traz cabeçalhos de quota), decidir o tamanho do lote, espaçar para não bater no limite por minuto.

### 4.6 — Patch ao `app.js` para páginas de praia

- Ler `#pm-praia` e arrancar directamente nessa praia.
- Carregar o `praias.json` em `requestIdleCallback` ⚠️ **com fallback** (Safari só o tem desde a 17 — sem fallback, iOS 16 fica sem procura e sem favoritos, sem erro):
  ```js
  (window.requestIdleCallback || function (f) { return setTimeout(f, 200); })(carregarPraias);
  ```
  Consequência a aceitar: adia também `desenharFavoritos()`, `coresDosFavoritos()` e a fusão de contas, que estão no mesmo `.then` (`app.js:900-918`) — a tira de favoritos aparece sem cores durante uns instantes.
- ⚠️ **Na homepage, `escolher()` navega mesmo para `/praia/<slug>/`.** É uma página estática; o custo é um paint. O roteiro deixava o `history.replaceState` a criar `/#Praia` — uma URL gerada de novo todos os dias, oficialmente legado, que continuaria a ser partilhada e encontrada. Estar-se-ia a criar activamente a duplicação que se quer eliminar. **Zero URLs novas com fragmento.**
- O redirect `#NomeDaPraia` → `/praia/<slug>/` fica só para links antigos, dentro do `.then` do `praias.json`, usando o campo `s`. É `location.replace`, não suja o histórico; há um flash, e é o preço inevitável de fragmentos legados num site estático.

**Regra inegociável: o movimento é sempre fragmento → página canónica, nunca página de praia → homepage.**

### 4.7 — Ordem de publicação e portões

| Vaga | O quê | Quando |
|---|---|---|
| **2a** | **40 praias de mar**, por **procura geográfica, não fama turística**: Viana do Castelo, Aveiro, Leiria, Coimbra, Porto, Braga. O Algarve tem 210 das 996 praias e é o 10.º em procura — espera. **Revisão humana de 100%.** | Out 2026 |
| **2b** | **Template fluvial separado (não um `if`)** + 60 praias de rio do Centro e Norte. Sem secção de água do mar; `<h2>O que este sítio não sabe</h2>` a explicar a repesagem (`MODELO.md:45-65`). Nunca chamar a `marine-api` (`app.js:334` já faz isto certo). Secção «Praias fluviais perto». Concorrência meteorológica **literalmente nula**. | Nov-Dez 2026 |
| **2c/2d** | Cauda Tier A restante, revisão por amostragem de 20%, **mínimo 4 semanas entre vagas**. | Fev-Jun 2027 |
| **2.8** | **Hubs de concelho** (só os com ≥3 praias, ~55-60): tabela ordenável por nota de hoje, uma linha por praia (link se Tier A, âncora se Tier B), prosa curta derivada dos dados. É o único conteúdo do mercado que **ordena** — o IPMA tabela, o BeachCam filma, ninguém ordena. | com 2a |

**PORTÃO 1 ⚠️ RECALIBRADO.** O roteiro exigia ≥80% em 4-6 semanas e mandava parar abaixo de 60% — para um domínio com semanas de idade, zero domínios de referência e 40 páginas programáticas, isso não é expectativa, é desempenho de domínio estabelecido. Pior: o relatório de Indexação do GSC teve atrasos de 2-3 semanas em Junho e Julho de 2026, portanto **a métrica pode nem estar disponível na janela do portão**.

Novo portão, em duas dimensões: **≥60% indexadas às 8 semanas E tendência positiva entre a semana 4 e a 8**, medido por **inspecção directa de URL numa amostra de 10** (dado em tempo real), não pelo relatório agregado. Abaixo disso: parar e diagnosticar.

**PORTÃO 2 — o corte de tecto, decidido agora e não em Março ⚠️ NOVO.**
A meteorologia é a categoria com zero-click mais próximo de 100% (widget nativo antes de qualquer resultado orgânico; AI Overviews cortam o CTR 58-61%). Não vale construir 500 páginas e descobrir isso depois. Em **Dezembro de 2026**, medir no GSC o rácio cliques/impressões das 40 páginas da Vaga 2a:

| Rácio | Decisão, automática |
|---|---|
| **≥1,5%** | Seguir para o tecto pleno (~465 Tier A). |
| **0,5%-1,5%** | Tecto corta para **200**. |
| **<0,5%** | Tecto corta para **120** (só praias com procura de marca própria mensurável) e **todo o esforço restante vai para `/metodologia/`, `/nortada/`, `/dados/`, `/mapa/` e os estudos** — o que não é servido por widget e onde o site tem vantagem defensável. |

As 996 praias continuam todas acessíveis como âncoras nos hubs de concelho em qualquer dos cenários.

### 4.8 — Ligações internas

- Homepage → `<nav>` para `/praias/`, `/metodologia/`, `/nortada/`, `/mapa/`.
- Cada praia → breadcrumb (região, concelho), 6 vizinhas com nota, `/metodologia/`, `/nortada/` quando o vento é factor dominante.
- Cada concelho → todas as suas praias (link ou âncora), a região, os concelhos vizinhos.
- Cada região → concelhos + as 10 praias mais procuradas.
- Nenhuma página de fundação com <3 ligações internas a apontar-lhe (GSC → Links).

### 4.9 — Listas ⚠️ REDUZIDAS a 4 URLs

`/listas/praias-sem-vento-hoje/`, `/listas/praias-fluviais-de-portugal/`, `/listas/onde-e-que-a-agua-esta-mais-quente/`, `/listas/praias-com-bandeira-azul/`.

⚠️ **Eliminadas por canibalização:** `praias-abrigadas-da-nortada` → secção `#abrigadas` de `/nortada/`; `melhores-praias-de-hoje` → secção de `/mapa/`. As três respondiam à mesma intenção e iam diluir-se mutuamente.

⚠️ **Regra nova para todas as páginas de conteúdo volátil (listas e `/mapa/`):** o `<h1>` e os primeiros 150 caracteres **não podem conter o resultado do dia**. Título e lead estáveis («Onde é que não há vento nas praias portuguesas — actualizado a cada 8 horas»), resultado abaixo, com `<time>` visível. Um domínio novo é reindexado de semanas em semanas, não 3× por dia — o snippet indexado estaria sistematicamente errado («Praia X está verde» quando está vermelha), e isso produz pogo-sticking numa página que já tem CTR estruturalmente baixo.

Regionalização por **âncoras dentro da mesma página**, nunca por URL.

---

## 5. VAGA 3 — AUTORIDADE (Set 2026 – Jun 2027, em paralelo com a Vaga 2)

### 5.1 — `/dados/` + DOI no Zenodo (1 dia)

`clima.json` e `praias.csv` com dicionário de campos, licença e citação sugerida; JSON-LD `Dataset`; depósito no Zenodo para obter DOI. Descarga por atributo `download` no `<a>` (`Content-Disposition` é impossível em Pages).

⚠️ **Expectativa corrigida:** o `Dataset` é usado **apenas pelo Dataset Search, não pela Pesquisa Google**. Zero efeito em SERP, zero rich result. Faz-se porque o canal certo é o Dataset Search e porque um DOI é citável por dissertações, jornalistas de dados e câmaras — três fontes de links que não se pedem nem se compram. **Contabilizar em «distribuição académica», não em «SEO».**

**Cuidado legal, a resolver antes de publicar:** o ficheiro é *Derivative Database* do OSM (ODbL) com dados Open-Meteo (CC BY 4.0). O `LICENSE` só diz MIT. **Actualizar `LICENSE` e `README.md`**: código MIT, base de dados ODbL com atribuição dupla. Regra dura escrita no repo: **nada com restrição não-comercial entra num ficheiro publicado** — APA, AEA, DGT e Open-Meteo entram; **o IPMA não** (a restrição recai sobre os dados, não sobre o acesso), fica em runtime no browser.

### 5.2 — `/mapa/` — o país hoje (2 dias)

Regenerado 3×/dia por Action. Mapa de pontos das 996 praias coloridas pelo veredicto, SVG inline gerado, sem dependências. «X% das praias do país estão verdes hoje», top 10 por região, carimbo visível. Uma URL, não 996 — zero risco de doorway. Absorve `/listas/melhores-praias-de-hoje/`.

⚠️ **Correcção obrigatória:** o roteiro dizia que plotar as 996 coordenadas «já desenha a costa portuguesa reconhecível». **Não desenha.** Medido: a longitude vai de **-31,26 (Açores) a -6,35**; o continente ocupa **12,7% da largura** do bounding box. Um plot ingénuo dá três manchas insulares e uma tira vertical de 12% onde está o país. **Três painéis com escalas próprias** (continente + inserto Açores + inserto Madeira), como qualquer carta portuguesa. É meia hora, mas tem de estar no plano — sai como link-bait no dia em que é publicado.

### 5.3 — Os quatro estudos (2 dias cada)

Cada um em `/estudos/<slug>/`, sempre com: número no título (nunca a marca), tabela ordenável em HTML puro, gráfico SVG gerado, CSV do estudo, parágrafo pronto a citar, cartão OG próprio (**estender `_source/og.py`**, que já renderiza 1200×630 em Chrome headless), link a `/metodologia/` no primeiro parágrafo, 5-8 links a páginas de praia, secção «como é que isto foi calculado» com as limitações.

| Estudo | Título de trabalho | Métrica exacta | Gancho | Publicar |
|---|---|---|---|---|
| **E1** | *Quantos dias de praia deu o Verão de 2026* | % verde/amarelo/vermelho por região, Jun-Ago 2026 vs média 2016-2025; «dias que a nortada estragou» = dias com nota ≥70 a 8 km/h de vento mas <70 com o vento real | As redacções fazem balanço do Verão na 1.ª semana de Setembro, todos os anos, e não têm número nenhum para lá pôr | **1-8 Set 2026** |
| **E2** | *A água do mar em Portugal, mês a mês, sem exageros* | SST mediana mensal por praia (165 células); dias/ano ≥20 °C; escala atlântica | Contra-narrativa honesta aos sites que publicam 18,1 °C na versão PT e 19,3 °C na EN da mesma praia no mesmo dia | **Out 2026** |
| **E3** | *O mapa da nortada: as 20 praias mais fustigadas e as 20 mais abrigadas* | % de tardes de Jul+Ago com P75 do vento ≥20 km/h **e** direcção vectorial entre 315° e 45° | A nortada instala-se em Maio e volta a ser assunto. Peça-âncora do ano | **Mai 2027** |
| **E4** | *As praias fluviais portuguesas com mais dias bons* | Nota climatológica de rio (escala de 86 pontos, `MODELO.md:45-47`); % dias verdes Jun-Set; ranking por distrito | Concorrência meteorológica zero; imprensa regional do interior não tem nada disto | **Jun 2027** |

⚠️ **E3 linka `/nortada/` no primeiro parágrafo como destino canónico da intenção**, e passada a janela noticiosa (~6 semanas) o `/nortada/` incorpora as conclusões de E3. Sem isto, E3 — que é a peça com links de imprensa — rankeia e o pilar permanente dilui-se.

⚠️ **Dois estudos cortados:** «calendário do Verão» passa a secção climatológica de cada praia e de cada hub; «a que horas acalma o vento» passa a secção de `/nortada/` e das páginas de praia. Quatro peças grandes > seis médias; um estudo por trimestre é sustentável.

### 5.4 — Distribuição (a máquina de PR)

Ficheiros: `_source/imprensa.csv` (outlet, secção, contacto, região, resultado), `_source/pitches/{nacional,regional,especializado}.md`, `_source/kit/`.

- **Nacional, 1 pitch por estudo, nunca em massa:** Observador/Especiais (já publicaram sobre a formação da nortada e estão em #1 dessa SERP — temos o número que falta ao artigo deles: é o melhor encaixe do país), Público/Interactivos (já fizeram um interactivo de temperatura da água; ângulo = dataset aberto com DOI), SIC/CNN meteorologia, Expresso/Data, Lusa.
- **Regional — é aqui que se ganha volume de domínios e é subestimado.** Cada estudo dá 10-14 versões regionais de graça, porque os dados já estão segmentados. Um pitch com o número da própria região («as praias de Aveiro perderam 31% das tardes de Agosto para a nortada — a Torreira foi a mais fustigada do distrito») tem taxa de aceitação incomparavelmente maior. Alvo realista: 2-4 publicações por vaga.
- **Comunidades:** MeteoPT.com (participar meses antes de partilhar seja o que for), r/portugal e subs regionais (partilhar **o estudo**, com os números no corpo e o link como fonte — autopromoção é banida), grupos de Facebook de praias fluviais e campismo, Show HN apontado ao **repositório e ao `MODELO.md`**, não ao site.
- **Câmaras municipais** dos concelhos da Vaga 2a, quando as páginas tiverem dados da APA: rende links `.pt` institucionais.

**Nunca:** press release de lançamento (o site não é notícia, o dado é), distribuição paga, guest posts em massa, editar a Wikipédia para se auto-linkar.

---

## 6. VAGA 4 — MEDIÇÃO

### 6.1 — O que instalar (tudo gratuito)

| Instrumento | Para quê |
|---|---|
| **Search Console** (propriedade de domínio, DNS TXT) | Indexação, impressões, posições. Base de tudo. |
| **Bing Webmaster Tools** (importa do GSC) | Backlinks e IndexNow. |
| **Ahrefs Webmaster Tools** (gratuito para donos verificados) | Única fonte fiável de domínios de referência sem orçamento. |
| **Zenodo** | DOI do dataset. |
| **`scripts/medir.sh`** com a PageSpeed Insights API v5, semanal → JSON em `medicoes/` | Série de CWV. O CrUX não terá dados durante meses; interessa a **série**, não o número absoluto. |
| **`_source/prompts-citacao.md`** | 10 perguntas fixas, mensais, a ChatGPT/Gemini/Claude/Perplexity; resultado datado e commitado. |

**Analytics: nenhum.** `index.html:86-87` e `privacidade.html` prometem «não há cookies nem publicidade, e não seguimos ninguém entre sites» — é activo de marca e argumento de PR, vale mais do que dados de sessão que não vamos usar. Se um dia forem mesmo precisos, a única opção compatível é Cloudflare Web Analytics, e obriga a pôr a Cloudflare à frente do Pages **e** a actualizar `privacidade.html` antes.

### 6.2 — Asserções automáticas (para as correcções não se desfazerem sozinhas)

Acrescentar a `_source/verificar.py` um bloco que **falha** se:
- `robots.txt` ou `sitemap.xml` não derem 200;
- alguma página não tiver `canonical` absoluto em https;
- `og:image` apontar para fora de `praiometro.pt`;
- `/MODELO.md`, `/MONETIZACAO.md` ou `/README.md` derem 200;
- alguma URL do sitemap der ≠200;
- **o `href` do `<link rel=preload>` não for byte-a-byte igual ao argumento do `fetch` no `app.js`.**

### 6.3 — IndexNow condicional

Passo final da Action, mas **só quando o hash do conteúdo estável muda** (tudo menos os números da previsão e o carimbo). Disparar a cada build = 182.500 notificações/ano de páginas que não mudaram; é ruído e no Bing chega a valer despriorização. Google não suporta; Bing, Yandex, Seznam e Naver sim. Confirmar que o `exclude:` do `_config.yml` não apanha o `<KEY>.txt` da raiz.

### 6.4 — Speculation Rules

Nos hubs e nas páginas de praia:
```html
<script type="speculationrules">
{"prefetch":[{"where":{"href_matches":"/praia/*"},"eagerness":"moderate"}]}
</script>
```
**`prefetch` e não `prerender`, de propósito:** `prerender` executaria o `app.js` e dispararia chamadas à Open-Meteo para páginas que ninguém abriu.

### 6.5 — Limiares de sucesso e de falha

| KPI | Set 26 | Dez 26 | Mar 27 | Jun 27 | Falha se |
|---|---|---|---|---|---|
| URLs indexadas | 13 | 50 | 150 | **250-350** ⚠️ | <100 em Mar |
| Taxa de indexação da última vaga | — | ≥60% | ≥70% | ≥70% | <50% duas vagas seguidas |
| **Domínios de referência** ⚠️ *a métrica que manda* | ≥2 | ≥8 | ≥18 | ≥30 | ≤3 em Dez → **parar de publicar páginas, um mês inteiro em PR** |
| Links de imprensa (nac./reg.) | 0/0 | 1/3 | 2/6 | 4/12 | 0/0 em Dez |
| Impressões orgânicas/mês | >0 | 500 | 3.000 | **15.000** ⚠️ | <1.000 em Mar |
| Rácio cliques/impressões nas páginas de praia | — | **decide o tecto (§4.7)** | — | — | <0,5% → tecto 120 |
| «o que é a nortada» — posição média | — | <30 | <10 | ≤5 | >30 em Mar |
| Share de marca «praiometro» (PT) | — | >0 | >50% | >80% | — |
| PSI mobile / LCP lab / TBT / CLS | ≥98 / <1,2 s / <100 ms / <0,02 | idem | idem | idem | qualquer regressão sem justificação |
| Citações em LLM (10 prompts) | 0 | 1 | 3 | 5 | interpretar **ao trimestre**, nunca ao mês (amostra de 10 tem ruído enorme) |

⚠️ **Os alvos de tráfego foram cortados** (eram 40.000 impressões e 4.000 cliques em Jun 27, o que implicava ~10% de CTR agregado numa categoria com zero-click perto de 100%). **Impressões e citações são as métricas primárias; cliques são secundários.** O alvo de URLs indexadas desceu de 400-500 para 250-350: 85% de taxa de indexação sustentada em páginas programáticas de domínio jovem não é o normal; 60-75% é.

**Alvos de CWV, e é aqui que «topo do sector» se define:** a concorrência entrega surf-forecast 62 KB com TTFB 0,9 s, tempo.pt 32 KB + DoubleClick + GTM + CMP obrigatório, beachcam 75 KB. Nós entregamos 4,6 KB sem banner de cookies e sem anúncios — a restrição não-comercial da Open-Meteo é uma vantagem de CWV que eles **não podem** igualar sem deitar fora o modelo de negócio. **Qualquer PR que acrescente um pedido de rede a uma página de praia tem de justificar o LCP.**

### 6.6 — Poda ⚠️ ADIADA

⚠️ **REVERTIDO: nenhuma poda antes de Setembro de 2027.** O roteiro mandava podar aos 6 meses, o que aplicado às páginas da Vaga 2a (Out 2026) dava **Abril de 2027** — o mês em que o próprio calendário diz que começam a subir a sério, e dois meses antes da única época em que se medem. A poda apagaria a colheita. Com a sazonalidade medida (Ago 72,6 vs Dez 8,3 no Trends), «zero impressões em Fevereiro» é um dado sem significado. Podar só depois de uma época balnear completa.

---

## 7. NÃO FAZER

**Revertido das versões anteriores deste plano:**
- **Arquivar `renatovalente5/vai-dar-praia`** — não existe; é o repo de produção renomeado. Arquivá-lo desactiva as Actions e mata a Vaga 1.
- **Blocos `User-agent:` nomeados no robots.txt** — inertes hoje, armadilha semântica amanhã.
- **Usar `normalizar()` de `app.js:72` como slugificador** — produz espaços a dobrar; e corrigi-la parte a pesquisa dos 996 registos.
- **Verificador de frases repetidas como «defesa» anti-spam** — mede o que a política não avalia e incentiva sinonimização.
- **Tier A por «≥2 de 5 critérios»** — (c) e (d) são notoriedade, não distinção; produzia 6 URLs iguais por célula.
- **Mover as 230 palavras do `<details>` para o `<main>`** — canibalizaria `/metodologia/`. Resumo de 80 palavras reescrito.
- **Trocar os dois `preconnect` por `dns-prefetch`** — só o `marine-api`.
- **`preload` sem `crossorigin` ou com `href` diferente do `fetch`** — descarrega o ficheiro duas vezes.
- **Pasta `build/`** — não começa por `_`, seria publicada com tudo o que tiver dentro.
- **Commitar HTML gerado** — ~500 ficheiros/dia rebentam o limite de 1 GB do repositório em meses.
- **`escolher()` a escrever `#Praia` na homepage** — criaria activamente a duplicação que se quer eliminar.
- **Podar aos 6 meses** — apagaria as páginas no mês em que começam a funcionar.
- **`/listas/praias-abrigadas-da-nortada/` e `/listas/melhores-praias-de-hoje/`** — canibalizavam `/nortada/` e `/mapa/`.
- **Hub de concelho com <3 praias** — duplicaria a única página de praia.
- **Portão de 80% em 4-6 semanas** — abortaria um plano viável por razões de idade de domínio.
- **`<base href="/">`** — parte todos os fragmentos internos, incluindo o «Saltar para o resultado».

**Descartado por política ou por ser inerte:**
`.nojekyll` (exporia `_source/`) · `llms.txt` (a Google confirmou que não suporta nem planeia; 97% dos ficheiros válidos sem um único pedido) · `FAQPage` e `HowTo` (rich results extintos em Maio/Junho de 2026) · `WebSite`+`SearchAction` (retirado em 21/11/2024) · `WeatherForecast` (não existe no schema.org) · `AggregateRating`/`Review` numa praia (violação directa — a nota 0-100 é um cálculo, não uma avaliação) · `LocalBusiness` numa praia (é falso) · `hreflang` (uma língua, uma versão) · `nosnippet`/`max-snippet`/`noarchive` (auto-exclusão da única moeda deste site) · item no Wikidata agora (sem duas fontes independentes é candidato a eliminação, e item eliminado é pior sinal do que item nenhum — reavaliar em Abril) · RSS/Atom (um feed de previsão muda todo sem ter item novo).

**Descartado como alvo de SEO:**
Termos de cabeça («tempo na praia», «previsão praia portugal») — 2-3 dos 10 lugares vão sistematicamente para a Praia de Cabo Verde e a Praia Grande de São Paulo · a palavra «previsão» nos títulos (traz o Brasil) · «estado do mar» como cluster autónomo (o modelo usa ondulação só como veto >2,5 m; atrair quem quer isso gera saltos para trás) · «temperatura da água» como cluster próprio (quatro sites-satélite saturam o top 10 e há um exact-match domain) · webcams e «beachcam» (é o sufixo nº1 colado a nomes de praia e não temos câmaras — não prometer, não insinuar) · listicles turísticos (o praiasdeportugal.com tem 291 praias × 11 idiomas e monetiza; ganha sempre nesse terreno).

**Descartado por licença ou por custo:**
Marés / FES2022 (maior lacuna do mercado, sem solução barata e legal; o IH é produto pago e bloqueia `ClaudeBot` no robots.txt) · fotografias do Wikimedia Commons (20% de cobertura e a `Category:Praia do Tamariz` devolve fotos genéricas de Cascais — páginas desiguais + risco de erro factual) · raspar a ABAAE (sem licença, marca registada; o campo `bandeira_azul` da APA dá o mesmo — resolver antes a discrepância 447 APA vs 396 ABAAE) · raspar o SNIRH (usar como link de saída) · trocar Open-Meteo por IPMA para desbloquear publicidade (mesma restrição não-comercial e ~20 pontos de mar para o país inteiro) · publicidade ou subscrições enquanto a API gratuita for a fonte (se um dia houver monetização, muda-se de licença **primeiro**) · Cloudflare à frente do Pages agora (ganho marginal com 72 KB, dependência nova; revisitar só se o CrUX mostrar problema) · hashes nos nomes dos ficheiros (com `max-age=600` imposto não vale o trabalho — **bundlar vale**, hashear não).

**Por verificar antes de apostar em cima:** (i) se a Open-Meteo considera aceitável a recolha em lote por GitHub Action — um email, **antes** de arrancar a §4.4; (ii) se dados já descarregados sob CC BY 4.0 podem continuar publicados caso o site venha a ter publicidade — é a única via para conteúdo climatológico e receita coexistirem, e não está confirmada.

---

## 8. CALENDÁRIO REALISTA

A curva medida de «tempo praia» em Portugal: Jan 9,0 · Abr 18,2 · Jun 39,2 · Jul 56,6 · **Ago 72,6** · Set 26,3 · Out 12,5 · Dez 8,3. A subida é gradual; a queda é brutal — 64% de Agosto para Setembro, 83% até Outubro.

**A época de 2026 já está perdida para efeitos de SEO.** Uma página publicada hoje não amadurece a tempo. É uma boa notícia disfarçada: dá nove meses para fazer isto com portões a sério em vez de despejar 996 páginas à pressa. **O prazo real é meados de Maio de 2027.**

**A 1 mês (Setembro 2026)**
As ~13 URLs de fundação publicadas; 8-13 indexadas. `/MODELO.md` e `/MONETIZACAO.md` a devolver 404. Zero tráfego. E1 publicado na primeira semana de Setembro, com 1 pitch nacional e 10-14 regionais. Se a `/metodologia/` não indexar até ao fim de Setembro, é problema técnico e não se publica mais nada.

**A 3 meses (Novembro 2026)**
Vaga 2a (40 praias) publicada em Outubro e a indexar. Primeiras impressões — **não cliques** — em queries informacionais («o que é a nortada», «como se sabe se está bom para a praia»): dezenas, não centenas. Vaga 2b (fluviais) a sair. E2 publicado. 1 link de imprensa se o pitch regional de E1 correu. ~50 URLs indexadas.

**A 6 meses (Fevereiro 2027)**
O **Portão 2** já correu em Dezembro e o tecto está fixado (465, 200 ou 120). Primeiros cliques em queries com nome de praia — em época baixa, portanto **dezenas por mês**, e isso é o sinal certo. ~8 domínios de referência. Se forem ≤3, para-se de publicar páginas e passa-se um mês inteiro em PR. `/dados/` no Zenodo com DOI. 150 URLs indexadas.

**A 12 meses (Agosto 2027)**
As páginas de Outubro têm 10 meses e as de Fevereiro têm 6 — é a **colheita**, e a única época em que este trabalho se mede. E3 publicado em Maio, E4 em Junho, ambos na janela em que a nortada volta a ser assunto. 250-350 URLs indexadas, ~30 domínios de referência, ~15.000 impressões/mês no pico, «o que é a nortada» no top 5. Só depois de Agosto de 2027 é que se poda.

**Regras transversais:** mínimo de 4 semanas entre vagas; **congelar durante core updates** (uma core update leva 12 a 45 dias a rolar e as recuperações levam 1-3 meses, muitas vezes um ciclo inteiro); nunca acelerar porque «está a correr bem» à primeira semana — a avaliação de qualidade é ao nível do site.

---

## A ordem literal do primeiro dia

1. **Supabase → URL Configuration:** Site URL `https://praiometro.pt`, Redirect URLs `https://praiometro.pt/**`.
2. **GSC por DNS TXT** + Bing por importação. Guardar o HTML renderizado de `https://praiometro.pt/` (Inspecção de URL → Testar URL publicado) — é a linha de base.
3. **`_config.yml`** com o `exclude` completo. Confirmar 404 em `/MODELO.md` e `/MONETIZACAO.md`, que hoje dão **200**.
4. **`robots.txt`** (versão simplificada) + **`sitemap.xml`** com 2 URLs. Submeter.
5. **`index.html`** num só commit: `<title>`, `description`, canonical, bloco OG completo com `og:image` no domínio novo, **todos os caminhos a absolutos**, `preload` com `crossorigin`, `dialog` para antes de `</body>`, headings, script de sessão inline, atalhos com `data-id`.
6. **`privacidade.html`** e **`manifest.webmanifest`**: canonical, OG, caminhos absolutos, `scope`.
7. **PR do patch ao `app.js`** — `on()` a guardar os 16 listeners, `fetch('/data/praias.json')`, guarda no `replaceState` da linha 361. **Sem este PR, nenhuma página de praia funciona, por muito bem gerada que esteja.**
8. **PR do cadeado:** `_build/lib/slug.js` (com `slugificar()` a embrulhar `normalizar()`), `data/slugs.json`, `_source/testar-slugs.js` a cobrir **slugs e coordenadas**. É o cadeado — **nada de páginas antes de estar merged e a passar**.
9. **`404.html`** com caminhos absolutos. Confirmar que `/naoexiste-xpto` continua 404.
10. **Teste da barra final** (`/teste-barra/`), medir, apagar.

**Ficheiros tocados no dia 1:** `/Users/renatovalente/Websites/Praiometro/_config.yml` (novo) · `/robots.txt` (novo) · `/sitemap.xml` (novo) · `/404.html` (novo) · `/index.html` · `/privacidade.html` · `/manifest.webmanifest` · `/assets/js/app.js` · `/assets/img/og.png` · `/README.md` · `/LICENSE` · `/_build/lib/slug.js` (novo) · `/data/slugs.json` (novo) · `/_source/testar-slugs.js` (novo) · `/.gitignore` (acrescentar `_site/`, remover `_source/osm-praias.json`).