# -*- coding: utf-8 -*-
"""Mede a nortada a sério, para a página /nortada/ não dizer nada de cor.

   Correr:  python3 _source/recolher-nortada.py
   Produz:  _build/dados/nortada.json

   O QUE MEDE, e porque é que não se pode inferir de outra maneira:

   «A que horas é que o vento acalma na praia» é a pergunta que ninguém em
   Portugal responde com números, e não se responde com a previsão de hoje —
   um dia não é um hábito. Responde-se com o perfil horário médio de muitos
   Verões, que é o que isto vai buscar: ERA5, reanálise, Julho e Agosto de
   2016 a 2025, hora a hora, em praias reais do data/praias.json.

   «Que praias são abrigadas» também não se adivinha pela orientação da costa
   sem a conhecer (e o modelo não a conhece — está escrito nas limitações).
   Aqui MEDE-SE: conta-se, em cada praia, a fracção de tardes de Verão em que
   houve nortada segundo a definição operacional portuguesa — vento do
   quadrante 315°-45° com 7 m/s (25 km/h) ou mais.

   ORÇAMENTO: 62 dias por pedido pesam ~4,4 chamadas na contabilidade da
   Open-Meteo (mais de 2 semanas conta como várias). 28 praias × 10 anos são
   ~1230 chamadas contadas, muito abaixo das 10 000 por dia. Há uma pausa
   entre pedidos e o resultado fica em disco — não se volta a pedir o que já
   se tem.
"""
import json, os, sys, time, urllib.request, urllib.error
from collections import defaultdict

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.join(RAIZ, '_build', 'dados', 'nortada.json')
CACHE = os.path.join(RAIZ, '_source', 'nortada-bruto.json')

ANOS = range(2016, 2026)          # dez Verões
MESES = [(7, 1, 7, 31), (8, 1, 8, 31)]

# A janela do modelo, para a página falar a mesma língua que o site.
HORA_INI, HORA_FIM = 11, 19
# Definição operacional de nortada em Portugal: 315°-45° com >= 7 m/s.
NORTADA_KMH = 25.2                # 7 m/s
NORTADA_DIR = (315, 45)

# Praias reais, escolhidas por darem cobertura e por serem conhecidas. As
# coordenadas são lidas do data/praias.json pelo nome — se alguma sair do
# ficheiro, o script diz e não inventa.
PRAIAS = [
    ('Norte', [
        ('Praia de Moledo', 41.85093, -8.86752),
        ('Praia de Afife', 41.78502, -8.87152),
        ('Praia de Matosinhos', 41.17649, -8.69362),
        ('Praia da Baía', 41.00691, -8.6468),
        ('Praia de Miramar', 41.06582, -8.65708),
    ]),
    ('Centro', [
        ('Praia do Furadouro', 40.87521, -8.67682),
        ('Praia da Barra', 40.63609, -8.74889),
        ('Praia de Mira', 40.45103, -8.80558),
        ('Praia da Figueira da Foz', 40.15646, -8.87589),
        ('Praia São Pedro de Moel', 39.75375, -9.03357),
        ('Praia da Nazaré', 39.5971, -9.07493),
    ]),
    ('Oeste e Lisboa', [
        ('Praia do Baleal', 39.3655, -9.35585),
        ('Praia da Areia Branca', 39.26646, -9.33602),
        ('Praia do Sul', 38.95488, -9.41651),
        ('Praia do Guincho', 38.73318, -9.47318),
        ('Praia de Carcavelos', 38.67925, -9.33606),
    ]),
    ('Setúbal', [
        ('Praia de Santo António da Caparica', 38.64747, -9.24381),
        ('Praia do Meco', 38.48842, -9.18368),
        ('Praia da Califórnia', 38.44127, -9.09803),
        ('Praia de Galapinhos', 38.48344, -8.96793),
        ('Praia da Comporta', 38.38093, -8.80358),
    ]),
    ('Alentejo', [
        ('Praia de Melides', 38.12914, -8.79344),
        ('Praia da Baía de Porto Covo', 37.84968, -8.7915),
        ('Praia da Zambujeira do Mar', 37.52308, -8.78748),
    ]),
    ('Algarve poente', [
        ('Praia da Arrifana', 37.29206, -8.86546),
        ('Praia do Amado', 37.16434, -8.90339),
        ('Meia Praia', 37.11926, -8.63764),
        ('Praia da Rocha', 37.11565, -8.53621),
    ]),
    ('Algarve nascente', [
        ('Praia da Ilha de Faro', 37.00384, -7.99081),
        ('Praia da Ilha de Tavira', 37.10991, -7.621),
        ('Praia de Monte Gordo', 37.17668, -7.44735),
    ]),
]



def coordenadas():
    """A lista traz as coordenadas escritas, e não só o nome: quatro destes
       nomes repetem-se no ficheiro (dois «Guincho», duas «Areia Branca») e
       escolher «a primeira» era escolher à sorte. Aqui confirma-se que cada
       coordenada existe mesmo, para a lista não envelhecer em silêncio."""
    praias = json.load(open(os.path.join(RAIZ, 'data', 'praias.json'), encoding='utf-8'))
    existe = {'%.5f,%.5f' % (p['la'], p['lo']): p for p in praias}
    saida, faltam = [], []
    for regiao, entradas in PRAIAS:
        for nome, la, lo in entradas:
            p = existe.get('%.5f,%.5f' % (la, lo))
            if not p:
                faltam.append(f'{nome} ({la},{lo})'); continue
            if p['n'] != nome:
                faltam.append(f'{nome} mudou de nome para «{p["n"]}»'); continue
            saida.append({'n': nome, 'r': regiao, 'la': la, 'lo': lo,
                          'id': '%.4f,%.4f' % (la, lo)})
    if faltam:
        print('  ATENÇÃO — praias que já não batem certo com o data/praias.json:')
        for f in faltam:
            print('     ' + f)
        raise SystemExit('corrigir a lista antes de recolher')
    return saida


def pedir(la, lo, ini, fim):
    url = ('https://archive-api.open-meteo.com/v1/archive'
           f'?latitude={la}&longitude={lo}&start_date={ini}&end_date={fim}'
           '&hourly=wind_speed_10m,wind_direction_10m&timezone=Europe%2FLisbon')
    for tentativa in range(4):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                espera = 30 * (tentativa + 1)
                print(f'     429 — a esperar {espera}s'); time.sleep(espera); continue
            raise
        except Exception as e:
            print(f'     {e} — a repetir'); time.sleep(5)
    raise RuntimeError('não consegui: %s' % url)


def recolher():
    bruto = json.load(open(CACHE, encoding='utf-8')) if os.path.exists(CACHE) else {}
    praias = coordenadas()
    print(f'praias: {len(praias)} | anos: {ANOS.start}-{ANOS.stop - 1}')
    for i, p in enumerate(praias, 1):
        for ano in ANOS:
            for m1, d1, m2, d2 in MESES:
                chave = f"{p['id']}|{ano}-{m1:02d}"
                if chave in bruto:
                    continue
                d = pedir(p['la'], p['lo'], f'{ano}-{m1:02d}-{d1:02d}', f'{ano}-{m2:02d}-{d2:02d}')
                h = d['hourly']
                bruto[chave] = {'t': h['time'], 'v': h['wind_speed_10m'],
                                'd': h['wind_direction_10m']}
                time.sleep(0.35)
        print(f"  [{i}/{len(praias)}] {p['n']}")
        json.dump(bruto, open(CACHE, 'w'), separators=(',', ':'))
    return praias, bruto


def e_nortada(v, d):
    if v is None or d is None:
        return False
    return v >= NORTADA_KMH and (d >= NORTADA_DIR[0] or d <= NORTADA_DIR[1])


def calcular(praias, bruto):
    # perfil horário por região, e fracção de tardes com nortada por praia
    perfil = defaultdict(lambda: defaultdict(list))     # regiao -> hora -> [velocidades]
    por_praia = {}
    for p in praias:
        horas, tardes, tardes_nortada = defaultdict(list), 0, 0
        dias = defaultdict(list)
        for ano in ANOS:
            for m1, *_ in MESES:
                b = bruto.get(f"{p['id']}|{ano}-{m1:02d}")
                if not b:
                    continue
                for t, v, d in zip(b['t'], b['v'], b['d']):
                    hora = int(t[11:13])
                    if v is None:
                        continue
                    horas[hora].append(v)
                    perfil[p['r']][hora].append(v)
                    if HORA_INI <= hora < HORA_FIM:
                        dias[t[:10]].append((v, d))
        for _dia, valores in dias.items():
            tardes += 1
            # a tarde conta como nortada se a maior parte das horas da janela o for
            if sum(1 for v, d in valores if e_nortada(v, d)) >= len(valores) / 2:
                tardes_nortada += 1
        por_praia[p['id']] = {
            'n': p['n'], 'r': p['r'],
            'tardes': tardes,
            'pct_nortada': round(100 * tardes_nortada / tardes, 1) if tardes else None,
            'medio_janela': round(sum(sum(horas[h]) for h in range(HORA_INI, HORA_FIM))
                                  / max(1, sum(len(horas[h]) for h in range(HORA_INI, HORA_FIM))), 1),
            'por_hora': {h: round(sum(horas[h]) / len(horas[h]), 1) for h in sorted(horas) if horas[h]},
        }
    perfil_regiao = {r: {h: round(sum(v) / len(v), 1) for h, v in sorted(hs.items())}
                     for r, hs in perfil.items()}

    # A grelha do ERA5 não distingue praias muito próximas: Moledo e Afife, a
    # 7 km, devolvem séries 100% idênticas. Apresentá-las como duas medições
    # independentes era inventar precisão que não existe. Fica registado aqui
    # quais são, para quem escrever a página as poder juntar.
    assinatura = defaultdict(list)
    for p in praias:
        b = bruto.get(f"{p['id']}|2025-08")
        if b:
            assinatura[tuple(v for v in b['v'][:240])].append(p['id'])
    grupos = [g for g in assinatura.values() if len(g) > 1]

    return {'perfil_regiao': perfil_regiao, 'praias': por_praia,
            'grupos_grelha': grupos,
            'anos': [ANOS.start, ANOS.stop - 1], 'meses': 'Julho e Agosto',
            'fonte': 'ERA5 via Open-Meteo Archive API',
            'nortada': {'kmh': NORTADA_KMH, 'dir': list(NORTADA_DIR)},
            'janela': [HORA_INI, HORA_FIM]}


if __name__ == '__main__':
    praias, bruto = recolher()
    r = calcular(praias, bruto)
    os.makedirs(os.path.dirname(DESTINO), exist_ok=True)
    json.dump(r, open(DESTINO, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'\n{DESTINO} — {os.path.getsize(DESTINO) / 1024:.0f} KB')
    print(f'praias medidas: {len(r["praias"])} | regiões: {len(r["perfil_regiao"])}')
