# -*- coding: utf-8 -*-
"""Prepara os contornos para o mapa «Onde fica».

   Correr:  python3 _source/gerar-mapa.py
   Produz:  data/mapa.json

   PORQUÊ NÃO UM MAPA A SÉRIO: um mapa de tiles — Google, Mapbox, ou até o
   OpenStreetMap — manda o endereço IP de quem visita para um servidor de
   outra pessoa, a cada quadrado do mapa. Este site diz, na sua própria
   interface, que «não há cookies nem publicidade, e não seguimos ninguém
   entre sites». Um mapa de tiles desmentia-o em silêncio.

   Aqui não sai nada para fora: o contorno é desenhado no browser a partir
   deste ficheiro, que é servido pelo próprio site.

   A FONTE é a mesma CAOP da Direcção-Geral do Território que dá o concelho a
   cada praia. Tem uma vantagem que não é óbvia: os polígonos dos concelhos
   ACABAM na linha de costa, e por isso o litoral de Portugal vem de graça,
   sem precisar de um ficheiro de costa à parte.

   TAMANHO: 8,7 MB e 205 mil vértices em bruto. Simplificado a ~300 m com
   Douglas-Peucker e arredondado a três casas (~110 m), fica em ~270 KB, que
   são ~67 KB depois de comprimido. É carregado só quando alguém escolhe uma
   praia — a página de entrada não paga nada por isto.
"""
import json, math, os, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTE = os.path.join(RAIZ, '_source', 'caop-municipios.geojson')
DESTINO = os.path.join(RAIZ, 'data', 'mapa.json')

# ~300 m. Um mapa de 40 km de largura num telemóvel de 350 px dá 115 m por
# pixel; abaixo disto estaria a guardar detalhe que ninguém vê.
TOLERANCIA = 0.003
CASAS = 3

MINUSCULAS = {'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o'}


def titulo(s):
    ps = s.lower().split()
    return ' '.join(w if i and w in MINUSCULAS else w[:1].upper() + w[1:] for i, w in enumerate(ps))


def douglas_peucker(pontos, tol):
    """Sem dependências: o projecto não tem nenhuma e não vai ter."""
    if len(pontos) < 3:
        return pontos
    a, b = pontos[0], pontos[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy)
    dmax, idx = 0.0, 0
    for i in range(1, len(pontos) - 1):
        p = pontos[i]
        d = (abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / n) if n \
            else math.hypot(p[0] - a[0], p[1] - a[1])
        if d > dmax:
            dmax, idx = d, i
    if dmax > tol:
        return douglas_peucker(pontos[:idx + 1], tol)[:-1] + douglas_peucker(pontos[idx:], tol)
    return [a, b]


def main():
    if not os.path.exists(FONTE):
        print('falta o %s — corre primeiro o _source/gerar-concelhos.py' % FONTE)
        return 1
    sys.setrecursionlimit(20000)
    d = json.load(open(FONTE, encoding='utf-8'))

    saida, vertices = [], 0
    for f in d['features']:
        p = f['properties']
        nome = p.get('Concelho') or p.get('MUNICIPIO')
        if not nome:
            continue
        g = f['geometry']
        anelos = ([x[0] for x in g['coordinates']] if g['type'] == 'MultiPolygon'
                  else [g['coordinates'][0]])
        formas = []
        for a in anelos:
            s = douglas_peucker([(x[0], x[1]) for x in a], TOLERANCIA)
            # Um anel com menos de 4 pontos não desenha nada; e uma ilhota de
            # 300 m simplificada até ao triângulo é ruído no ecrã.
            if len(s) < 4:
                continue
            formas.append([[round(x, CASAS), round(y, CASAS)] for x, y in s])
        if not formas:
            continue
        vertices += sum(len(x) for x in formas)
        xs = [c[0] for r in formas for c in r]
        ys = [c[1] for r in formas for c in r]
        saida.append({
            'n': titulo(nome),
            # a caixa envolvente, para o browser não ter de a calcular 308 vezes
            'b': [round(min(xs), CASAS), round(min(ys), CASAS),
                  round(max(xs), CASAS), round(max(ys), CASAS)],
            'f': formas,
        })

    # Do maior para o mais pequeno: quem desenha primeiro é quem manda no
    # rótulo, e um concelho grande merece o nome antes de uma ilha.
    saida.sort(key=lambda c: -sum(len(x) for x in c['f']))

    os.makedirs(os.path.dirname(DESTINO), exist_ok=True)
    with open(DESTINO, 'w', encoding='utf-8') as f:
        json.dump({'fonte': 'CAOP, Direcção-Geral do Território',
                   'tolerancia_graus': TOLERANCIA, 'concelhos': saida},
                  f, ensure_ascii=False, separators=(',', ':'))
    kb = os.path.getsize(DESTINO) / 1024
    import gzip
    gz = len(gzip.compress(open(DESTINO, 'rb').read())) / 1024
    print('concelhos : %d' % len(saida))
    print('vértices  : %s (eram 205 331)' % f'{vertices:,}'.replace(',', ' '))
    print('%s — %.0f KB, %.0f KB comprimido' % (DESTINO, kb, gz))
    return 0


if __name__ == '__main__':
    sys.exit(main())
