# Pôr isto a render dinheiro

Análise feita a 3 de agosto de 2026. As fontes estão ligadas ao longo do texto.

---

## O facto que decide tudo o resto

A previsão vem da Open-Meteo, e o plano gratuito **proíbe** uso comercial. Não é
uma zona cinzenta — está escrito nos [termos de utilização](https://open-meteo.com/en/terms):

> You may only use the free API services for non-commercial purposes.

E a lista do que eles consideram comercial inclui, textualmente:

> Operating websites or apps that have **subscriptions** or display **advertisements**.

Ou seja: **no minuto em que puseres um anúncio ou cobrares uma subscrição, deixas
de poder usar a API que faz o site funcionar.** Não é uma questão de risco — é
uma violação directa dos termos, e eles reservam-se o direito de bloquear IPs sem
aviso prévio.

Uma nota importante: a restrição é **contratual sobre o serviço deles**, não uma
restrição de direitos de autor. Os dados em si são CC BY 4.0 e os modelos de
origem (ECMWF, DWD, NOAA) permitem uso comercial. Isso abre a porta ao
auto-alojamento, mais abaixo.

**Donativos** não aparecem em lado nenhum dos termos, nem como permitidos nem
como proibidos. A leitura mais natural é que um site sem anúncios e sem
subscrições, com um botão de donativo, continua não-comercial. Mas isto é
interpretação, não facto — vale um email a `info@open-meteo.com` antes de
avançar. É gratuito e elimina a ambiguidade.

### As alternativas gratuitas não salvam

| Fonte | Uso comercial | Dados de mar em Portugal |
|---|---|---|
| **IPMA** | ❌ Proibido — *"desde que dessa utilização não decorram finalidades lucrativas"* | ⚠️ Só **7 pontos** em todo o continente |
| **Met.no / Yr** | ✅ Permitido (NLOD 2.0 + CC BY 4.0) | ❌ `oceanforecast` devolve **422: only available for Northern/Western Europe** |
| **Open-Meteo grátis** | ❌ Proibido | ✅ Ondas, temperatura da água, período |

O IPMA parece a escolha patriótica óbvia até se ler as condições: é ainda mais
restritivo do que a Open-Meteo, e sobretudo **não tem dados por praia** — sete
pontos costeiros no continente (Viana, Porto, Figueira, Lisboa, Sines, Sagres,
Faro) não servem uma aplicação que promete qualquer praia do país.

O met.no permite uso comercial, e a previsão meteorológica funciona em Portugal —
mas a API marítima recusa coordenadas portuguesas. Perderias a temperatura da
água e a ondulação, que são 14 dos 100 pontos e dois dos avisos mais úteis.

### O que custa passar a comercial

| Opção | Custo | Notas |
|---|---|---|
| **Open-Meteo API Standard** | **29 €/mês** ou **319 €/ano** | 1 milhão de chamadas/mês, Marine API incluída, sem ambiguidade |
| Auto-alojar (Docker, AGPLv3) | VPS com 16 GB RAM + 150 GB NVMe | ~20-40 €/mês na Europa — **provavelmente não compensa** face aos 29 € |
| Open-Meteo Professional | 99 €/mês | Só se precisares de dados históricos ou climáticos |

---

## As contas que interessam

Isto é a parte que decide se vale a pena, e é a minha análise, não um facto
verificado — mas os números de entrada são realistas.

**Publicidade.** O RPM (receita por mil visualizações) do AdSense para conteúdo
de meteorologia/lazer em Portugal anda tipicamente entre **2 € e 6 €**. Portugal
é um mercado pequeno e o RPM português é dos mais baixos da Europa ocidental.

Com um RPM optimista de 4 €, para cobrir **só** a licença de 319 €/ano:

```
319 € ÷ 4 € por mil  =  ~80 000 visualizações por ano
```

E isso é apenas o ponto de equilíbrio da licença. Ainda há:

- **domínio próprio** (~10-15 €/ano) — o AdSense na prática não aceita
  `github.io`, porque não consegues provar propriedade do domínio-pai;
- **um CMP certificado** para o consentimento de cookies no EEE, que a Google
  exige para servir anúncios personalizados a tráfego europeu;
- o custo de o site deixar de ser rápido, sem cookies e sem terceiros — que é
  hoje uma das suas melhores características.

80 000 visualizações por ano, numa aplicação sazonal (Junho a Setembro), só para
Portugal, a competir com a **Info Praia** da APA, a **Posso ir?** da DECO e a
**Praia em Directo** da Vodafone — todas gratuitas e já instaladas — é uma meta
séria, não um dado adquirido.

**A conclusão desconfortável: é bem possível que a publicidade não pague sequer a
licença que te obriga a comprar.** E, pelo caminho, estragas o que o site tem de
melhor.

---

## O que eu faria

### Agora: donativos, e mais nada

- Zero custos, zero infraestrutura, zero obrigações de IVA.
- Continua não-comercial (a confirmar por email com a Open-Meteo).
- Não obriga a banner de cookies nem a CMP — o site continua sem cookies.
- Um botão discreto no rodapé, do género «se isto te foi útil, paga-me um café».

Plataformas, por ordem de simplicidade: **Ko-fi** (0 % de comissão no plano
gratuito, só a taxa do PayPal/Stripe), **Buy Me a Coffee** (5 %), ou **Stripe
Payment Links** (1,5 % + 0,25 € em cartões europeus). Nenhuma exige código no
site — basta um link, o que mantém a página sem terceiros.

**Não actives «tiers» nem recompensas.** Assim que deres alguma coisa em troca —
nem que seja um distintivo — deixa de ser donativo e passa a prestação de
serviços: abertura de actividade, factura por cada operação e IVA. Ver a secção
legal abaixo; é a diferença entre não ter obrigação nenhuma e ter todas.

### A seguir: medir antes de decidir

Neste momento **não há forma de saber quantas pessoas usam isto** — o GitHub
Pages não dá registos e o site não tem estatísticas nenhumas.

Um domínio próprio atrás da **Cloudflare** resolve dois problemas de uma vez: dá
estatísticas gratuitas e sem cookies (Web Analytics), e é o pré-requisito para
qualquer publicidade futura. Custo: o domínio, 10-15 €/ano.

Sem esse número, tudo o resto é adivinhação.

### Só depois: publicidade ou subscrição

Com dados reais de tráfego, a decisão faz-se sozinha:

- **acima de ~100 000 visualizações/ano** → a licença de 29 €/mês paga-se e há
  margem; aí sim, domínio + CMP + AdSense;
- **abaixo disso** → a publicidade dá prejuízo depois da licença. Fica-te pelos
  donativos.

### A ideia que valeria mesmo dinheiro

Se alguma coisa aqui justifica uma subscrição, não é ver a previsão — isso tem
de continuar gratuito, senão ninguém entra. É **ser avisado**:

> «Avisa-me quando a minha praia estiver verde.»

Isso é o que ninguém faz bem, é o que uma pessoa quer em Agosto, e nós agora
temos as duas peças necessárias: **contas** (para saber a quem avisar) e um
**servidor** (as Edge Functions do Supabase, com `pg_cron` para correr de manhã).
Faltaria só o Web Push com VAPID, que é gratuito e não depende de lojas de apps.

Um euro ou dois por época de banhos, por avisos das tuas praias. É pequeno, mas é
honesto, não estraga o site, e é a única coisa aqui pela qual eu próprio pagaria.

**Atenção:** cobrar seja o que for aciona a licença comercial de 29 €/mês **e**
todo o aparato legal (facturação certificada, IVA/OSS, direito de livre resolução
de 14 dias, Livro de Reclamações electrónico). É um salto de categoria, não um
botão que se liga.

---

## O que a lei portuguesa exige de cada caminho

Tudo verificado nas fontes oficiais (Diário da República, Portal das Finanças,
CNPD, DGC). Onde há dúvida real, está assinalada — não vale a pena fingir
certezas nesta matéria.

### Donativos: não é IRS, é Imposto do Selo

Um donativo genuíno não é rendimento. Cai no [art. 1.º do Código do Imposto do
Selo](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/selo/Pages/selo1.aspx),
que abrange expressamente valores monetários depositados em contas bancárias.

- Taxa de **10 %** (verba 1.2 da Tabela Geral).
- **Não sujeitos os "donativos conforme os usos sociais... até ao montante de
  500 €"** (art. 1.º n.º 5 d)). Um café de 3 € não é tributado.
- **Não é preciso abrir actividade** para donativos puros e ocasionais.

**Mas há uma armadilha, e é grande.** O art. 1.º n.º 2 do CIS diz que não é
donativo o que estiver sujeito a IVA. Ou seja:

| | Donativo verdadeiro | Contrapartida |
|---|---|---|
| O que dás em troca | **Nada** | Acesso sem publicidade, distintivo, conteúdo exclusivo, acesso antecipado… |
| Imposto | Selo, 10 % acima de 500 € | IRS categoria B + IVA |
| Abrir actividade | Não | **Sim** |
| Facturar | Não | **Sim, por cada operação** |

Os «tiers» do Ko-fi e do Buy Me a Coffee que dão *qualquer* benefício são
contrapartida, por muito que a plataforma lhes chame *support*. **Se fores por
donativos, que sejam donativos a sério: um botão, sem recompensas.**

### Publicidade obriga-te a publicar a morada e o NIF

Isto é o que mais custa e quase ninguém antecipa. Hoje o site é gratuito e sem
publicidade, e por isso **não é um «serviço da sociedade da informação»**: o
[art. 3.º, n.º 1 do DL 7/2004](https://data.dre.pt/eli/dec-lei/7/2004/01/07/p/dre/pt/pdf)
define-o como serviço prestado «mediante remuneração **ou pelo menos no âmbito de
uma actividade económica**». Sem nenhuma das duas, o diploma não se aplica, e é
por isso que a página de privacidade leva só nome e email.

**Com AdSense isso inverte-se.** O considerando 18 da Directiva 2000/31/CE e o
acórdão do Tribunal de Justiça **[Papasavvas, C-291/13](https://eur-lex.europa.eu/legal-content/PT/TXT/?uri=CELEX:62013CJ0291)**
dizem-no sem margem: um site cuja remuneração vem da publicidade exibida **é**
serviço da sociedade da informação. A partir daí o art. 10.º aplica-se por
inteiro e obriga a disponibilizar, de forma permanente e de acesso fácil:

- nome;
- **endereço geográfico** onde estás estabelecido, e email;
- inscrições em registos públicos, se houver;
- **número de identificação fiscal**.

Coima de **2 500 € a 50 000 €**, fiscalizada pela ANACOM (art. 37.º, n.º 1, al. a)).

Ou seja: activar o AdSense obriga-te a publicar a tua morada e o teu NIF num site
público. Se um dia for esse o caminho, vale a pena avaliar constituir ENI com
morada fiscal distinta da de casa — porque a lei não admite omitir.

**Donativos são zona cinzenta**, e depende de três coisas: se há contrapartida,
se são pedidos de forma organizada e permanente, e da escala. Donativos sem nada
em troca e sem plataforma de apoio recorrente não fazem nascer o dever; um
Patreon com níveis, sim.

### Publicidade: obriga a mais do que parece

- Rendimento de **categoria B**, com **abertura de actividade obrigatória**.
- Atenção ao código: a **CAE Rev.4 entrou em vigor a 1 de janeiro de 2025**
  ([DL 9/2025](https://data.dre.pt/eli/dec-lei/9/2025/02/12/p/dre/pt/pdf)) e o
  antigo *63120 — Portais Web* **deixou de existir**. Os candidatos agora são
  63910, 63920, 63100 ou 73120. A escolha mexe no coeficiente do regime
  simplificado (0,35 vs 0,75) — vale a pena falar com um contabilista.
- Quem te paga é a **Google Ireland**: factura **sem IVA**, com menção de
  autoliquidação. Podes emitir gratuitamente no Portal das Finanças.
- **Registo no VIES e declaração recapitulativa são obrigatórios desde o
  primeiro euro** — não há limiar. A AT é explícita nisto no
  [Ofício-Circulado 30115/2009](https://www.occ.pt/fotos/editor2/OficioCirc%2030115.pdf).
  É o erro mais comum de quem começa com AdSense.

### Subscrições: é um salto de categoria

- **Facturação certificada** ([DL 28/2019](https://data.dre.pt/eli/dec-lei/28/2019/02/15/p/dre/pt/pdf)):
  obrigatória acima de 50 000 €/ano **ou sempre que uses um programa de
  facturação**. Abaixo dos 50 000 €, a via limpa é emitir no Portal das Finanças
  — assim que ligas o Stripe a emitir facturas, cais na obrigação.
- **IVA**: até **10 000 €** de serviços a consumidores de outros países da UE
  pagas em Portugal; acima disso, registo no **OSS**. A isenção geral de IVA
  subiu para **15 000 €** desde 1 de julho de 2025 (DL 35/2025).
- **Direito de livre resolução de 14 dias** ([DL 24/2014](https://data.dre.pt/eli/dec-lei/24/2014/02/14/p/dre/pt/pdf)).
  Há uma excepção para conteúdos digitais, mas exige **três coisas cumulativas**:
  consentimento prévio e expresso para começar já, reconhecimento explícito de
  que isso faz perder o direito, e confirmação em suporte duradouro. Sem as três,
  a pessoa cancela e é reembolsada. E se não informares do direito, o prazo
  estende-se a **12 meses**.
- **Livro de Reclamações electrónico: obrigatório**, mesmo sendo só online
  ([DL 156/2005 com a redacção do DL 74/2017](https://data.dre.pt/eli/dec-lei/74/2017/06/21/p/dre/pt/pdf)).
  Tens de divulgar o acesso à plataforma em local visível e responder em 15 dias
  úteis. Coima de 250 € a 3500 €.
- **Resolução alternativa de litígios**: a entidade residual é o
  [CNIACC](https://www.cniacc.pt/pt), e tens de a indicar no site.
  **Não incluas a plataforma ODR europeia** — foi desligada a 20 de julho de 2025
  pelo [Regulamento (UE) 2024/3228](https://eur-lex.europa.eu/legal-content/PT/TXT/?uri=OJ:L_202403228),
  e continua em metade dos sites portugueses por copiar-colar.

### Cookies: é a publicidade que traz o banner

Hoje o site é **completamente sem cookies** e por isso não precisa de banner
nenhum. Isso acaba no dia em que houver anúncios.

- A [Lei 41/2004, art. 5.º](https://data.dre.pt/eli/lei/46/2012/08/29/p/dre/pt/pdf)
  exige **consentimento prévio** — opt-in a sério, com bloqueio efectivo antes de
  a pessoa aceitar.
- A [CNPD](https://www.cnpd.pt/media/x2zdus50/nota-informativa-cnpd_cookies_20210625.pdf)
  é clara: o dono do site é responsável por **todos** os cookies que deixa
  colocar, incluindo os de terceiros e **incluindo os de analítica**.
- Desde **16 de janeiro de 2024**, a Google exige uma **CMP certificada e
  integrada no IAB TCF v2.2** para servir anúncios personalizados a tráfego do
  EEE. Sem isso, só anúncios não personalizados — que rendem bastante menos, o
  que piora ainda mais as contas lá de cima.

### Três pontos que exigem contabilista

1. A nova redacção do art. 59.º do CIVA (julho de 2025) criou uma contradição
   literal sobre se os isentos do art. 53.º continuam obrigados à declaração
   recapitulativa. O entendimento corrente diz que sim.
2. Registar-se por CAE ou pelo código 1519 da tabela do art. 151.º muda o
   coeficiente de 0,35 para 0,75 — e há litígio sobre o assunto.
3. Territorialidade do Imposto do Selo sobre donativos vindos do estrangeiro para
   uma conta portuguesa (art. 4.º n.ºs 3 e 4 do CIS).

---

## Contas que terias de criar

Só quando decidires avançar — nada disto é preciso hoje:

| Para quê | Onde | Custo | Obrigação legal que traz |
|---|---|---|---|
| Donativos | Ko-fi ou Stripe | 0 € (comissão por transacção) | Nenhuma, se forem donativos puros. Modelo 1 do Imposto do Selo acima de 500 € por donativo |
| Estatísticas + futuro AdSense | Registador + Cloudflare | 10-15 €/ano | Nenhuma (analítica da Cloudflare é sem cookies) |
| Publicidade | Google AdSense | 0 €, mas exige domínio próprio | Actividade aberta, VIES **desde o 1.º euro**, CMP certificada TCF, banner de cookies |
| Uso comercial da previsão | Open-Meteo Standard | 29 €/mês ou 319 €/ano | — |
| Subscrições | Stripe + Supabase | comissão | Facturação, IVA/OSS acima de 10 000 €, livre resolução, Livro de Reclamações, CNIACC |

---

## Uma pendência técnica, enquanto o site for gratuito

O site usa hoje quatro modelos, e um deles — o **UKMO** — é o único distribuído
em **CC BY-SA** (*share-alike*), enquanto ECMWF, DWD e NOAA são CC BY ou domínio
público. Mostrar uma previsão é quase de certeza «uso» e não «adaptação», pelo
que o *share-alike* não deve contaminar nada. Mas se um dia se guardarem ou
reprocessarem estes dados num conjunto próprio, vale a pena rever — ou fixar os
modelos em `ecmwf_ifs025,icon_seamless,gfs_seamless` e prescindir do UKMO.

Não mexi nisso porque tirar o UKMO baixa ligeiramente o vento do consenso, e o
vento foi precisamente o que pediste para reforçar. É uma decisão tua.
