# -*- coding: utf-8 -*-
"""Bateria de verificação do «Vai dar praia?»."""
import json, os, socket, socketserver, sys, threading, http.server, time
RAIZ='/Users/renatovalente/Websites/PraiaHoje'
sys.path.insert(0, os.path.join(RAIZ,'_source'))
from cdp import Chrome
def livre():
    s=socket.socket(); s.bind(('127.0.0.1',0)); p=s.getsockname()[1]; s.close(); return p
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
PORTA=livre()
srv=socketserver.TCPServer(('127.0.0.1',PORTA), lambda *a,**k: Q(*a,directory=RAIZ,**k))
threading.Thread(target=srv.serve_forever,daemon=True).start()

CONTRASTE = r"""(function(){
  const px=s=>s.match(/[\d.]+/g).map(Number);
  const sobre=(f,b)=>{const a=f[3]===undefined?1:f[3];return [0,1,2].map(i=>f[i]*a+b[i]*(1-a));};
  const lum=c=>{const [r,g,b]=c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);});
    return .2126*r+.7152*g+.0722*b;};
  const fundo=n=>{const p=[];let e=n;
    while(e){const bg=px(getComputedStyle(e).backgroundColor);
      if(bg.length>=3&&bg[3]!==0){p.push(bg);if(bg[3]===undefined||bg[3]===1)break;}e=e.parentElement;}
    if(!p.length)return[255,255,255];let b=p[p.length-1].slice(0,3);
    for(let i=p.length-2;i>=0;i--)b=sobre(p[i],b);return b;};
  const maus=[];
  document.querySelectorAll('body *').forEach(n=>{
    if(n.children.length)return; const t=(n.textContent||'').trim(); if(!t)return;
    const cs=getComputedStyle(n);
    if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0)return;
    const r=n.getBoundingClientRect(); if(!r.width||!r.height)return;
    const f=px(cs.color),b=fundo(n); const a=lum(sobre(f,b)),bb=lum(b);
    const rc=(Math.max(a,bb)+.05)/(Math.min(a,bb)+.05);
    const s=parseFloat(cs.fontSize),g=s>=24||(s>=18.66&&+cs.fontWeight>=700);
    if(rc<(g?3:4.5))maus.push(t.slice(0,28)+' @'+Math.round(s)+'px '+rc.toFixed(2));});
  return JSON.stringify(maus.slice(0,8));})()"""

falhas=[]
def erro(m): falhas.append(m); print('   ✗ '+m)

def novo(w,h,mob):
    c=Chrome(porta=livre())
    c.cmd('Emulation.setDeviceMetricsOverride',width=w,height=h,deviceScaleFactor=1,mobile=mob)
    if mob:
        c.cmd('Emulation.setTouchEmulationEnabled', enabled=True, maxTouchPoints=5)
    c.abrir('http://127.0.0.1:%d/'%PORTA, espera=2.6)
    return c

print('\n== 1. arranque, procura e escolha ==')
for w,h,mob,rot in [(375,812,True,'telemóvel 375'),(1280,900,False,'computador 1280')]:
    c=novo(w,h,mob)
    try:
        c.js("document.querySelector('.atalho').click()"); time.sleep(5.0)
        d=json.loads(c.js("""JSON.stringify({
          resultado:!document.getElementById('resultado').hidden,
          palavra:document.getElementById('v-palavra').textContent,
          dias:document.querySelectorAll('.dia').length,
          transbordo:document.documentElement.scrollWidth+'/'+innerWidth})"""))
        ok = d['resultado'] and d['dias']==6 and d['transbordo'].split('/')[0]==d['transbordo'].split('/')[1]
        print('  %-16s %s %s' % (rot, '✓' if ok else '✗', json.dumps(d, ensure_ascii=False)))
        if not ok: erro('%s: %s'%(rot,d))
        # contraste fechado e aberto
        con=json.loads(c.js(CONTRASTE))
        c.js("document.getElementById('detalhe').open=true"); time.sleep(.6)
        con2=json.loads(c.js(CONTRASTE))
        print('  %-16s contraste fechado=%d aberto=%d' % ('', len(con), len(con2)))
        if con: erro('%s contraste: %s'%(rot,con))
        if con2: erro('%s contraste (detalhe): %s'%(rot,con2))
    finally: c.fechar()

print('\n== 2. teclado na procura ==')
c=novo(1280,900,False)
try:
    c.js("var i=document.getElementById('procura'); i.focus(); i.value='nazare'; i.dispatchEvent(new Event('input',{bubbles:true}))")
    time.sleep(.7)
    n=int(c.js("document.querySelectorAll('.sugestao[data-i]').length"))
    print('  sugestões para «nazare»:', n)
    if n<1: erro('procura sem acentos não encontrou a Nazaré')
    for _ in range(2):
        c.cmd('Input.dispatchKeyEvent', type='rawKeyDown', key='ArrowDown', code='ArrowDown', windowsVirtualKeyCode=40, nativeVirtualKeyCode=40)
        c.cmd('Input.dispatchKeyEvent', type='keyUp', key='ArrowDown', code='ArrowDown', windowsVirtualKeyCode=40, nativeVirtualKeyCode=40)
        time.sleep(.2)
    marc=c.js("document.querySelectorAll('[aria-selected=\"true\"]').length")
    print('  marcado com as setas:', marc)
    c.cmd('Input.dispatchKeyEvent', type='rawKeyDown', key='Enter', code='Enter', windowsVirtualKeyCode=13, nativeVirtualKeyCode=13)
    c.cmd('Input.dispatchKeyEvent', type='keyUp', key='Enter', code='Enter', windowsVirtualKeyCode=13, nativeVirtualKeyCode=13)
    time.sleep(5.0)
    esc=c.js("document.getElementById('v-praia').textContent")
    print('  Enter escolheu:', esc)
    if not esc: erro('Enter não escolheu praia nenhuma')
finally: c.fechar()

print('\n== 3. praia de rio (sem dados de mar) ==')
c=novo(1280,900,False)
try:
    c.js("""(function(){var i=document.getElementById('procura');
      i.value='fluvial'; i.dispatchEvent(new Event('input',{bubbles:true}));})()""")
    time.sleep(.8)
    c.js("document.querySelector('.sugestao[data-i]').click()"); time.sleep(5.0)
    d=json.loads(c.js("""JSON.stringify({praia:document.getElementById('v-praia').textContent,
      palavra:document.getElementById('v-palavra').textContent,
      factores:[...document.querySelectorAll('.factor__nome')].map(x=>x.textContent),
      nota:document.getElementById('v-nota').textContent})"""))
    c.js("document.getElementById('detalhe').open=true"); time.sleep(.5)
    d['factores']=json.loads(c.js("JSON.stringify([...document.querySelectorAll('.factor__nome')].map(x=>x.textContent))"))
    rodape=c.js("(document.querySelector('.detalhe__rodape')||{}).textContent||''")
    print('  praia:', d['praia'], '|', d['palavra'], '|', d['nota'])
    print('  factores:', d['factores'])
    if 'Água do mar' in d['factores']: erro('praia de rio não devia ter factor água')
    if 'rio' not in rodape: erro('rodapé não explica que é praia de rio: '+rodape[:80])
    else: print('  ✓ rodapé explica:', rodape[:70])
finally: c.fechar()

print('\n== 4. sem JavaScript ==')
c=Chrome(porta=livre())
try:
    c.cmd('Emulation.setScriptExecutionDisabled', value=True)
    c.cmd('Emulation.setDeviceMetricsOverride',width=375,height=812,deviceScaleFactor=1,mobile=True)
    c.abrir('http://127.0.0.1:%d/'%PORTA, espera=2.4)
    doc=c.cmd('DOM.getDocument', depth=-1)
    html=c.cmd('DOM.getOuterHTML', nodeId=doc['root']['nodeId'])['outerHTML']
    tem_aviso = 'bandeira' in html.lower()
    tem_explica = 'Como é que isto decide' in html
    print('  aviso das bandeiras presente :', tem_aviso)
    print('  explicação do modelo presente:', tem_explica)
    if not tem_aviso: erro('sem JS: falta o aviso das bandeiras')
finally: c.fechar()

srv.shutdown()
print('\n'+'='*54)
print('FALHAS: %d' % len(falhas))
for f in falhas: print('  - '+f)
print('='*54)
