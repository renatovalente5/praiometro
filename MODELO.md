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
| Sol e céu | 28 | É a razão nº1 para ir à praia |
| Vento | 26 | A nortada é o que mais estraga dias em Portugal |
| Temperatura do ar (sensação) | 20 | O calor que se sente, não o do termómetro |
| Temperatura da água | 16 | O que decide se se entra no mar |
| Chuva | 10 | Pouco peso porque a chuva a sério está nos vetos |

Nas praias de rio não há dados de mar: os 16 pontos da água são redistribuídos
proporcionalmente pelos outros factores.

### Janela horária

Tudo é calculado entre as **11h e as 19h**, hora local — é quando se vai à
praia. Fora dessa janela os dados são ignorados. Dentro dela: céu e vento pela
**média**, temperatura do ar pelo **máximo**, água pela **média**, chuva pela
**probabilidade máxima**, ondulação pelo **máximo**.

### Vento (26 pontos)

| Vento médio | Pontos | O que se sente |
|---|---:|---|
| ≤ 12 km/h | 26 | A toalha fica quieta |
| 13–19 km/h | 22 | Brisa agradável |
| 20–25 km/h | 14 | Começa a levantar areia |
| 26–32 km/h | 6 | Nortada instalada |
| 33–40 km/h | 2 | Areia na cara |
| > 40 km/h | 0 | Impraticável |

Os cortes não são inventados. **7 m/s (25 km/h)** é o limiar da definição
operacional de nortada usada em Portugal (vento de 315°–45° com ≥ 7 m/s). E o
início do transporte de areia por saltação, para grão de praia de ~190 µm,
dá-se a uma velocidade de atrito de ~0,23 m/s, o que convertido para vento a
10 m (κ=0,4, z₀≈1 mm) dá **≈ 19 km/h**. Duas linhas independentes — a
meteorologia portuguesa e a física eólica — caem na mesma banda dos 20–25 km/h.
É aí que está o degrau grande da tabela.

### Sol e céu (28 pontos)

| Nebulosidade média | Pontos |
|---|---:|
| 0–20 % | 28 |
| 21–40 % | 25 |
| 41–60 % | 18 |
| 61–80 % | 10 |
| 81–100 % | 4 |

### Temperatura do ar — sensação (20 pontos)

Usa-se a **temperatura aparente**, não a do termómetro: é a que inclui o efeito
do vento e da humidade.

| Sensação máxima | Pontos |
|---|---:|
| 25–31 °C | 20 |
| 22–25 ou 31–34 °C | 15 |
| 19–22 ou 34–37 °C | 8 |
| 16–19 ou 37–40 °C | 3 |
| < 16 ou > 40 °C | 0 |

### Temperatura da água (16 pontos)

**É aqui que um modelo estrangeiro se enganava em Portugal inteiro.** O
Atlântico português anda entre 17 e 20 °C em Agosto por causa do afloramento
costeiro. Medido na API no dia 2 de Agosto de 2026: Carcavelos 18,1 °C,
Nazaré 18,6 °C, Lagos 17,4 °C, Monte Gordo 21,9 °C, Funchal 24,8 °C.

Um modelo mediterrânico, que pede 24 °C para dar nota positiva, marcaria a
costa continental inteira a vermelho todos os dias do ano. A escala é
portuguesa:

| Água | Pontos | O que se diz na praia |
|---|---:|---|
| ≥ 22 °C | 16 | Está boa |
| 20–22 °C | 13 | Dá bem |
| 18–20 °C | 9 | Fresca, entra-se aos poucos |
| 16–18 °C | 5 | Fria |
| 14–16 °C | 2 | Muito fria |
| < 14 °C | 0 | Gelada |

### Chuva (10 pontos)

| Probabilidade máxima | Pontos |
|---|---:|
| < 10 % | 10 |
| 10–25 % | 7 |
| 26–45 % | 4 |
| 46–70 % | 1 |
| > 70 % | 0 |

## Vetos

Estas condições mandam o dia para **vermelho** sozinhas, independentemente da
pontuação. Um dia com trovoada não é um dia "médio".

- Trovoada prevista na janela (códigos 95, 96, 99)
- Probabilidade de chuva > 70 % ou acumulado ≥ 2 mm
- Vento médio > 45 km/h ou rajadas > 65 km/h
- Sensação térmica máxima < 16 °C
- Ondulação máxima > 2,5 m (só em praias de mar)

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

Meteorologia e mar: [Open-Meteo](https://open-meteo.com) (CC BY 4.0).
Lista de praias: [OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL).
