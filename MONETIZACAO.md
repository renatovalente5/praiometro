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

## Contas que terias de criar

Só quando decidires avançar — nada disto é preciso hoje:

| Para quê | Onde | Custo |
|---|---|---|
| Donativos | Ko-fi ou Stripe | 0 € (comissão por transacção) |
| Estatísticas + futuro AdSense | Registador de domínio + Cloudflare | 10-15 €/ano |
| Publicidade | Google AdSense | 0 €, mas exige domínio próprio e aprovação |
| Uso comercial da previsão | Open-Meteo (plano Standard) | 29 €/mês ou 319 €/ano |

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
