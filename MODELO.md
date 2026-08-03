# Como o site decide se está bom para a praia

Este documento é a especificação do modelo. Está no repositório de propósito:
um veredicto que não se consegue explicar não merece confiança.

## De onde vem o esqueleto

A base é o **HCI:Beach** (*Holiday Climate Index: Beach*), de Rutty, Scott e
Steiger — o índice revisto por pares desenhado especificamente para turismo
balnear. Fórmula original:

```
HCI:Beach = 2(TC) + 4(A) + 3(P) + W        →  0 a 100
            conforto  céu   chuva  vento
             20%      40%    30%   10%
```

Três coisas nele não servem para Portugal, e é por isso que este modelo não é
o HCI tal e qual:

1. **Não tem temperatura da água.** No Mediterrâneo e nas Caraíbas, onde foi
   validado, a água está sempre boa. Em Portugal continental é o factor que
   mais gente comenta na praia.
2. **O conforto térmico está calibrado para 30–36 °C.** É quente demais para o
   gosto português e para o clima da costa oeste.
3. **Dá ao vento apenas 10%.** Em Portugal a **nortada** é, na prática, o que
   mais dias estraga.

## O modelo usado aqui

100 pontos, repartidos assim:

| Factor | Peso | Porquê |
|---|---:|---|
| **Vento** | **34** | É o que mais dias estraga em Portugal — e um dia sem vento nenhum nota-se |
| Sol e céu | 26 | A razão nº1 para ir à praia |
| Temperatura do ar (sensação) | 18 | O calor que se sente, não o do termómetro |
| Temperatura da água | 14 | O que decide se se entra no mar |
| Chuva | 8 | Pouco peso porque a chuva a sério está nos vetos |

O vento é o factor mais pesado do modelo, e leva **mais do triplo** do que o
HCI:Beach lhe dá. Não é um palpite: é a diferença entre um índice validado no
Mediterrâneo e nas Caraíbas e um país onde a nortada é o assunto de Agosto.

Nas praias de rio não há dados de mar: a nota passa a ser a proporção dos pontos
obtidos sobre os 86 pontos que restam, o que equivale a redistribuir os 14 da
água proporcionalmente pelos outros factores.

**Consequência que é preciso conhecer.** A escala da água é absoluta e o
Atlântico raramente chega ao topo dela: em Agosto uma praia do noroeste anda nos
18 °C, que valem 8 dos 14 pontos. Uma praia de rio não carrega esse arrasto.
Medido com tempo exactamente igual (céu 15 %, vento 12 km/h, 27 °C, sem chuva):

| | Nota |
|---|---|
| Praia de mar, água a 18,5 °C | 91 |
| Praia de mar, água a 22,5 °C (Algarve) | 97 |
| Praia de rio | **97** |

São **6 pontos** de diferença entre mar e rio no mesmo dia, e chegam para virar
um amarelo em verde perto do corte dos 70. A nota de uma praia de rio responde
bem à pergunta «este dia presta nesta praia?», mas **não é directamente
comparável** com a de uma praia de mar. Por isso as praias de rio aparecem
marcadas com «rio» na pesquisa e na tira de favoritos, que é onde as duas
apareceriam lado a lado.

### Janela horária

Tudo é calculado entre as **11h e as 19h**, hora local — é quando se vai à
praia. Fora dessa janela os dados são ignorados.

Dentro dela: céu pela **média**, temperatura do ar pelo **máximo**, água pela
**média**, chuva pela **probabilidade máxima** e pelo **acumulado dentro da
janela**, ondulação pelo **máximo**.

O **vento é o percentil 75**, não a média. A média de nove horas achatava
exactamente o pico da tarde, que é quando a nortada sopra. Medido no Furadouro:
média 11,2 km/h contra 15,2 no pico — o site dizia menos vento do que qualquer
outro sítio, e tinha razão quanto à média e nenhuma quanto ao que se sente.

A **direcção do vento é uma média vectorial**, não aritmética. A direcção é uma
grandeza circular: a média de 350° e 10° dá 180° — sul, o oposto de norte — e a
nortada vive em cima dessa descontinuidade. Medido com ERA5 (Jul+Ago,
2019–2025), a média aritmética perdia 15% das nortadas na Nazaré e 38% em
Peniche. Não voltar a trocar por média simples.

Além disso calcula-se o vento **de manhã (11h–15h)** e **de tarde (15h–19h)** em
separado. Quando a tarde tem 7 km/h ou mais do que a manhã, o site di-lo: «de
manhã 12 km/h, à tarde 26 km/h — vale a pena ir cedo».

### Vento (34 pontos)

| Vento médio | Pontos | O que se sente |
|---|---:|---|
| ≤ 8 km/h | 34 | Sem vento nenhum |
| 9–12 km/h | 31 | A toalha fica quieta |
| 13–16 km/h | 27 | Brisa agradável |
| 17–19 km/h | 23 | Venta um pouco |
| 20–25 km/h | 15 | Começa a levantar areia |
| 26–32 km/h | 7 | Nortada instalada |
| 33–40 km/h | 2 | Areia na cara |
| > 40 km/h | 0 | Impraticável |

Os degraus do topo existem para premiar o dia calmo: com tudo o resto igual,
6 km/h dá 94 pontos e 22 km/h dá 75. São 19 pontos de diferença só no vento.

Os cortes não são inventados. **7 m/s (25 km/h)** é o limiar da definição
operacional de nortada usada em Portugal (vento de 315°–45° com ≥ 7 m/s). E o
início do transporte de areia por saltação, para grão de praia de ~190 µm,
dá-se a uma velocidade de atrito de ~0,23 m/s, o que convertido para vento a
10 m (κ=0,4, z₀≈1 mm) dá **≈ 19 km/h**. Duas linhas independentes — a
meteorologia portuguesa e a física eólica — caem na mesma banda dos 20–25 km/h.
É aí que está o degrau grande da tabela.

### Sol e céu (26 pontos)

| Nebulosidade média | Pontos |
|---|---:|
| 0–20 % | 26 |
| 21–40 % | 23 |
| 41–60 % | 17 |
| 61–80 % | 9 |
| 81–100 % | 4 |

### Temperatura do ar — sensação (18 pontos)

Usa-se a **temperatura aparente**, não a do termómetro: é a que inclui o efeito
do vento e da humidade.

| Sensação máxima | Pontos |
|---|---:|
| 25–31 °C | 18 |
| 22–25 ou 31–34 °C | 13 |
| 19–22 ou 34–37 °C | 7 |
| 16–19 ou 37–40 °C | 3 |
| < 16 ou > 40 °C | 0 |

### Temperatura da água (14 pontos)

**É aqui que um modelo estrangeiro se enganava em Portugal inteiro.** O
Atlântico português anda entre 17 e 20 °C em Agosto por causa do afloramento
costeiro. Medido na API no dia 2 de Agosto de 2026: Carcavelos 18,1 °C,
Nazaré 18,6 °C, Lagos 17,4 °C, Monte Gordo 21,9 °C, Funchal 24,8 °C.

Um modelo mediterrânico, que pede 24 °C para dar nota positiva, marcaria a
costa continental inteira a vermelho todos os dias do ano. A escala é
portuguesa:

| Água | Pontos | O que se diz na praia |
|---|---:|---|
| ≥ 22 °C | 14 | Está boa |
| 20–22 °C | 11 | Dá bem |
| 18–20 °C | 8 | Fresca, entra-se aos poucos |
| 16–18 °C | 4 | Fria |
| 14–16 °C | 2 | Muito fria |
| < 14 °C | 0 | Gelada |

### Chuva (8 pontos)

| Probabilidade máxima | Pontos |
|---|---:|
| < 10 % | 8 |
| 10–25 % | 6 |
| 26–45 % | 3 |
| 46–70 % | 1 |
| > 70 % | 0 |

## O factor limitante

Uma soma ponderada tem um defeito conhecido, e é a crítica que a literatura faz
aos índices aditivos como o TCI e o HCI: **um factor catastrófico é mascarado
pelos outros**. Medido durante o desenvolvimento: 38 km/h de vento dava 60
pontos, porque o sol e a ausência de chuva compensavam. Numa praia, 38 km/h
manda toda a gente embora, faça o sol que fizer.

Por isso, além da soma:

- se algum factor ficar abaixo de **8 %** do seu peso, o dia é **vermelho**;
- se ficar abaixo de **40 %**, o dia **não pode ser verde**.

A regra aplica-se ao sol, ao vento, ao calor e à chuva — o que determina se se
consegue **estar** na areia. **Não se aplica à água**: o mar gelado impede o
banho, não impede o dia de praia.

## Vetos

Estas condições mandam o dia para **vermelho** sozinhas, independentemente da
pontuação. Um dia com trovoada não é um dia "médio".

- Trovoada prevista na janela (códigos 95, 96, 99) — **aviso de segurança**
- Probabilidade de chuva > 70 % ou **acumulado ≥ 2 mm dentro da janela**
  (era o acumulado do dia inteiro: 79 % dos vetos vinham de chuva de madrugada
  ou de noite, e chumbavam tardes de sol)
- Vento > 45 km/h ou rajadas > 65 km/h — **aviso de segurança**
- Sensação térmica máxima < 16 °C
- Ondulação máxima > 2,5 m (só em praias de mar) — **aviso de segurança**

Os vetos marcados como aviso de segurança são ditos noutro tom e noutra cor: um
aviso de trovoada no mesmo amarelo que «a água está fria» é um aviso que
ninguém lê. E um dia vetado **deixa de mostrar a nota** — «Nota 94 em 100» ao
lado de «Hoje não» destrói a confiança em tudo o resto.

## Os cortes

| Pontuação | Cor | Veredicto |
|---|---|---|
| ≥ 70 | Verde | Bom dia de praia |
| 45–69 | Amarelo | Dia assim-assim |
| < 45 | Vermelho | Fica para outro dia |

## O que este modelo NÃO sabe

Escrito aqui para não se fingir que sabe:

- **Não sabe se o mar está seguro para nadar.** As cores aqui são sobre se vale
  a pena ir; as bandeiras da praia são sobre segurança e significam outra
  coisa. A bandeira do nadador-salvador manda sempre.
- **Não sabe a qualidade da água** (análises microbiológicas). Isso é da APA.
- **Não sabe se a praia tem sombra, estacionamento, ou se vai estar cheia.**
- **Não conhece a orientação da costa de cada praia.** Um vento de leste numa
  praia virada a oeste é abrigado; o modelo pontua a velocidade, não o abrigo.
  A direcção só é usada para dizer o nome «nortada» na explicação.
- **A temperatura da água vem de um modelo global**, com uma malha que não
  resolve baías pequenas nem a diferença entre a rebentação e o largo.
- **A partir do 4.º ou 5.º dia a previsão perde fiabilidade.** O site di-lo.
- **Praias de rio** não têm dados de mar nenhuns: nem água, nem ondulação.

## Fontes dos dados

Meteorologia: [Open-Meteo](https://open-meteo.com) (CC BY 4.0), com a **média de
quatro modelos** — ECMWF, ICON, GFS e UKMO. Medido no Furadouro, mesmo ponto e
mesma janela: ECMWF 10,8 · ICON 11,2 · KNMI 12,7 · Météo-France 13,5 · UKMO 13,8
· GFS 16,0 km/h. A dispersão entre modelos é de 1,6× e o modelo por omissão
calhava no extremo baixo. Mar: Open-Meteo Marine.
Lista de praias: [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL).
