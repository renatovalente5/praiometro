# -*- coding: utf-8 -*-
"""Desenha o cartão de partilha (og:image) em 1200x630, com a mesma paleta do site.

   Correr:  python3 _source/og.py

   Não é uma imagem feita à mão: é a página real renderizada em Chrome sem
   interface e fotografada. Assim, se a paleta do site mudar, muda aqui também
   — basta voltar a correr."""
import base64, os, socket, sys, time

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, '_source'))
from cdp import Chrome

def livre():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p

CARTAO = """<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1200px;height:630px;overflow:hidden}
  body{
    font-family: ui-rounded,"SF Pro Rounded","Segoe UI",system-ui,-apple-system,sans-serif;
    color:#10222e;
    background: linear-gradient(178deg,#7dd3e8 0%,#cdeef6 46%,#f3f7fa 78%);
    display:flex; flex-direction:column; justify-content:center;
    padding:0 84px; position:relative;
  }
  /* o mesmo sol do site */
  .sol{position:absolute;top:52px;right:118px;width:190px;height:190px;border-radius:50%;
       background:radial-gradient(circle,#ffe27a 0 42%,#ffd24d 58%,transparent 72%);opacity:.9}
  .mar{position:absolute;inset:auto 0 0 0;height:150px;
       background:linear-gradient(180deg,transparent,rgba(14,116,144,.16))}
  .marca{display:flex;align-items:center;gap:22px;margin-bottom:10px}
  .marca svg{width:78px;height:78px;color:#0e7490;flex:none}
  h1{font-size:96px;font-weight:800;letter-spacing:-.03em;line-height:1}
  p{font-size:37px;color:#33505f;margin-top:22px;font-weight:500}
  .semaforo{display:flex;gap:18px;margin-top:52px}
  .p{display:flex;align-items:center;gap:13px;background:#fff;
     border-radius:999px;padding:15px 27px 15px 18px;font-size:27px;font-weight:700;
     box-shadow:0 10px 26px -12px rgba(16,34,46,.4)}
  .b{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;flex:none}
  .b svg{width:64%;height:64%}
  .v .b{background:#d7f2e3;color:#0e7a4a} .v{color:#0e7a4a}
  .a .b{background:#fdf0cf;color:#8a5c00} .a{color:#8a5c00}
  .r .b{background:#fbdfdc;color:#b3261e} .r{color:#b3261e}
</style>
<div class="sol"></div><div class="mar"></div>
<div class="marca">
  <svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="12" r="6" fill="currentColor"/>
  <path d="M2 24c3 0 3-2 6-2s3 2 6 2 3-2 6-2 3 2 6 2 3-2 6-2" stroke="currentColor"
  stroke-width="2.4" stroke-linecap="round"/></svg>
  <h1>Praiómetro</h1>
</div>
<p>Escolhe a praia. Dizemos-te se vale a pena ir.</p>
<div class="semaforo">
  <span class="p v"><span class="b"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="24" cy="24" r="9" fill="currentColor" stroke="none"/><path d="M24 5v5M24 38v5M5 24h5M38 24h5M10.6 10.6l3.5 3.5M33.9 33.9l3.5 3.5M10.6 37.4l3.5-3.5M33.9 14.1l3.5-3.5"/></svg></span>Dia de praia</span>
  <span class="p a"><span class="b"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="17" cy="17" r="7" fill="currentColor" stroke="none"/><path d="M17 4v4M4 17h4M8.3 8.3l2.8 2.8"/><path d="M35 40H16a8 8 0 0 1 0-16 10 10 0 0 1 19.3-2.4A7.5 7.5 0 0 1 35 40Z" fill="#fff"/></svg></span>Assim-assim</span>
  <span class="p r"><span class="b"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M34 29H15a8 8 0 0 1 0-16 10 10 0 0 1 19.3-2.4A7.5 7.5 0 0 1 34 29Z"/><path d="M16 35l-2 6M25 35l-2 6M34 35l-2 6"/></svg></span>Hoje não</span>
</div>"""

destino = os.path.join(RAIZ, 'assets', 'img', 'og.png')
c = Chrome(porta=livre())
try:
    c.cmd('Emulation.setDeviceMetricsOverride', width=1200, height=630,
          deviceScaleFactor=1, mobile=False)
    c.abrir('data:text/html;charset=utf-8,' +
            __import__('urllib.parse', fromlist=['quote']).quote(CARTAO), espera=1.4)
    r = c.cmd('Page.captureScreenshot', format='png',
              clip={'x': 0, 'y': 0, 'width': 1200, 'height': 630, 'scale': 1})
    with open(destino, 'wb') as f:
        f.write(base64.b64decode(r['data']))
finally:
    c.fechar()

print('%s — %.1f KB' % (destino, os.path.getsize(destino) / 1024.0))
