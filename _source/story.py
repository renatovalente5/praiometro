# -*- coding: utf-8 -*-
"""Desenha o cartão para o story do Instagram, em 1080x1920.

   Correr:  python3 _source/story.py

   Mesmo princípio do og.py: não é uma imagem desenhada à mão, é HTML com a
   paleta do site renderizado em Chrome sem interface e fotografado. Se a
   paleta mudar, basta voltar a correr.

   As zonas de cima (260 px) e de baixo (330 px) ficam propositadamente vazias:
   é onde o Instagram põe o nome da conta, o X, e a barra de responder. Tudo o
   que interessa vive no meio.

   Os números do cartão não são inventados: saem do modelo.js a correr em Node
   sobre um dia calmo de Agosto na Praia da Barra (ver NOTA_DADOS)."""
import base64, os, socket, sys, urllib.parse

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, '_source'))
from cdp import Chrome

# node -e "require('./assets/js/modelo.js'); ..." com
#   céu 8 %, vento 11 km/h, ar 26 °C, água 19,4 °C, sem chuva, ondas 0,8 m
# devolve  {cor: verde, nota: 91, frase: "Bom dia de praia."}
NOTA_DADOS = 91

SOL = ('<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" '
       'stroke-linecap="round"><circle cx="24" cy="24" r="9" fill="currentColor" stroke="none"/>'
       '<path d="M24 5v5M24 38v5M5 24h5M38 24h5M10.6 10.6l3.5 3.5M33.9 33.9l3.5 3.5'
       'M10.6 37.4l3.5-3.5M33.9 14.1l3.5-3.5"/></svg>')
NUVEM_SOL = ('<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" '
             'stroke-linecap="round" stroke-linejoin="round"><circle cx="17" cy="17" r="7" '
             'fill="currentColor" stroke="none"/><path d="M17 4v4M4 17h4M8.3 8.3l2.8 2.8"/>'
             '<path d="M35 40H16a8 8 0 0 1 0-16 10 10 0 0 1 19.3-2.4A7.5 7.5 0 0 1 35 40Z" '
             'fill="#fff"/></svg>')
CHUVA = ('<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" '
         'stroke-linecap="round" stroke-linejoin="round"><path d="M34 29H15a8 8 0 0 1 0-16 '
         '10 10 0 0 1 19.3-2.4A7.5 7.5 0 0 1 34 29Z"/><path d="M16 35l-2 6M25 35l-2 6'
         'M34 35l-2 6"/></svg>')
# os mesmos ícones de factor do app.js
F_VENTO = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
           'stroke-linecap="round"><path d="M3 8h11a3 3 0 1 0-3-3M3 16h14a3 3 0 1 1-3 3M3 12h7"/></svg>')
F_CEU = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
         'stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M2 12h2'
         'M20 12h2M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5"/></svg>')
F_AGUA = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
          'stroke-linecap="round"><path d="M3 15c2 0 2-1.6 4-1.6s2 1.6 4 1.6 2-1.6 4-1.6 2 1.6 4 1.6'
          'M3 19c2 0 2-1.6 4-1.6s2 1.6 4 1.6 2-1.6 4-1.6 2 1.6 4 1.6"/>'
          '<path d="M12 3c2.5 3.4 4 5.6 4 7.4a4 4 0 0 1-8 0C8 8.6 9.5 6.4 12 3Z"/></svg>')
MARCA = ('<svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="12" r="6" fill="currentColor"/>'
         '<path d="M2 24c3 0 3-2 6-2s3 2 6 2 3-2 6-2 3 2 6 2 3-2 6-2" stroke="currentColor" '
         'stroke-width="2.4" stroke-linecap="round"/></svg>')

CARTAO = """<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1080px;height:1920px;overflow:hidden}
  body{
    font-family: ui-rounded,"SF Pro Rounded","Segoe UI",system-ui,-apple-system,sans-serif;
    color:#10222e;
    background:linear-gradient(180deg,#7dd3e8 0%,#9adcee 18%,#cdeef6 40%,#eef5f9 62%,#f3f7fa 100%);
    position:relative;
  }
  /* o mesmo sol do site. Fica ACIMA da marca e a sair pela direita: ao lado do
     texto, o halo passava-lhe por cima e comia-o. */
  .sol{position:absolute;top:-6px;right:-96px;width:330px;height:330px;border-radius:50%;
       background:radial-gradient(circle,#ffe27a 0 42%,#ffd24d 58%,transparent 72%);opacity:.9}
  /* o mar, em baixo, com a onda da marca */
  .mar{position:absolute;inset:auto 0 0 0;height:430px;
       background:linear-gradient(180deg,transparent,rgba(14,116,144,.20))}
  .onda{position:absolute;left:0;right:0;bottom:96px;height:120px;opacity:.30;
        color:#0e7490}
  .onda svg{width:100%;height:100%}

  /* 210 px em cima e 320 em baixo ficam livres para a interface do Instagram.
     Nada aqui pode encolher: com flex-shrink por omissão, o cartão apertava e
     o conteúdo saía-lhe pelo fundo, cortado pelo overflow:hidden. */
  .folha{position:relative;height:100%;padding:242px 84px 320px;
         display:flex;flex-direction:column;align-items:center;text-align:center}
  .folha > *{flex:none}

  .marca{display:flex;align-items:center;gap:20px}
  .marca svg{width:86px;height:86px;color:#0e7490;flex:none}
  .marca b{font-size:100px;font-weight:800;letter-spacing:-.035em;line-height:1}
  .lead{margin-top:16px;max-width:800px;font-size:42px;font-weight:500;color:#33505f;
        letter-spacing:-.01em}

  /* ------------------------------------------------ o cartão do veredicto */
  .veredicto{width:100%;margin-top:52px;background:#fff;border:1px solid #dde5ec;
    border-radius:46px;box-shadow:0 2px 4px rgba(16,34,46,.06),0 40px 80px -30px rgba(16,34,46,.34);
    padding:46px 44px 40px;position:relative;overflow:hidden}
  .veredicto::before{content:'';position:absolute;inset:0 0 auto 0;height:12px;background:#0e7a4a}
  .praia{font-size:48px;font-weight:700;letter-spacing:-.015em}
  .dia{margin-top:4px;font-size:31px;color:#4a6274}
  /* Sem a frase do modelo: por baixo de «Dia de praia», «Bom dia de praia.»
     era a mesma coisa dita duas vezes. Fica a nota, que acrescenta. */
  .selo{margin:24px 0 4px;display:flex;flex-direction:column;align-items:center;gap:16px}
  .bola{width:172px;height:172px;border-radius:50%;display:grid;place-items:center;
        background:#d7f2e3;color:#0e7a4a}
  .bola svg{width:58%;height:58%}
  .palavra{font-size:72px;font-weight:800;letter-spacing:-.025em;color:#0e7a4a;line-height:1}
  .nota{margin-top:14px;font-size:31px;color:#566e7d}
  .factores{margin-top:34px;padding-top:32px;border-top:1px solid #dde5ec;
            display:flex;justify-content:space-around}
  .factor{display:flex;flex-direction:column;align-items:center;gap:8px}
  .factor .i{width:46px;height:46px;color:#566e7d}
  .factor .i svg{width:100%;height:100%}
  .factor .v{font-size:36px;font-weight:700;color:#10222e}
  .factor .l{font-size:25px;color:#566e7d}

  /* ------------------------------------------------------- os três estados */
  .semaforo{margin-top:40px;display:flex;gap:14px;justify-content:center}
  .p{display:flex;align-items:center;gap:12px;background:#fff;border-radius:999px;
     padding:16px 26px 16px 16px;font-size:29px;font-weight:700;
     box-shadow:0 12px 28px -14px rgba(16,34,46,.42)}
  .b{width:50px;height:50px;border-radius:50%;display:grid;place-items:center;flex:none}
  .b svg{width:64%;height:64%}
  .v .b{background:#d7f2e3;color:#0e7a4a} .v{color:#0e7a4a}
  .a .b{background:#fdf0cf;color:#8a5c00} .a{color:#8a5c00}
  .r .b{background:#fbdfdc;color:#b3261e} .r{color:#b3261e}

  /* ---------------------------------------------------------- o endereço */
  /* Margem fixa e não `auto`: encostado ao fundo da folha, o endereço ficava a
     185 px de tudo o resto, como se fosse de outra imagem. */
  .fim{margin-top:84px;display:flex;flex-direction:column;align-items:center;gap:22px}
  .url{background:#0e7490;color:#fff;border-radius:999px;padding:26px 60px;
       font-size:52px;font-weight:800;letter-spacing:-.01em;
       box-shadow:0 20px 44px -18px rgba(14,116,144,.75)}
  .selo-livre{font-size:30px;color:#33505f;font-weight:600}
</style>
<div class="sol"></div>
<div class="mar"></div>
<div class="onda"><svg viewBox="0 0 1080 120" preserveAspectRatio="none" fill="none"
  stroke="currentColor" stroke-width="9" stroke-linecap="round">
  <path d="M-20 40c60 0 60-30 120-30s60 30 120 30 60-30 120-30 60 30 120 30 60-30 120-30
           60 30 120 30 60-30 120-30 60 30 120 30 60-30 120-30"/>
  <path d="M-20 92c60 0 60-30 120-30s60 30 120 30 60-30 120-30 60 30 120 30 60-30 120-30
           60 30 120 30 60-30 120-30 60 30 120 30 60-30 120-30" opacity=".6"/>
</svg></div>

<div class="folha">
  <div class="marca">__MARCA__<b>Praiómetro</b></div>
  <p class="lead">Escolhe a praia. Dizemos-te se vale a pena ir.</p>

  <div class="veredicto">
    <p class="praia">Praia da Barra</p>
    <p class="dia">Hoje, quarta-feira</p>
    <div class="selo">
      <span class="bola">__SOL__</span>
      <span class="palavra">Dia de praia</span>
    </div>
    <p class="nota">Nota __NOTA__ em 100</p>
    <div class="factores">
      <div class="factor"><span class="i">__F_VENTO__</span><span class="v">11 km/h</span><span class="l">vento</span></div>
      <div class="factor"><span class="i">__F_CEU__</span><span class="v">Sol</span><span class="l">céu</span></div>
      <div class="factor"><span class="i">__F_AGUA__</span><span class="v">19 °C</span><span class="l">água</span></div>
    </div>
  </div>

  <div class="semaforo">
    <span class="p v"><span class="b">__SOL__</span>Dia de praia</span>
    <span class="p a"><span class="b">__NUVEM_SOL__</span>Assim-assim</span>
    <span class="p r"><span class="b">__CHUVA__</span>Hoje não</span>
  </div>

  <div class="fim">
    <span class="selo-livre">Grátis, sem publicidade e sem cookies</span>
    <span class="url">praiometro.pt</span>
  </div>
</div>"""

html = (CARTAO
        .replace('__MARCA__', MARCA).replace('__SOL__', SOL)
        .replace('__NUVEM_SOL__', NUVEM_SOL).replace('__CHUVA__', CHUVA)
        .replace('__F_VENTO__', F_VENTO).replace('__F_CEU__', F_CEU)
        .replace('__F_AGUA__', F_AGUA).replace('__NOTA__', str(NOTA_DADOS)))


def livre():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p


destino = os.path.join(RAIZ, '_source', 'story-instagram.png')
c = Chrome(porta=livre())
try:
    c.cmd('Emulation.setDeviceMetricsOverride', width=1080, height=1920,
          deviceScaleFactor=1, mobile=False)
    c.abrir('data:text/html;charset=utf-8,' + urllib.parse.quote(html), espera=1.4)
    r = c.cmd('Page.captureScreenshot', format='png',
              clip={'x': 0, 'y': 0, 'width': 1080, 'height': 1920, 'scale': 1})
    with open(destino, 'wb') as f:
        f.write(base64.b64decode(r['data']))
finally:
    c.fechar()

print('%s — %.1f KB' % (destino, os.path.getsize(destino) / 1024.0))
