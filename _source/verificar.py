# -*- coding: utf-8 -*-
"""Bateria de verificação do Praiómetro."""
import json, os, re, socket, socketserver, sys, threading, http.server, time
RAIZ=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
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
    /* PONTO CEGO, fechado: saltava-se qualquer nó com filhos, e por isso uma
       frase como `<p>O ponto fraco é o <b>vento</b>.</p>` escapava INTEIRA —
       só o <b> era medido, e o texto do <p> à volta dele nunca. Agora só se
       salta o que não tem texto PRÓPRIO: mede-se o nó pelo texto directo dele,
       e os filhos são medidos por sua vez, cada um com a sua cor. */
    const t=[...n.childNodes].filter(k=>k.nodeType===3)
      .map(k=>k.textContent).join('').trim();
    if(!t)return;
    const cs=getComputedStyle(n);
    /* SVG: o que pinta o texto é o `fill`, não o `color`. Sem isto o medidor
       lia a cor errada e dava por bom um rótulo que podia estar ilegível. */
    const svg = n.ownerSVGElement != null;
    if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0)return;
    const r=n.getBoundingClientRect(); if(!r.width||!r.height)return;
    /* Texto escondido à vista (.visually-hidden): 1px recortado, lido só por
       leitores de ecrã. Ninguém o VÊ, logo não tem contraste que medir — e
       media-se, e dava falsos positivos no tema escuro. */
    if(r.width<=2&&r.height<=2)return;
    if(cs.clipPath&&cs.clipPath.indexOf('inset(50%')===0)return;
    const f=px(svg && cs.fill && cs.fill!=='none' ? cs.fill : cs.color),b=fundo(n); const a=lum(sobre(f,b)),bb=lum(b);
    const rc=(Math.max(a,bb)+.05)/(Math.min(a,bb)+.05);
    const s=parseFloat(cs.fontSize),g=s>=24||(s>=18.66&&+cs.fontWeight>=700);
    if(rc<(g?3:4.5))maus.push(t.slice(0,28)+' @'+Math.round(s)+'px '+rc.toFixed(2));});
  return JSON.stringify(maus.slice(0,8));})()"""

# Quantas partes tem o dia, lido do próprio modelo: um número à mão aqui
# passaria a mentir no dia em que o modelo mudasse.
import subprocess as _sp
M_PARTES = json.loads(_sp.run(['node','-e',
  "require('%s/assets/js/modelo.js');"
  "process.stdout.write(JSON.stringify(globalThis.Modelo.PARTES.map(function(p){return p.nome;})))" % RAIZ],
  capture_output=True, text=True).stdout)

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
          /* a palavra do veredicto vive dentro da caixa das partes (junto) ou
             na frase da divisão (partido) — o selo saiu */
          palavra:(document.querySelector('.partes__palavra')||{}).textContent
                  || document.getElementById('v-resposta').textContent,
          dias:document.querySelectorAll('.dia').length,
          transbordo:document.documentElement.scrollWidth+'/'+innerWidth})"""))
        ok = d['resultado'] and d['dias']==6 and d['transbordo'].split('/')[0]==d['transbordo'].split('/')[1]
        print('  %-16s %s %s' % (rot, '✓' if ok else '✗', json.dumps(d, ensure_ascii=False)))
        if not ok: erro('%s: %s'%(rot,d))
        # Contraste com os painéis fechados e com um aberto. Esta segunda
        # medição abria o antigo <details id="detalhe">, que já não existe: a
        # chamada passou a falhar em silêncio e o teste media duas vezes a
        # mesma coisa. Agora abre um bloco, que é onde os números vivem.
        con=json.loads(c.js(CONTRASTE))
        c.js("var b=document.querySelector('button.bloco__cabeca'); if(b) b.click()")
        time.sleep(.6)
        con2=json.loads(c.js(CONTRASTE))
        print('  %-16s contraste fechado=%d aberto=%d' % ('', len(con), len(con2)))
        if con: erro('%s contraste: %s'%(rot,con))
        if con2: erro('%s contraste (com um bloco aberto): %s'%(rot,con2))
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

    # sem resultados: a mensagem tem de ir para a região live, e o aria-expanded
    # não pode dizer «expandido» sobre uma lista sem opções nenhumas
    c.js("""var i=document.getElementById('procura'); i.focus();
            i.value='zzzznaoexiste'; i.dispatchEvent(new Event('input',{bubbles:true}))""")
    time.sleep(.6)
    d=json.loads(c.js("""JSON.stringify({
      estado:document.getElementById('procura-estado').textContent,
      expandido:document.getElementById('procura').getAttribute('aria-expanded'),
      listaEscondida:document.getElementById('sugestoes').hidden,
      ad:document.getElementById('procura').getAttribute('aria-activedescendant')})"""))
    ok = 'ncontr' in d['estado'] and d['expandido']=='false' and d['listaEscondida'] and not d['ad']
    print('  sem resultados               %s  %s' % ('✓' if ok else '✗', json.dumps(d, ensure_ascii=False)))
    if not ok: erro('procura sem resultados: %s'%d)
finally: c.fechar()

print('\n== 3. praia de rio (sem dados de mar) ==')
c=novo(1280,900,False)
try:
    c.js("""(function(){var i=document.getElementById('procura');
      i.value='fluvial'; i.dispatchEvent(new Event('input',{bubbles:true}));})()""")
    time.sleep(.8)
    c.js("document.querySelector('.sugestao[data-i]').click()"); time.sleep(5.0)
    d=json.loads(c.js("""JSON.stringify({praia:document.getElementById('v-praia').textContent,
      palavra:(document.querySelector('.partes__palavra')||{}).textContent
              || document.getElementById('v-resposta').textContent,
      nota:((document.querySelector('.dia[aria-selected="true"] .dia__nota')||{}).textContent)||''})"""))
    # Os factores vivem agora dentro do painel de cada parte, e só quando aberto.
    c.js("var b=document.querySelector('button.bloco__cabeca'); if(b) b.click()"); time.sleep(.5)
    d['factores']=json.loads(c.js("JSON.stringify([...document.querySelectorAll('.nums__nome')].map(x=>x.textContent))"))
    # A explicação da praia de rio: sem ela, a ausência do factor «Água do mar»
    # lá dentro dos números lê-se como avaria. Vivia na linha da fonte dos
    # dados; essa linha saiu a pedido e a explicação ficou, sozinha.
    rodape=c.js("(document.getElementById('v-sem-mar')||{}).textContent||''")
    print('  praia:', d['praia'], '|', d['palavra'], '|', d['nota'])
    print('  factores:', d['factores'])
    if 'Água do mar' in d['factores']: erro('praia de rio não devia ter factor água')
    if 'rio' not in rodape: erro('rodapé não explica que é praia de rio: '+rodape[:80])
    else: print('  ✓ rodapé explica:', rodape[:70])
finally: c.fechar()

print('\n== 4. favoritos ==')
c=novo(375,812,True)
try:
    # marca a praia de um atalho e confirma que aparece na tira
    c.js("document.querySelector('.atalho').click()"); time.sleep(5.0)
    nome=c.js("document.getElementById('v-praia').textContent")
    c.js("document.getElementById('v-estrela').click()"); time.sleep(.4)
    d=json.loads(c.js("""JSON.stringify({
      pressed:document.getElementById('v-estrela').getAttribute('aria-pressed'),
      chips:document.querySelectorAll('.fav').length,
      guardado:localStorage.getItem('pm:favoritos'),
      seccao:!document.getElementById('favoritos').hidden})"""))
    ok = d['pressed']=='true' and d['chips']==1 and not d['seccao'] is False
    print('  marcar %-22s %s  chips=%d' % (nome[:22], '✓' if ok else '✗', d['chips']))
    if not ok: erro('marcar favorito: %s'%d)
    # a chave é a coordenada, não o nome — há 50 nomes repetidos no ficheiro
    if ',' not in (d['guardado'] or ''): erro('favorito guardado sem coordenada: %s'%d['guardado'])

    # a cor do chip TEM de ser a mesma que a praia aberta dá
    cor_chip=c.js("(document.querySelector('.fav').className.match(/fav--(\\w+)/)||[])[1]||''")
    cor_pag=c.js("document.body.getAttribute('data-cor')")
    print('  cor do chip = cor da página  %s  (%s / %s)' % ('✓' if cor_chip==cor_pag else '✗', cor_chip, cor_pag))
    if cor_chip!=cor_pag: erro('chip diz %s e a praia aberta diz %s'%(cor_chip,cor_pag))

    # sobrevive a recarregar, e a tira pinta-se com UM par de pedidos
    c.js("performance.clearResourceTimings()")
    c.abrir('http://127.0.0.1:%d/'%PORTA, espera=6.0)
    d2=json.loads(c.js("""JSON.stringify({
      chips:document.querySelectorAll('.fav').length,
      com_cor:document.querySelectorAll('.fav[class*=fav--]').length,
      com_forma:document.querySelectorAll('.fav__ponto svg').length,
      pedidos:performance.getEntriesByType('resource').filter(function(r){return r.name.indexOf('open-meteo')>0}).length})"""))
    ok2 = d2['chips']==1 and d2['com_cor']==1 and d2['com_forma']==1
    print('  depois de recarregar         %s  %s' % ('✓' if ok2 else '✗', json.dumps(d2)))
    if not ok2: erro('favoritos depois de recarregar: %s'%d2)
    # cor sozinha não chega (WCAG 1.4.1): cada chip leva também a forma
    if d2['com_cor']!=d2['com_forma']: erro('há chips com cor e sem forma')

    # desmarcar limpa tudo
    c.js("document.getElementById('v-estrela').click()"); time.sleep(.4)
    d3=json.loads(c.js("""JSON.stringify({
      pressed:document.getElementById('v-estrela').getAttribute('aria-pressed'),
      escondida:document.getElementById('favoritos').hidden,
      guardado:localStorage.getItem('pm:favoritos')})"""))
    ok3 = d3['pressed']=='false' and d3['escondida'] and d3['guardado']=='[]'
    print('  desmarcar                    %s  %s' % ('✓' if ok3 else '✗', json.dumps(d3)))
    if not ok3: erro('desmarcar favorito: %s'%d3)
finally: c.fechar()

print('\n== 5. conta ==')
c=novo(375,812,True)
try:
    d=json.loads(c.js("""JSON.stringify({
      entrar:!document.getElementById('conta-entrar').hidden,
      menu:!document.getElementById('conta-menu').hidden,
      disponivel:window.Conta.disponivel(),
      sessao:window.Conta.activa(),
      pedidos:performance.getEntriesByType('resource').filter(function(r){return r.name.indexOf('supabase')>0}).length})"""))
    # sem sessão o site não pode falar com o Supabase: quem só vê a praia fica anónimo
    ok = d['pedidos']==0 and not d['sessao'] and not d['menu'] and d['entrar']==d['disponivel']
    print('  sem sessão                   %s  %s' % ('✓' if ok else '✗', json.dumps(d)))
    if d['pedidos']: erro('sem sessão houve %d pedidos ao Supabase'%d['pedidos'])
    if d['entrar']!=d['disponivel']: erro('botão Entrar visível=%s mas Google pronto=%s'%(d['entrar'],d['disponivel']))

    # com sessão falsa: a interface tem de trocar por completo
    c.js("""localStorage.setItem('pm:sessao', JSON.stringify({
      access_token:'x', refresh_token:'y', expira: 4102444800000,
      id:'00000000-0000-0000-0000-000000000009', email:'a@b.pt', nome:'Zé Teste', foto:''}))""")
    c.abrir('http://127.0.0.1:%d/'%PORTA, espera=3.0)
    d2=json.loads(c.js("""JSON.stringify({
      entrar:getComputedStyle(document.getElementById('conta-entrar')).display!=='none',
      menu:getComputedStyle(document.getElementById('conta-menu')).display!=='none',
      inicial:document.getElementById('conta-inicial').textContent,
      nome:document.getElementById('conta-nome').textContent})"""))
    ok2 = (not d2['entrar']) and d2['menu'] and d2['inicial']=='Z'
    print('  com sessão                   %s  %s' % ('✓' if ok2 else '✗', json.dumps(d2, ensure_ascii=False)))
    if d2['entrar']: erro('«Entrar» continua visível com sessão aberta (regra [hidden] em falta?)')
    if not ok2: erro('interface da conta com sessão: %s'%d2)
    # carregar mesmo em «Entrar» e ver onde se aterra. É o mais longe que se vai
    # sem escrever a palavra-passe de alguém: se o client_id ou o redirect_uri
    # estiverem errados, o Google devolve um erro em vez do ecrã de entrada.
    if c.js("window.Conta.disponivel()") in (True, 'true'):
        try:
            c.js("localStorage.clear(); sessionStorage.clear()")
            c.abrir('http://127.0.0.1:%d/'%PORTA, espera=2.0)
            # O verificador é gravado de forma SÍNCRONA, antes da promessa e antes
            # da navegação: lê-se aqui, na nossa origem. Depois do salto para o
            # accounts.google.com o sessionStorage já é o deles, não o nosso.
            verif = c.js("(function(){ window.Conta.entrar(); return sessionStorage.getItem('pm:pkce') || ''; })()")
            if len(verif or '') < 40:
                erro('verificador PKCE não ficou em sessionStorage (%d caracteres)'%len(verif or ''))
            else:
                print('  verificador PKCE guardado    ✓  %d caracteres' % len(verif))
            time.sleep(6.0)
            destino = c.js("location.origin + location.pathname")
            ok5 = 'accounts.google.com' in (destino or '')
            print('  «Entrar» chega ao Google     %s  %s' % ('✓' if ok5 else '✗', destino))
            if not ok5:
                erro('«Entrar» não chegou ao Google: %s'%destino)
        except Exception as e:
            print('  ⚠ não foi possível testar a ida ao Google (rede?):', e)
        c.abrir('http://127.0.0.1:%d/'%PORTA, espera=2.0)
        c.js("""localStorage.setItem('pm:sessao', JSON.stringify({
          access_token:'x', refresh_token:'y', expira: 4102444800000,
          id:'00000000-0000-0000-0000-000000000009', email:'a@b.pt', nome:'Zé Teste', foto:''}))""")
        c.abrir('http://127.0.0.1:%d/'%PORTA, espera=2.5)

    # fila das operações que a rede não deixou cumprir
    d4=json.loads(c.js("""(function(){
      localStorage.removeItem('pm:pendentes');
      window.Conta.adiar({op:'del', id:'40.1000,-8.1000', n:'A'});
      window.Conta.adiar({op:'add', id:'41.2000,-8.2000', n:'B'});
      var antes = window.Conta.pendentes().length;
      // a última acção sobre a MESMA praia manda: marcar e desmarcar sem rede
      window.Conta.adiar({op:'add', id:'40.1000,-8.1000', n:'A'});
      var v = window.Conta.pendentes();
      var so = v.filter(function(x){return x.id==='40.1000,-8.1000'});
      return JSON.stringify({antes:antes, depois:v.length, duplicadas:so.length, opFinal:so[0]&&so[0].op});
    })()"""))
    ok4 = d4['antes']==2 and d4['depois']==2 and d4['duplicadas']==1 and d4['opFinal']=='add'
    print('  fila de operações por cumprir %s  %s' % ('✓' if ok4 else '✗', json.dumps(d4)))
    if not ok4: erro('fila de pendentes: %s'%d4)
    c.js("localStorage.removeItem('pm:pendentes')")

    # o menu é um <details>: tem de fechar ao carregar fora e com Escape
    c.js("document.getElementById('conta-menu').open = true"); time.sleep(.3)
    c.js("document.body.click()"); time.sleep(.3)
    fora = c.js("document.getElementById('conta-menu').open")
    c.js("document.getElementById('conta-menu').open = true"); time.sleep(.3)
    c.cmd('Input.dispatchKeyEvent', type='rawKeyDown', key='Escape', code='Escape', windowsVirtualKeyCode=27, nativeVirtualKeyCode=27)
    c.cmd('Input.dispatchKeyEvent', type='keyUp', key='Escape', code='Escape', windowsVirtualKeyCode=27, nativeVirtualKeyCode=27)
    time.sleep(.3)
    esc = c.js("document.getElementById('conta-menu').open")
    foco = c.js("document.activeElement.tagName")
    print('  menu fecha fora/Escape       %s  (fora=%s escape=%s foco=%s)'
          % ('✓' if (fora in (False,'false') and esc in (False,'false')) else '✗', fora, esc, foco))
    if fora not in (False,'false'): erro('o menu da conta não fecha ao carregar fora')
    if esc not in (False,'false'): erro('o menu da conta não fecha com Escape')
    if foco != 'SUMMARY': erro('Escape fechou o menu mas o foco ficou em %s'%foco)
    c.js("localStorage.clear()")
finally: c.fechar()

print('\n== 5b. armazenamento bloqueado (modo privado) ==')
c=novo(375,812,True)
try:
    # o Safari em navegação privada atira em setItem; aqui atira em tudo
    c.js("""(function(){
      var mau = { getItem:function(){throw new DOMException('x')},
                  setItem:function(){throw new DOMException('QuotaExceededError')},
                  removeItem:function(){throw new DOMException('x')},
                  clear:function(){throw new DOMException('x')} };
      Object.defineProperty(window,'localStorage',{configurable:true,value:mau});
      Object.defineProperty(window,'sessionStorage',{configurable:true,value:mau});
      window.__erros = [];
      addEventListener('error', function(e){ window.__erros.push(String(e.message)) });
      addEventListener('unhandledrejection', function(e){ window.__erros.push('promessa: '+e.reason) });
    })()""")
    for f in ['assets/js/favoritos.js', 'assets/js/conta.js']:
        c.js("var s=document.createElement('script');s.src='%s?t='+performance.now();document.head.appendChild(s)"%f)
        time.sleep(.5)
    d=json.loads(c.js("""JSON.stringify({
      favoritos: typeof window.Favoritos === 'object',
      conta: typeof window.Conta === 'object',
      lista: (function(){try{return window.Favoritos.lista().length}catch(e){return 'EXCEPCAO'}})(),
      marcar: (function(){try{return window.Favoritos.alternar({n:'X',la:40,lo:-8})}catch(e){return 'EXCEPCAO'}})(),
      sessao: (function(){try{return String(window.Conta.activa())}catch(e){return 'EXCEPCAO'}})(),
      erros: window.__erros})"""))
    ok = d['favoritos'] and d['conta'] and d['lista']==0 and d['marcar']=='marcada' and not d['erros']
    print('  tudo a atirar excepções       %s  %s' % ('✓' if ok else '✗', json.dumps(d)))
    if not ok: erro('armazenamento bloqueado: %s'%d)
finally: c.fechar()

print('\n== 6. página de privacidade ==')
for w,h,mob,rot in [(375,812,True,'telemóvel'),(1280,900,False,'computador')]:
    c=Chrome(porta=livre())
    try:
        c.cmd('Emulation.setDeviceMetricsOverride',width=w,height=h,deviceScaleFactor=1,mobile=mob)
        c.abrir('http://127.0.0.1:%d/privacidade.html'%PORTA, espera=1.6)
        con=json.loads(c.js(CONTRASTE))
        d=json.loads(c.js("""JSON.stringify({
          transbordo:document.documentElement.scrollWidth+'/'+innerWidth,
          h2:document.querySelectorAll('h2').length,
          pendentes:document.querySelectorAll('.texto__pendente').length,
          volta:!!document.querySelector('.texto__voltar a')})"""))
        ok = d['transbordo'].split('/')[0]==d['transbordo'].split('/')[1] and d['volta'] and not con
        print('  %-11s %s contraste=%d %s' % (rot, '✓' if ok else '✗', len(con), json.dumps(d)))
        if con: erro('privacidade %s contraste: %s'%(rot,con))
        if not ok: erro('privacidade %s: %s'%(rot,d))
        if d['pendentes']: erro('privacidade: %d bloco(s) ainda por preencher'%d['pendentes'])
    finally: c.fechar()

print('\n== 6b. o mapa «Onde fica» ==')
c=novo(375,812,True)
try:
    c.js("document.querySelector('.atalho').click()"); time.sleep(7.0)
    d=json.loads(c.js('''JSON.stringify({
      visivel: !document.getElementById('mapa').hidden,
      formas: document.querySelectorAll('.m-terra').length,
      rotulos: [...document.querySelectorAll('.m-nome')].map(t=>t.textContent),
      ponto: !!document.querySelector('.m-ponto'),
      fora: [...document.querySelectorAll('.m-nome')].filter(t=>{
        const b=t.getBBox(); return b.x<0 || b.x+b.width>640; }).map(t=>t.textContent),
      transbordo: document.documentElement.scrollWidth+'/'+innerWidth})'''))
    print('  desenhado    %s  %d formas, %d rótulos' % ('✓' if d['visivel'] else '✗', d['formas'], len(d['rotulos'])))
    if not d['visivel']: erro('o mapa não apareceu')
    if d['formas'] < 3: erro('o mapa tem só %d formas — a vista está vazia' % d['formas'])
    if not d['ponto']: erro('o mapa não marca a praia')
    if d['fora']: erro('rótulos fora da tela: %s' % d['fora'])
    else: print('  rótulos      ✓ todos dentro da tela')
    if d['transbordo'].split('/')[0] != d['transbordo'].split('/')[1]:
        erro('o mapa faz a página transbordar: %s' % d['transbordo'])

    # O MAPA ALINHA COM OS IRMÃOS. Teve um gutter próprio por cima do gutter do
    # <section class="resultado"> que o contém, e ficava 16 px para dentro de
    # cada lado — 311 px onde o aviso das bandeiras media 343. Compara-se com o
    # aviso porque é o vizinho de baixo, que é onde a diferença se via.
    torto=False
    for larg in (375, 700, 1000):
        c.cmd('Emulation.setDeviceMetricsOverride', width=larg, height=900,
              deviceScaleFactor=1, mobile=larg < 620)
        time.sleep(.45)
        cx=json.loads(c.js('''JSON.stringify(['.mapa__tela', '.aviso-bandeiras'].map(function (k) {
          var r = document.querySelector(k).getBoundingClientRect();
          return [Math.round(r.left), Math.round(r.width)]; }))'''))
        if cx[0] != cx[1]:
            torto=True
            erro('a %d px o mapa não alinha com o aviso: tela %s, aviso %s' % (larg, cx[0], cx[1]))
    if not torto: print('  alinhado     ✓ a mesma largura do aviso a 375, 700 e 1000 px')
    c.cmd('Emulation.setDeviceMetricsOverride', width=375, height=812, deviceScaleFactor=1, mobile=True)

    # A PROMESSA: o mapa existe para não haver pedidos a terceiros. Se um dia
    # alguém trocar isto por tiles, o site passa a mandar o IP de quem visita
    # para outro servidor — e a página do Perfil promete o contrário.
    hosts=json.loads(c.js('''JSON.stringify([...new Set(
      performance.getEntriesByType('resource')
        .map(r=>new URL(r.name).host).filter(h=>h!==location.host))])'''))
    permitidos={'api.open-meteo.com','marine-api.open-meteo.com'}
    intrusos=[h for h in hosts if h not in permitidos]
    if intrusos: erro('o site contactou servidores que não devia: %s' % intrusos)
    else: print('  sem terceiros ✓ só %s' % ', '.join(sorted(hosts)))
finally: c.fechar()

print('\n== 6c. as duas partes do dia ==')
c=novo(375,812,True)
try:
    c.js("document.querySelector('.atalho').click()"); time.sleep(6.0)
    modos={'junto':0,'partido':0,'sem':0}
    for dia in range(6):
        c.js("document.getElementById('dia-%d').click()" % dia); time.sleep(.4)
        d=json.loads(c.js(r"""JSON.stringify({
          classe: document.getElementById('v-partes').className,
          resposta: document.getElementById('v-resposta').textContent,
          fatias: [...document.querySelectorAll('.fatia')].map(x => ({
            nome: (x.querySelector('.fatia__nome')||{}).textContent,
            nota: (x.querySelector('.fatia__nota')||{}).textContent,
            lido: (x.querySelector('.visually-hidden')||{}).textContent})),
          blocos: [...document.querySelectorAll('.bloco')].map(x => ({
            nome: (x.querySelector('.bloco__nome')||{}).textContent,
            palavra: (x.querySelector('.bloco__palavra')||{}).textContent,
            nota: ((x.querySelector('.bloco__nota')||{}).textContent) || '',
            cor: [...x.classList].filter(k => k.indexOf('parte--') === 0 && k !== 'parte--passou')[0] || '',
            temIcone: !!x.querySelector('.bloco__icone svg'),
            lido: (x.querySelector('.visually-hidden')||{}).textContent})),
          palavraJunto: (document.querySelector('.partes__palavra')||{}).textContent || '',
          iconeJunto: !!document.querySelector('.partes__icone svg'),
          notaDoDia: ((document.querySelector('.dia[aria-selected="true"] .dia__nota')||{}).textContent) || '',
          transbordo: document.documentElement.scrollWidth+'/'+innerWidth})"""))
        # A MANHÃ E A TARDE SÃO SEMPRE DOIS BLOCOS. Houve uma versão em que os
        # dias iguais vinham num bloco só, e o cartão mudava de feitio
        # consoante o dia. Se voltar, isto apanha.
        if not d['blocos']:
            print('  dia %d        · sem previsão para as duas partes' % dia)
            modos['sem'] += 1; continue
        if len(d['blocos']) != 2:
            erro('dia %d: %d blocos, deviam ser sempre 2' % (dia, len(d['blocos']))); continue
        if d['fatias']:
            erro('dia %d: voltou o estado de bloco único (%d fatias)' % (dia, len(d['fatias'])))
        for b in d['blocos']:
            if not b['palavra']: erro('dia %d: bloco sem palavra' % dia)
            if b['nota'] and not b['temIcone']: erro('dia %d: bloco com nota e sem ícone' % dia)
        notas = [b['nota'] for b in d['blocos'] if b['nota']]
        nomes = [b['nome'] for b in d['blocos']]
        cores = [b['cor'] for b in d['blocos']]
        difere = cores[0] != cores[1]
        modos['partido' if difere else 'junto'] += 1
        # A frase por cima só quando uma das partes NÃO TEM número: aí não há
        # nada no bloco que explique porquê. Quando as duas têm nota, os dois
        # blocos já dizem qual é a melhor, e repeti-lo por extenso («A manhã
        # está melhor») era dizer duas vezes a mesma coisa — saiu a pedido.
        semNumero = any(not b['nota'] for b in d['blocos'])
        diaSemNota = not d['notaDoDia']
        if semNumero and not d['resposta']:
            erro('dia %d: uma parte sem número e sem frase a explicar porquê' % dia)
        # O DIA pode chumbar COM AS DUAS PARTES SÃS: a chuva conta os milímetros
        # por soma e o dia é a união exacta das duas partes — 1,2 mm de manhã e
        # 1,2 à tarde passam as duas e o dia chumba nos 2. Aí a razão TEM de
        # estar escrita; senão ficam dois blocos verdes debaixo de um cartão
        # vermelho e nada no ecrã diz «chuva a sério».
        if diaSemNota and not semNumero and not d['resposta']:
            erro('dia %d: o dia chumbou com as duas partes sãs e nada o explica' % dia)
        if not semNumero and not diaSemNota and d['resposta']:
            erro('dia %d: nada falta e há frase por cima: %r' % (dia, d['resposta']))

        if [n.split(' ·')[0] for n in nomes] != ['Manhã','Tarde']:
            erro('dia %d: nomes das partes: %s' % (dia, nomes))

        # A ARITMÉTICA FECHA À VISTA. É a queixa que originou este desenho, e
        # esta é a asserção que impede que volte. A linha «Nota do dia 74 em
        # 100» saiu do cartão a pedido — mas a nota do dia NÃO saiu do ecrã:
        # está na célula deste dia, na tira, e é essa que tem de ser a média das
        # duas que estão nos blocos. floor(x+0.5) e não round(): o Python
        # arredonda 80,5 para 80 e o Math.round do JS para 81.
        # Um dia sem número é legítimo (veto) e é tratado acima: aqui só se
        # verifica que, QUANDO há número, ele é mesmo a média das duas.
        if len(notas) == 2 and not diaSemNota:
            media = int(sum(int(n) for n in notas)/2 + 0.5)
            if int(d['notaDoDia']) != media:
                erro('dia %d: a tira diz %s e a média das duas é %d — %s'
                     % (dia, d['notaDoDia'], media, notas))
        if d['transbordo'].split('/')[0] != d['transbordo'].split('/')[1]:
            erro('dia %d: o cartão faz transbordar (%s)' % (dia, d['transbordo']))
    print('  6 dias        ✓ sempre dois blocos — %d com cores iguais, %d diferentes, %d sem dados'
          % (modos['junto'], modos['partido'], modos['sem']))

    # A LEI: NENHUM NÚMERO SEM A SUA PALAVRA AO LADO. É o que cura o 76 amarelo
    # encostado ao 73 verde — deixa de ser contradição e passa a classificação.
    orfaos=json.loads(c.js(r"""(function(){
      var maus = [];
      document.querySelectorAll('.fatia').forEach(function (x) {
        if (x.querySelector('.fatia__nota') && !x.querySelector('.fatia__nome')) maus.push('fatia');
      });
      document.querySelectorAll('.bloco').forEach(function (x) {
        if (x.querySelector('.bloco__nota') && !x.querySelector('.bloco__palavra')) maus.push('bloco');
      });
      document.querySelectorAll('.dia').forEach(function (x) {
        if (x.querySelector('.dia__nota') && !x.querySelector('.dia__palavra')) maus.push('dia');
      });
      return JSON.stringify(maus);})()"""))
    if orfaos: erro('há números sem palavra ao lado: %s' % orfaos)
    else: print('  a lei          ✓ nenhum número aparece sem a sua palavra')

    # As partes dizem-se por nome, nunca por hora de relógio.
    horas=json.loads(c.js(r"""JSON.stringify(
      (document.getElementById('veredicto').innerText.match(/\d+\s*h\b(?!\/)/g) || []))"""))
    if horas: erro('o cartão mostra horas de relógio: %s' % horas)
    else: print('  sem relógio   ✓ diz «Manhã» e «Tarde», e mais nada')

    # O «✕» saiu: lê-se como avaria ou como «fechado», nunca como «não vale a pena».
    if '✕' in c.js("document.getElementById('resultado').innerText"):
        erro('o ✕ voltou ao ecrã')
    else: print('  sem ✕          ✓ onde não há nota, há palavras')

    con=json.loads(c.js(CONTRASTE))
    if con: erro('contraste no cartão: %s' % con)
    else: print('  contraste     ✓ limpo')

    d=json.loads(c.js(r"""JSON.stringify({
      dias: document.querySelectorAll('.dia').length,
      /* UMA fila: todas as células com o mesmo topo. Contar colunas deixou de
         servir — com grid-auto-flow: column as faixas são implícitas e o
         gridTemplateColumns computa para «none». */
      linhas: [...new Set([...document.querySelectorAll('.dia')].map(
        x => Math.round(x.getBoundingClientRect().top)))].length,
      largura: Math.round((document.querySelector('.dia')||{getBoundingClientRect:()=>({width:0})}).getBoundingClientRect().width),
      rolo: document.getElementById('dias').scrollWidth > document.getElementById('dias').clientWidth + 1,
      roloPagina: document.documentElement.scrollWidth > innerWidth + 1,
      palavras: [...document.querySelectorAll('.dia__palavra')].map(x => x.textContent).filter(Boolean).length})"""))
    antes = len(falhas)
    if d['dias'] != 6: erro('a tira deixou de ter 6 dias: %d' % d['dias'])
    if d['linhas'] != 1: erro('a tira partiu-se em %d linhas — devia ser uma fila' % d['linhas'])
    # A célula tem de manter o tamanho que tem no computador. Houve uma versão
    # a apertar os seis para dentro dos 375 px: davam 53 px cada, obrigavam a
    # abreviar «Amanhã» e a palavra partia-se em três linhas. Saiu a pedido.
    if d['largura'] < 88: erro('a célula encolheu para %d px — devia ficar nos ~90' % d['largura'])
    # A tira ROLA no telemóvel, e é assim de propósito: os seis ao tamanho do
    # computador não cabem em 343 px de cartão. O que NÃO pode rolar é a página.
    if not d['rolo']: erro('a tira devia rolar a 375 px e não rola')
    if d['roloPagina']: erro('é a PÁGINA que rola na horizontal, e não só a tira')
    if d['palavras'] != 6: erro('só %d dos 6 dias têm palavra' % d['palavras'])
    # Só a seguir a nenhum ✗: um ✓ por baixo de um erro lê-se como aprovação
    # daquilo que acabou de falhar.
    if len(falhas) == antes:
        print('  tira          ✓ 6 dias numa fila de %d px, a tira rola e a página não' % d['largura'])

    # O que rebenta primeiro numa tira apertada é o TEXTO a passar por cima do
    # contorno — aconteceu duas vezes seguidas («Amanhã» a medir 47,5 px numa
    # célula com 46 úteis, e a terceira linha da palavra cortada) e nenhuma das
    # contas anteriores dava por isso, porque contam colunas e não pixéis.
    fora=json.loads(c.js(r"""JSON.stringify(
      [...document.querySelectorAll('.dia')].flatMap(function (cel) {
        var r = cel.getBoundingClientRect(), cs = getComputedStyle(cel);
        var e = parseFloat(cs.paddingLeft), d = parseFloat(cs.paddingRight);
        return [...cel.children].filter(function (k) {
          var q = k.getBoundingClientRect();
          return q.width > r.width - 4 - e - d + .5 || q.bottom > r.bottom - 1;
        }).map(function (k) { return k.className + ' "' + k.innerText.replace(/\s+/g, ' ') + '"'; });
      }))"""))
    if fora: erro('texto a sair da célula do dia: %s' % fora)
    else: print('  cabe na fila  ✓ nome, nota e palavra dentro da célula')

    alturas=json.loads(c.js(r"""JSON.stringify([...new Set(
      [...document.querySelectorAll('.dia')].map(function (x) {
        return Math.round(x.getBoundingClientRect().height); }))])"""))
    if len(alturas) != 1: erro('as seis células ficaram com alturas diferentes: %s' % alturas)
    else: print('  fila direita  ✓ as seis células com a mesma altura (%d px)' % alturas[0])

    # O ANEL DO DIA ESCOLHIDO, e o dia escolhido À VISTA. Os dois já se
    # partiram nesta tira: o `overflow-x` cortava os 2 px do anel do lado
    # esquerdo (contorno reto à esquerda e redondo à direita, commit b7cd579),
    # e o innerHTML novo do `desenharDias` punha o `scrollLeft` a zero — quem
    # rolasse até «Segunda» e lhe tocasse via-a sair do ecrã.
    def tira():
        return json.loads(c.js(r"""JSON.stringify((function () {
          var t = document.getElementById('dias');
          var sel = t.querySelector('.dia[aria-selected="true"]');
          var tr = t.getBoundingClientRect(), sr = sel.getBoundingClientRect();
          return { qual: sel.querySelector('.dia__nome').innerText.trim(),
                   esq: Math.round(sr.left - tr.left), dir: Math.round(tr.right - sr.right),
                   dentro: sr.left >= tr.left - .5 && sr.right <= tr.right + .5 };})())"""))
    c.js("document.getElementById('dia-0').click()"); time.sleep(.6)
    d0 = tira()
    if d0['esq'] < 3: erro('o anel do dia escolhido fica cortado à esquerda (folga %d px)' % d0['esq'])
    c.js("document.getElementById('dia-5').click()"); time.sleep(.6)
    d5 = tira()
    if not d5['dentro']: erro('escolher o último dia deixa-o fora de vista: %s' % d5)
    elif d5['dir'] < 3: erro('o anel do último dia fica cortado à direita (folga %d px)' % d5['dir'])
    else: print('  anel e rolo   ✓ folga de 3 px nos dois topos, e o dia escolhido vem à vista')

    # E EM CIMA. `overflow-x: auto` obriga o `overflow-y` a passar de `visible`
    # a `auto`: uma tira que rola aos lados corta TAMBÉM em cima e em baixo. Já
    # aconteceu duas vezes — nos favoritos e agora nos dias — e a segunda foi
    # pior, porque ao anel de 3 px do escolhido soma-se o `:hover` que levanta o
    # cartão 2. Mede-se em repouso E com o cartão levantado, que é o estado em
    # que um telemóvel fica depois do toque.
    def folgas():
        return json.loads(c.js(r"""JSON.stringify(
          ['#dias', '.favoritos__lista'].flatMap(function (k) {
            var t = document.querySelector(k);
            if (!t || getComputedStyle(t).overflowX === 'visible') return [];
            var tr = t.getBoundingClientRect();
            return [...t.children].flatMap(function (x) {
              var r = x.getBoundingClientRect();
              var n = (getComputedStyle(x).boxShadow.match(/-?\d+(?:\.\d+)?px/g) || []).map(parseFloat);
              var esp = n.length >= 4 ? n[3] + n[2] : 0;          /* espalhamento + desfoque */
              var cima = (r.top - esp) - tr.top, baixo = tr.bottom - (r.bottom + esp);
              return (cima < -.5 || baixo < -.5)
                ? [k + ' «' + x.innerText.replace(/\s+/g, ' ').slice(0, 12) + '»: cima ' +
                   cima.toFixed(1) + ', baixo ' + baixo.toFixed(1)] : [];
            });
          }))"""))
    r = folgas()
    if r: erro('contorno cortado na vertical: %s' % r)
    # O :hover colado depois do toque — o estado real de um telemóvel.
    c.js("""(function(){
      /* O levantar LÊ-SE da folha de estilo, não se escreve aqui à mão: senão,
         quem aumentasse o translateY do :hover passava por esta guarda sem ela
         dar por nada, e o corte voltava. */
      var alto = 0;
      [...document.styleSheets].forEach(function (ss) {
        /* `if (r.cssRules) return anda(...)` NÃO serve: desde o CSS Nesting,
           no Chrome TODA a regra de estilo tem um `cssRules` vazio — que é
           verdadeiro — e a regra era tratada como contentor sem nunca se lhe
           olhar para o selector. Custou-me duas mutações a passar em falso:
           `alto` ficava a 0, não se levantava nada, e a guarda dizia ✓ com o
           contorno cortado. Por isso: primeiro o selector, e só se desce onde
           há mesmo filhos. */
        try { (function anda(rs) { [...rs].forEach(function (r) {
          if (r.selectorText === '.dia:hover' && r.style && r.style.transform) {
            var m = r.style.transform.match(/translateY\((-?[\d.]+)px\)/);
            if (m) alto = Math.max(alto, Math.abs(parseFloat(m[1])));
          }
          if (r.cssRules && r.cssRules.length) anda(r.cssRules);
        });})(ss.cssRules); } catch (e) {}
      });
      if (!alto) throw new Error('não encontrei o translateY do .dia:hover');
      var s = document.createElement('style'); s.id = 'forcar-hover';
      s.textContent = '.dia[aria-selected="true"]{transform:translateY(-' + alto + 'px)}';
      document.head.appendChild(s);
      return alto;})()"""); time.sleep(.4)
    rh = folgas()
    c.js("document.getElementById('forcar-hover').remove()")
    if rh: erro('com o cartão levantado, o contorno é cortado: %s' % rh)
    if not r and not rh: print('  anel inteiro  ✓ nada cortado em cima nem em baixo, levantado ou não')
    c.js("document.getElementById('dia-0').click()"); time.sleep(.4)
finally: c.fechar()

print('\n== 6d. o dia que chumba com as duas partes sãs ==')
# NÃO é um caso teórico e NÃO acontece na previsão de hoje, por isso tem de ser
# forçado: o veto da chuva conta os milímetros por SOMA e o dia é a união exacta
# das duas partes, logo 1,2 mm de manhã e 1,2 à tarde passam as duas — o veto é
# aos 2 — e o dia chumba em 2,4. Enquanto o cartão teve a linha «Nota do dia»,
# era ela que dizia «Hoje não tem nota: chuva a sério». Essa linha saiu a pedido,
# e sem esta guarda o ecrã volta a ficar com barra vermelha por cima de dois
# blocos verdes de 94 sem nada a explicar porquê.
ENXERTO = r"""
(function () {
  var t = setInterval(function () {
    if (!window.Modelo || !window.Modelo.avaliarDia) return;
    clearInterval(t);
    var orig = window.Modelo.avaliarDia, n = 0;
    window.Modelo.avaliarDia = function () {
      var r = orig.apply(this, arguments);
      if (n++ === 0 && r && r.v && r.partes[0] && r.partes[0].v && r.partes[1] && r.partes[1].v) {
        r.v.nota = null; r.v.cor = 'vermelho'; r.v.vetos = ['chuva a sério'];
        r.partes[0].v.nota = 94; r.partes[0].v.cor = 'verde'; r.partes[0].v.vetos = [];
        r.partes[1].v.nota = 94; r.partes[1].v.cor = 'verde'; r.partes[1].v.vetos = [];
      }
      return r;
    };
  }, 5);
})();
"""
c=Chrome(porta=livre())
try:
    c.cmd('Emulation.setDeviceMetricsOverride',width=375,height=812,deviceScaleFactor=1,mobile=True)
    c.cmd('Page.addScriptToEvaluateOnNewDocument', source=ENXERTO)
    c.abrir('http://127.0.0.1:%d/'%PORTA, espera=2.6)
    c.js("document.querySelector('.atalho').click()"); time.sleep(5.5)
    d=json.loads(c.js(r"""JSON.stringify({
      resposta: document.getElementById('v-resposta').textContent,
      notas: [...document.querySelectorAll('.bloco__nota')].map(x => x.textContent),
      notaTira: ((document.querySelector('.dia[aria-selected="true"] .dia__nota')||{}).textContent)||'',
      cor: document.body.getAttribute('data-cor')})"""))
    if d['notas'] != ['94','94'] or d['cor'] != 'vermelho':
        print('  · o enxerto não pegou (%s / %s) — secção sem valor nesta corrida' % (d['notas'], d['cor']))
    elif d['notaTira']:
        erro('o dia chumbou e a tira continua a mostrar %s' % d['notaTira'])
    elif not d['resposta'].strip():
        erro('cartão vermelho, dois blocos verdes de 94 e nada no ecrã a explicar porquê')
    elif 'chuva' not in d['resposta']:
        erro('a linha não nomeia o veto: %r' % d['resposta'])
    else:
        print('  dia chumbado  ✓ %r' % d['resposta'])
finally: c.fechar()

print('\n== 6c-ter. o tema escuro ==')
# O medidor corria só em tema claro, e por isso nunca soube que o atalho
# «Saltar para o resultado» estava a 2,14:1 no escuro. Um site que se pinta
# sozinho conforme o telemóvel tem de ser medido nos dois.
c=Chrome(porta=livre())
try:
    c.cmd('Emulation.setDeviceMetricsOverride', width=375, height=812, deviceScaleFactor=1, mobile=True)
    c.cmd('Emulation.setEmulatedMedia', features=[{'name':'prefers-color-scheme','value':'dark'}])
    c.abrir('http://127.0.0.1:%d/'%PORTA, espera=2.6)
    c.js("document.querySelector('.atalho').click()"); time.sleep(6.0)
    mau=[]
    for dia in range(6):
        c.js("document.getElementById('dia-%d').click()" % dia); time.sleep(.3)
        mau += json.loads(c.js(CONTRASTE))
    # Com um bloco ABERTO: é onde os números vivem, e é a zona mais apertada do
    # ficheiro — texto pequeno sobre o fundo pastel. Esta medição já apanhou o
    # «já passou» a 3,96:1, que só existia no escuro e só depois das 13h.
    c.js("var b=document.querySelector('button.bloco__cabeca'); if(b) b.click()")
    time.sleep(.6)
    mau += json.loads(c.js(CONTRASTE))
    # e com o atalho em foco, que é a única altura em que se vê
    c.js("document.querySelector('.salta').focus()"); time.sleep(.3)
    mau += json.loads(c.js(CONTRASTE))
    if mau: erro('contraste no tema escuro: %s' % sorted(set(mau))[:6])
    else: print('  contraste     ✓ limpo no escuro, 6 dias, painel aberto e atalho em foco')
finally: c.fechar()

print('\n== 6c-bis. os números, dentro de cada parte ==')
c=novo(375,812,True)
try:
    c.js("document.querySelector('.atalho').click()"); time.sleep(6.0)
    d=json.loads(c.js(r"""JSON.stringify({
      cabs: [...document.querySelectorAll('.bloco__cabeca')].map(function(x){return {
        tag: x.tagName.toLowerCase(), exp: x.getAttribute('aria-expanded'),
        controla: x.getAttribute('aria-controls'), parte: x.parentNode.getAttribute('data-parte'),
        alto: Math.round(x.getBoundingClientRect().height)};}),
      abertos: document.querySelectorAll('.bloco__numeros:not([hidden])').length,
      pista: document.getElementById('v-pista') ? !document.getElementById('v-pista').hidden : null,
      fonte: (document.querySelector('.rodape__fontes')||{}).textContent || '',
      detalheMorreu: !document.getElementById('detalhe')})"""))
    if d['cabs'] and any(x['tag'] != 'button' for x in d['cabs']):
        print('  · há partes sem números — a cabeça não é botão, como deve')
    if not all(x['exp'] == 'false' for x in d['cabs'] if x['tag'] == 'button'):
        erro('ao chegar, os blocos deviam estar todos fechados: %s' % d['cabs'])
    if d['abertos']: erro('ao chegar há %d painéis abertos' % d['abertos'])
    if not d['pista']: erro('sem o convite escrito, a descoberta fica só na seta')
    if not d['detalheMorreu']: erro('o «Ver os números» ainda existe — dois sítios com os mesmos números')
    # A área de toque: 44px é o mínimo, e a cabeça é o maior botão da página.
    baixos = [x for x in d['cabs'] if x['tag'] == 'button' and x['alto'] < 44]
    if baixos: erro('cabeças com menos de 44px de altura: %s' % baixos)
    # A atribuição vivia no fim do cartão e saiu a pedido. A licença NÃO deixa
    # de existir por isso: mudou-se para o rodapé da página, e o DWD — que a
    # documentação marinha exige e que só vivia naquela linha — foi com ela.
    faltam = [n for n in ('Open-Meteo', 'DWD') if n not in d['fonte']]
    if faltam: erro('a atribuição a %s desapareceu do rodapé — é obrigação de licença' % ', '.join(faltam))
    else: print('  atribuição    ✓ Open-Meteo e DWD no rodapé, sem carregar em nada')
    print('  ao chegar     ✓ %d cabeças, todas fechadas, com o convite à vista' % len(d['cabs']))

    # --- ABRIR
    c.js("var b=document.querySelector('button.bloco__cabeca'); if(b) b.click()"); time.sleep(.45)
    d=json.loads(c.js(r"""JSON.stringify({
      exp: [...document.querySelectorAll('button.bloco__cabeca')].map(function(x){return x.getAttribute('aria-expanded');}),
      abertos: [...document.querySelectorAll('.bloco__numeros:not([hidden])')].map(function(x){return {
        id: x.id, papel: x.getAttribute('role'), rotulo: x.getAttribute('aria-label'),
        live: x.getAttribute('aria-live'),
        linhas: [...x.querySelectorAll('.nums__linha')].map(function(l){return {
          nome: (l.querySelector('.nums__nome')||{}).textContent || '',
          valor: (l.querySelector('.nums__valor')||{}).textContent || '',
          palavra: (l.querySelector('.nums__palavra')||{}).textContent || '',
          icone: !!l.querySelector('.nums__icone svg')};})};}),
      pista: !document.getElementById('v-pista').hidden,
      transbordo: document.documentElement.scrollWidth+'/'+innerWidth})"""))
    if len(d['abertos']) != 1: erro('depois de carregar há %d painéis abertos' % len(d['abertos']))
    else:
        a = d['abertos'][0]
        # role="group" e NÃO role="region": um region com nome é um LANDMARK, e
        # ficavam dois marcos a entrar e a sair do rotor a cada toque.
        if a['papel'] != 'group': erro('o painel tem role=%r — devia ser group' % a['papel'])
        if not a['rotulo']: erro('o painel não tem aria-label')
        # o #veredicto é aria-live="polite": sem isto, abrir despeja os cinco
        # factores em voz alta por cima do «expandido».
        if a['live'] != 'off': erro('o painel não tem aria-live="off" dentro da região live')
        if len(a['linhas']) < 3: erro('só %d factores no painel' % len(a['linhas']))
        # A LEI: nenhum número sem a sua palavra, e nenhuma linha sem ícone.
        maus = [l for l in a['linhas'] if not l['valor'] or not l['palavra'] or not l['icone']]
        if maus: erro('linhas sem valor, sem palavra ou sem ícone: %s' % maus[:2])
        # Nenhum travessão: uma linha sem valor não chega a ser escrita.
        if any('—' in l['valor'] for l in a['linhas']):
            erro('há travessões no painel — a linha devia não ser escrita')
        # A ordem é FIXA e é a ordem por que se pensa num dia de praia — não a
        # do peso na nota. Se alguém a trocar por outra, isto apanha; e se
        # renomear um factor, a linha vai para o fim em vez de desaparecer,
        # o que faz esta asserção falhar em vez de o ecrã ficar mudo.
        nomes = [l['nome'] for l in a['linhas']]
        ESPERADA = ['Sol', 'Calor', 'Vento', 'Água do mar', 'Chuva']
        if nomes != ESPERADA:
            erro('a ordem dos factores mudou: %s (esperada %s)' % (nomes, ESPERADA))
        # E o painel não pode voltar a afirmar que a ordem é a do peso.
        if 'mais pesa' in c.js("document.querySelector('.nums__ordem').textContent"):
            erro('o painel diz que a ordem é a do peso, e já não é')
        # A água é a mesma nas duas partes — é o número que a conta usou, e o
        # avaliarDia copia-a do dia para dentro de cada parte antes de a
        # pontuar. Aqui confirma-se que o ecrã não a reparte por engano.
        agua = [l for l in a['linhas'] if l['nome'].startswith('Água')]
        if agua:
            valores = json.loads(c.js(r"""(function(){
              var out = [];
              document.querySelectorAll('.bloco__numeros').forEach(function (p) {
                p.querySelectorAll('.nums__linha').forEach(function (l) {
                  var n = l.querySelector('.nums__nome');
                  if (n && n.textContent.indexOf('Água') === 0) {
                    out.push(l.querySelector('.nums__valor').textContent);
                  }});});
              return JSON.stringify(out);})()"""))
            if len(set(valores)) > 1:
                erro('a água aparece diferente nas duas partes: %s' % valores)
        print('  aberto        ✓ %d factores na ordem certa, todos com valor, palavra e ícone'
              % len(a['linhas']))
    if d['pista']: erro('o convite continua visível com um painel aberto')
    if d['transbordo'].split('/')[0] != d['transbordo'].split('/')[1]:
        erro('o painel aberto faz transbordar: %s' % d['transbordo'])
    con=json.loads(c.js(CONTRASTE))
    if con: erro('contraste com o painel aberto: %s' % con)
    else: print('  contraste     ✓ limpo com o painel aberto')

    # --- SÓ UM DE CADA VEZ, e o segundo toque fecha
    c.js("""var bs=document.querySelectorAll('button.bloco__cabeca');
            if (bs[1]) bs[1].click();"""); time.sleep(.45)
    n=int(c.js("document.querySelectorAll('.bloco__numeros:not([hidden])').length"))
    if n != 1: erro('ao abrir o segundo, ficaram %d painéis abertos' % n)
    else: print('  só um         ✓ abrir a tarde fecha a manhã')
    c.js("""var bs=document.querySelectorAll('button.bloco__cabeca');
            if (bs[1]) bs[1].click();"""); time.sleep(.45)
    d=json.loads(c.js(r"""JSON.stringify({
      abertos: document.querySelectorAll('.bloco__numeros:not([hidden])').length,
      pista: !document.getElementById('v-pista').hidden})"""))
    if d['abertos']: erro('o segundo toque não fechou')
    elif not d['pista']: erro('fechou mas o convite não voltou')
    else: print('  segundo toque ✓ fecha, e o convite volta')

    # --- MUDAR DE DIA mantém aberto (quem abriu a manhã está a comparar manhãs)
    c.js("var b=document.querySelector('button.bloco__cabeca'); if(b) b.click()"); time.sleep(.4)
    c.js("document.getElementById('dia-2').click()"); time.sleep(.5)
    d=json.loads(c.js(r"""JSON.stringify({
      abertos: [...document.querySelectorAll('.bloco__numeros:not([hidden])')].map(function(x){return x.id;})})"""))
    if d['abertos'] != ['nums-manha']:
        erro('mudar de dia devia manter a manhã aberta, e ficou %s' % d['abertos'])
    else: print('  mudar de dia  ✓ mantém a parte aberta')

    # CARREGAR NUMA CABEÇA NÃO MEXE O ECRÃ. Houve aqui um window.scrollBy a
    # compensar a diferença de altura, para o bloco tocado ficar no mesmo
    # píxel: com a manhã aberta, tocar na tarde dava scrollY −248 no telemóvel
    # e −291 no computador, e o nome da praia saltava esses mesmos pixéis. E
    # nem chegava ao alvo — pedia 374 px de compensação com 248 de scroll
    # acima, ficava cortado no limite e a cabeça ainda fugia 126.
    # Só se mede com a cabeça À VISTA: ninguém carrega no que não vê, e com ela
    # acima do topo é a ancoragem do próprio Chrome que decide, não este código.
    antes = len(falhas)
    for aberto in (None, 'manha', 'tarde'):
        for qual in ('manha', 'tarde'):
            c.js("""(function(){var b=document.querySelector('.bloco__cabeca[aria-expanded="true"]');
                 if(b) b.click();})()"""); time.sleep(.35)
            if aberto:
                c.js("document.getElementById('cab-%s').click()" % aberto); time.sleep(.45)
            c.js("document.getElementById('cab-%s').scrollIntoView({block:'center'})" % qual)
            time.sleep(.45)
            m=json.loads(c.js("""JSON.stringify({y:Math.round(scrollY),
              cab:Math.round(document.getElementById('cab-%s').getBoundingClientRect().top)})""" % qual))
            if m['cab'] < 0: continue          # fora do ecrã: não é uma acção possível
            c.js("document.getElementById('cab-%s').click()" % qual); time.sleep(.7)
            n=json.loads(c.js("""JSON.stringify({y:Math.round(scrollY),
              cab:Math.round(document.getElementById('cab-%s').getBoundingClientRect().top)})""" % qual))
            if n['y'] != m['y']:
                erro('carregar na %s (com %s aberta) mexeu o ecrã: scrollY %+d'
                     % (qual, aberto or 'nenhuma', n['y']-m['y']))
            elif aberto in (None, qual) and n['cab'] != m['cab']:
                erro('carregar na %s fez a própria cabeça fugir %+d px'
                     % (qual, n['cab']-m['cab']))
    if len(falhas) == antes:
        print('  sem salto     ✓ carregar numa cabeça não mexe o ecrã')

    # QUAL DAS MÉTRICAS NÃO ESTÁ BOA. Um triângulo ao lado do nome, nas linhas
    # cujo valor é mau — e mais nada: não há frase, foi tirada a pedido.
    # O corte é o MESMO 0,40 com que o modelo despromove um dia de verde para
    # amarelo, e daí sai a garantia de que num bloco VERDE não há marca nenhuma.
    # A ÁGUA entra aqui, ao contrário do factor limitante do modelo: a marca é
    # sobre o número daquela linha, não sobre o dia.
    antes = len(falhas)
    vistos = {'verde': 0, 'amarelo': 0, 'vermelho': 0}
    marcados = {'verde': 0, 'amarelo': 0, 'vermelho': 0}
    for dia in range(6):
        c.js("document.getElementById('dia-%d').click()" % dia); time.sleep(.35)
        for parte in ('manha', 'tarde'):
            c.js("""(function(){var b=document.getElementById('cab-%s');
                 if(b && b.getAttribute('aria-expanded')!=='true') b.click();})()""" % parte)
            time.sleep(.3)
            d=json.loads(c.js(r"""JSON.stringify((function(){
              var pn = document.querySelector('.bloco__numeros:not([hidden])');
              if (!pn) return null;
              var cor = [...pn.parentNode.classList]
                .map(function(k){return (k.match(/^parte--(verde|amarelo|vermelho)$/)||[])[1];})
                .filter(Boolean)[0] || '';
              return { cor: cor,
                /* o que o ecrã diz que chumbou: a linha por cima dos blocos
                   («O dia está chumbado: chuva a sério») e a razão do bloco. */
                veto: ((document.getElementById('v-resposta')||{}).textContent || '') + ' ' +
                      ((pn.parentNode.querySelector('.bloco__razao')||{}).textContent || ''),
                marcas: pn.querySelectorAll('.nums__mau').length,
                quais: [...pn.querySelectorAll('.nums__linha')].filter(function(l){
                  return l.querySelector('.nums__mau');})
                  /* só o texto PRÓPRIO do nome: o `.visually-hidden` da marca
                     vive lá dentro e vinha colado («Água do mar, ponto fraco»). */
                  .map(function(l){var n=l.querySelector('.nums__nome');
                    return [...n.childNodes].filter(function(k){return k.nodeType===3;})
                      .map(function(k){return k.textContent;}).join('').trim();}),
                semSvg: [...pn.querySelectorAll('.nums__mau')].filter(function(x){return !x.querySelector('svg');}).length,
                semTexto: [...pn.querySelectorAll('.nums__linha')].filter(function(l){
                  return l.querySelector('.nums__mau') && !l.querySelector('.visually-hidden');}).length,
                foraDaLinha: pn.querySelectorAll('.nums__mau').length
                  - pn.querySelectorAll('.nums__linha .nums__mau').length };})())"""))
            if not d or not d['cor']: continue
            vistos[d['cor']] += 1
            if d['marcas']:
                marcados[d['cor']] += 1
                # NUM DIA VERDE só a ÁGUA pode ser marcada. Os outros quatro
                # factores são os mesmos com que o modelo despromove um dia de
                # verde para amarelo: se um deles estivesse abaixo de 0,40, o
                # dia não era verde. A água está de fora desse cálculo de
                # propósito — «o mar gelado impede o banho, não impede o dia de
                # praia» — e por isso PODE aparecer fria num dia bom. É a única
                # excepção, e tem de continuar a ser a única.
                if d['cor'] == 'verde':
                    # Duas excepções, e só duas. A ÁGUA, porque está fora do
                    # cálculo que decide o verde. E o que um VETO nomeia: o dia
                    # pode chumbar por chuva com as partes sãs, porque os
                    # milímetros somam-se ao longo do dia — e aí a parte verde
                    # que contribuiu com chuva leva a marca, que era o defeito
                    # reportado. Tudo o resto continua impossível: se uma das
                    # outras estivesse abaixo de 0,40, o bloco não era verde.
                    perm = {'Água do mar'}
                    for t, nome in [('chuva', 'Chuva'), ('vento', 'Vento'), ('rajadas', 'Vento'),
                                    ('frio', 'Calor'), ('mar muito cavado', 'Água do mar')]:
                        if t in (d['veto'] or '').lower(): perm.add(nome)
                    fora = [x for x in d['quais'] if x not in perm]
                    if fora:
                        erro('bloco VERDE com triângulo em %s — só a água, ou o que um veto nomeie (veto: %r)'
                             % (fora, d['veto']))
                # A LEI DO CARTÃO vale para a marca: um símbolo sozinho não diz
                # nada a quem ouve. E um triângulo sem SVG é um espaço vazio.
                if d['semSvg']: erro('%d marcas sem desenho nenhum lá dentro' % d['semSvg'])
                if d['semTexto']: erro('%d linhas com triângulo e sem texto para quem ouve' % d['semTexto'])
                if d['foraDaLinha']: erro('%d marcas fora de uma linha de factor' % d['foraDaLinha'])
    if len(falhas) == antes:
        print('  valor mau     ✓ %d blocos: %d de %d verdes (só água), %d de %d amarelos, %d de %d vermelhos'
              % (sum(vistos.values()), marcados['verde'], vistos['verde'],
                 marcados['amarelo'], vistos['amarelo'], marcados['vermelho'], vistos['vermelho']))
    c.js("""(function(){var b=document.querySelector('.bloco__cabeca[aria-expanded="true"]');
         if(b) b.click();})()"""); time.sleep(.3)
    c.js("""(function(){var b=document.querySelector('.bloco__cabeca[aria-expanded="true"]');
         if(b) b.click();})()"""); time.sleep(.3)
finally: c.fechar()

print('\n== 6d-bis. o veto marca a sua própria linha ==')
# O DEFEITO REPORTADO: o cartão dizia «O dia está chumbado: chuva a sério» e a
# linha da Chuva ficava LIMPA. A chuva pontua-se pela PROBABILIDADE e o veto
# dispara pelos MILÍMETROS — 17 % de hipótese dá rácio 0,76, muito acima do
# corte de 0,40, enquanto 2 mm acumulados chumbam o dia. Os milímetros nunca
# entram na nota, portanto o rácio nunca os podia ver.
# E o contrário também tem de valer: se a chuva toda cair de manhã, uma tarde
# com 0 mm não pode levar triângulo por cima de «Sem chuva à vista».
def _chuva(mm):
    E = """
    (function(){var t=setInterval(function(){ if(!window.Modelo||!window.Modelo.avaliarDia) return;
      clearInterval(t); var o=window.Modelo.avaliarDia,n=0;
      window.Modelo.avaliarDia=function(){var r=o.apply(this,arguments);
        if(n++===0&&r&&r.v){ r.v.nota=null; r.v.cor='vermelho'; r.v.vetos=['chuva a sério'];
          if(r.partes&&r.partes[0]&&r.partes[0].d) r.partes[0].d.mm = %s; }
        return r;};},5);})();
    """ % mm
    c=Chrome(porta=livre())
    try:
        c.cmd('Emulation.setDeviceMetricsOverride',width=375,height=812,deviceScaleFactor=1,mobile=True)
        c.cmd('Page.addScriptToEvaluateOnNewDocument', source=E)
        c.abrir('http://127.0.0.1:%d/'%PORTA, espera=2.6)
        c.js("document.querySelector('.atalho').click()"); time.sleep(5.5)
        c.js("""(function(){var b=document.getElementById('cab-manha');
             if(b && b.getAttribute('aria-expanded')!=='true') b.click();})()"""); time.sleep(.5)
        return json.loads(c.js(r"""JSON.stringify((function(){
          var pn=document.querySelector('.bloco__numeros:not([hidden])');
          if(!pn) return null;
          var l=[...pn.querySelectorAll('.nums__linha')].find(function(x){
            var n=x.querySelector('.nums__nome');
            return [...n.childNodes].filter(function(k){return k.nodeType===3;})
                    .map(function(k){return k.textContent;}).join('').trim()==='Chuva';});
          return { titulo: document.getElementById('v-resposta').textContent,
                   marcada: !!(l && l.querySelector('.nums__mau')),
                   palavra: l ? (l.querySelector('.nums__palavra')||{}).innerText : '' };})())"""))
    finally: c.fechar()

antes = len(falhas)
com = _chuva('1.8')
sem = _chuva('0')
if not com or 'chumbado' not in (com['titulo'] or ''):
    print('  · o enxerto não pegou — secção sem valor nesta corrida')
else:
    if not com['marcada']:
        erro('o dia está chumbado por chuva, a manhã tem 1,8 mm e a linha da Chuva não leva marca')
    if 'Sem chuva à vista' in (com['palavra'] or ''):
        erro('a linha diz «Sem chuva à vista» com milímetros previstos: %r' % com['palavra'])
    if sem and sem['marcada']:
        erro('a manhã não deu chuva nenhuma e leva marca à mesma')
    if len(falhas) == antes:
        print('  com chuva     ✓ %r' % (com['palavra'] or '').replace('\n', ' ')[:52])
        print('  sem chuva     ✓ a parte seca não leva marca por chuva que caiu noutra')

# E SEM VETO NENHUM, só milímetros. A chuva pontua-se pela probabilidade, e 12%
# de hipótese dá rácio alto — mas «0,8 mm ao todo» é água a cair em cima de
# quem lá está. O limiar de 0,5 mm é medido, não é gosto: em 16 128 partes-dia
# (previsão arquivada contra o ERA5), abaixo de 0,3 mm previstos só 24% acabam
# com chuva a sério, e a partir de 0,5 são 75%.
def _mm(mm):
    E = """
    (function(){var t=setInterval(function(){ if(!window.Modelo||!window.Modelo.avaliarDia) return;
      clearInterval(t); var o=window.Modelo.avaliarDia,n=0;
      window.Modelo.avaliarDia=function(){var r=o.apply(this,arguments);
        if(n++===0&&r&&r.partes&&r.partes[0]&&r.partes[0].d){ r.partes[0].d.mm=%s; }
        return r;};},5);})();
    """ % mm
    c=Chrome(porta=livre())
    try:
        c.cmd('Emulation.setDeviceMetricsOverride',width=375,height=812,deviceScaleFactor=1,mobile=True)
        c.cmd('Page.addScriptToEvaluateOnNewDocument', source=E)
        c.abrir('http://127.0.0.1:%d/'%PORTA, espera=2.6)
        c.js("document.querySelector('.atalho').click()"); time.sleep(5.5)
        c.js("""(function(){var b=document.getElementById('cab-manha');
             if(b && b.getAttribute('aria-expanded')!=='true') b.click();})()"""); time.sleep(.5)
        return json.loads(c.js(r"""JSON.stringify((function(){
          var pn=document.querySelector('.bloco__numeros:not([hidden])');
          if(!pn) return null;
          var l=[...pn.querySelectorAll('.nums__linha')].find(function(x){
            var n=x.querySelector('.nums__nome');
            return [...n.childNodes].filter(function(k){return k.nodeType===3;})
                    .map(function(k){return k.textContent;}).join('').trim()==='Chuva';});
          return { marcada: !!(l&&l.querySelector('.nums__mau')),
                   vetado: (document.getElementById('v-resposta').textContent||'').indexOf('chumbado')>=0 };})())"""))
    finally: c.fechar()

antes = len(falhas)
baixo, alto = _mm('0.3'), _mm('0.8')
if baixo is None or alto is None or baixo.get('vetado') or alto.get('vetado'):
    print('  · o enxerto não pegou — o limiar dos milímetros fica por medir')
else:
    if baixo['marcada']: erro('0,3 mm previstos e a chuva já leva marca — o limiar medido é 0,5')
    if not alto['marcada']: erro('0,8 mm previstos e a chuva não leva marca — chove mesmo em 64%% dos casos')
    if len(falhas) == antes:
        print('  0,5 mm        ✓ 0,3 mm não marca, 0,8 mm marca, sem veto nenhum')

print('\n== 6g. a maré ==')
# SÓ HORAS, e é uma decisão medida: os metros desta fonte não se podem mostrar
# (o zero dela é o geóide, e o Zero Hidrográfico das tabelas portuguesas está
# ~2,6 m abaixo — o IH só o publica para uns 16 portos e o site tem 995
# praias), e a amplitude é 99,6 % do DIA e 0,3 % da PRAIA: seria o mesmo número
# em todas. A hora não — espalha-se 39 min de norte a sul.
c=novo(390,900,True)
try:
    c.js("document.querySelector('.atalho').click()"); time.sleep(6.0)
    antes=len(falhas)
    vistos, comMare = 0, 0
    for dia in range(6):
        c.js("document.getElementById('dia-%d').click()" % dia); time.sleep(.4)
        d=json.loads(c.js(r"""JSON.stringify({
          visivel: !document.getElementById('v-mare').hidden,
          texto: document.getElementById('v-mare-txt').textContent,
          nota: (document.querySelector('.mare__nota')||{}).innerText || '',
          pontos: document.querySelectorAll('#v-mare-svg .mare__ponto').length,
          horas: document.querySelectorAll('#v-mare-svg .mare__hora').length,
          curva: ((document.querySelector('#v-mare-svg .mare__linha')||{}).getAttribute
                  ? document.querySelector('#v-mare-svg .mare__linha').getAttribute('d') : ''),
          rotulo: document.getElementById('v-mare-svg').getAttribute('aria-labelledby'),
          janelas: [...document.querySelectorAll('#v-mare-svg .mare__janela')].map(function(r){
            return [+r.getAttribute('x'), +r.getAttribute('x') + +r.getAttribute('width')];})})"""))
        vistos += 1
        if not d['visivel']:
            if d['texto'].strip(): erro('a maré está escondida mas tem texto: %r' % d['texto'])
            continue
        comMare += 1
        t = d['texto']
        # NUNCA metros: o datum desta fonte não os paga.
        if re.search(r'\d+[,.]\d+\s*m\b', t) or re.search(r'\d+\s*m\b', t):
            erro('a maré mostra METROS, e o datum desta fonte não os paga: %r' % t)
        # As palavras do Instituto Hidrográfico, não «maré alta»/«maré baixa».
        if 'maré alta' in t.lower() or 'maré baixa' in t.lower():
            erro('a maré usa «maré alta/baixa» em vez de «preia-mar/baixa-mar»: %r' % t)
        if not re.search(r'(preia|baixa)-mar às \d\dh\d\d', t):
            erro('a maré não diz uma hora no formato esperado: %r' % t)
        # TODOS os extremos da curva são marcados. Houve uma versão que só
        # mostrava os das 9h-19h, e o desenho ficava com três picos e um só
        # ponto — quem olha pergunta porque é que os outros não contam.
        # Alternam: duas preia-mares seguidas seriam um pico contado a dobrar,
        # que é o defeito que os patamares da grelha horária provocam.
        tipos = re.findall(r'(preia|baixa)-mar', t)
        for i in range(1, len(tipos)):
            if tipos[i] == tipos[i-1]:
                erro('duas «%s-mar» seguidas — um pico contado a dobrar: %r' % (tipos[i], t))
        if 'mais areal' not in d['nota'] or 'mar aberto' not in d['nota']:
            erro('falta a nota estática do que a maré NÃO diz: %r' % d['nota'])
        # O DESENHO. A curva tem de existir e ter forma — um `d` curto seria uma
        # linha recta, ou seja, dados em falta a passar por maré.
        if len(d['curva']) < 200:
            erro('a curva da maré está vazia ou é uma recta: %d caracteres' % len(d['curva']))
        # TODOS OS EXTREMOS DA CURVA ESTÃO MARCADOS. Comparar os pontos com o
        # texto não chega: se alguém voltar a filtrar, os dois encolhem juntos
        # e a asserção não dá por nada — medido, a mutação passou.
        # Um dia civil tem 3 ou 4 extremos (medido em 60 dias-praia: 4 em 50
        # deles, 3 nos outros, porque quatro ocupam ~24,8 h e um transborda).
        # Filtrar pela janela de praia deixaria 1 ou 2. Daí o corte em 3.
        if d['pontos'] < 3:
            erro('só %d extremos marcados — um dia tem 3 ou 4, alguém está a filtrar' % d['pontos'])
        # Um ponto e um rótulo por extremo, e nem mais nem menos.
        if d['pontos'] != len(re.findall(r'-mar às', d['texto'])):
            erro('%d pontos no desenho para %d extremos no texto'
                 % (d['pontos'], len(re.findall(r'-mar às', d['texto']))))
        if d['horas'] != d['pontos']:
            erro('%d rótulos de hora para %d pontos' % (d['horas'], d['pontos']))
        # UM DESENHO QUE SÓ EXISTE PARA QUEM VÊ NÃO ENTRA NESTE CARTÃO.
        if d['rotulo'] != 'v-mare-txt':
            erro('o SVG da maré não aponta para o texto que o descreve: %r' % d['rotulo'])
        # OS RÓTULOS NÃO SE PISAM NEM SAEM DA TELA. Com quatro extremos num dia
        # e o cartão a 375 px, as horas ficam a poucos pixéis umas das outras;
        # as altas vão por cima da curva e as baixas por baixo do bloco de água,
        # e é isso que as separa. Se alguém mexer nessa altura, isto apanha.
        z=json.loads(c.js(r"""JSON.stringify((function(){
          var ts=[...document.querySelectorAll('#v-mare-svg .mare__hora')];
          var svg=document.getElementById('v-mare-svg').getBoundingClientRect();
          var r=ts.map(function(x){var b=x.getBoundingClientRect();
            return {t:x.textContent, e:b.left, d:b.right, c:b.top};});
          var ch=[];
          for(var i=0;i<r.length;i++) for(var j=i+1;j<r.length;j++)
            if (r[i].d>r[j].e && r[j].d>r[i].e && Math.abs(r[i].c-r[j].c)<12)
              ch.push(r[i].t+' x '+r[j].t);
          return {choques: ch,
                  fora: r.filter(function(x){return x.e<svg.left-1||x.d>svg.right+1;})
                         .map(function(x){return x.t;})};})())"""))
        if z['choques']: erro('horas da maré sobrepostas: %s' % z['choques'])
        if z['fora']: erro('horas da maré fora da tela: %s' % z['fora'])
        # AS FAIXAS SÃO DUAS, com a fenda do almoço entre elas. Houve uma
        # versão com UMA faixa de 9h às 19h, e estava errada: o modelo calcula
        # em 9h-13h e 15h-19h e ignora as 13h-15h de propósito. A faixa dizia
        # «é isto que o cartão cobre» e mentia em duas horas.
        js = d['janelas']
        if len(js) != len(M_PARTES):
            erro('%d faixas na maré para %d partes do dia' % (len(js), len(M_PARTES)))
        elif len(js) == 2 and js[1][0] <= js[0][1] + 0.5:
            erro('as duas faixas da maré estão coladas — a fenda das 13h-15h desapareceu: %s' % js)
    if len(falhas) == antes:
        print('  maré          ✓ %d dos %d dias, todos os extremos marcados, só horas, a alternar'
              % (comMare, vistos))
finally: c.fechar()

print('\n== 6e. o aviso de segurança ==')
# ESTEVE MORTO. O `.veredicto__aviso--perigo` existia no CSS desde que o aviso
# de segurança foi separado do de conforto — com um comentário a dizer que um
# veto de trovoada «não pode ser dito no mesmo tom amarelo que a água está
# fria» — e o app.js NUNCA lhe punha a classe. A única coisa no ecrã que pode
# impedir alguém de se magoar era pintada com a cor do desconforto.
# Não acontece na previsão de hoje, por isso força-se.
ENXERTO_PERIGO = r"""
(function () {
  var t = setInterval(function () {
    if (!window.Modelo || !window.Modelo.avaliarDia) return;
    clearInterval(t);
    var orig = window.Modelo.avaliarDia, n = 0;
    window.Modelo.avaliarDia = function () {
      var r = orig.apply(this, arguments);
      /* Trovoada (perigo) E chuva a sério (conforto) ao mesmo tempo, com a
         chuva PRIMEIRO na lista dos vetos — que é a ordem real do modelo. É
         este o caso em que a caixa vermelha nomeava a chuva. */
      if (n++ === 0 && r && r.v) {
        r.v.perigo = true;
        r.v.vetos = ['chuva quase certa', 'chuva a sério'];
        r.v.avisos = ['pode haver trovoada'];
        r.v.perigos = ['pode haver trovoada'];
      }
      return r;
    };
  }, 5);
})();
"""
c=Chrome(porta=livre())
try:
    c.cmd('Emulation.setDeviceMetricsOverride',width=375,height=812,deviceScaleFactor=1,mobile=True)
    c.cmd('Page.addScriptToEvaluateOnNewDocument', source=ENXERTO_PERIGO)
    c.abrir('http://127.0.0.1:%d/'%PORTA, espera=2.6)
    c.js("document.querySelector('.atalho').click()"); time.sleep(5.5)
    d=json.loads(c.js(r"""JSON.stringify((function(){
      var a = document.getElementById('v-aviso');
      return { escondido: a.hidden, classes: a.className,
               texto: a.innerText.replace(/\s+/g,' ').trim(),
               temTriangulo: !!a.querySelector('svg'),
               fundo: getComputedStyle(a).backgroundColor,
               cor: getComputedStyle(a).color };})())"""))
    if d['escondido']:
        print('  · o enxerto não pegou — secção sem valor nesta corrida')
    else:
        antes=len(falhas)
        if 'veredicto__aviso--perigo' not in d['classes']:
            erro('o aviso de trovoada saiu com as classes %r — sem a de perigo, fica no amarelo do conforto' % d['classes'])
        if not d['temTriangulo']:
            erro('o aviso de segurança não traz o triângulo')
        if 'trovoada' not in d['texto']:
            erro('o aviso não nomeia o perigo: %r' % d['texto'])
        # E NÃO NOMEIA O QUE NÃO É PERIGO. Lia-se `vetos[0]`, que é o primeiro
        # veto e não o primeiro PERIGO: como a chuva é empilhada antes do mar,
        # um dia de chuva a sério com o mar a 3,2 m escrevia, na caixa
        # vermelha, «Aviso de segurança: chuva quase certa» e escondia o mar.
        for conforto in ('chuva quase certa', 'chuva a sério', 'frio a mais'):
            if conforto in d['texto']:
                erro('a caixa de SEGURANÇA nomeia «%s», que é conforto e não perigo: %r'
                     % (conforto, d['texto']))
        if 'sai da água' not in d['texto']:
            erro('o aviso de trovoada não diz o que fazer: %r' % d['texto'])
        if d['fundo'] == d['cor']:
            erro('o aviso está da mesma cor que o fundo')
        if len(falhas)==antes:
            print('  perigo        ✓ %r' % d['texto'][:64])
            print('  com triângulo ✓ e com a caixa vermelha, não a amarela do conforto')
    # E o contrário: num dia sem perigo a classe NÃO pode ficar colada.
    c.cmd('Runtime.evaluate', expression="document.getElementById('dia-5').click()")
finally: c.fechar()

print('\n== 6f. abre sem rede, e não guarda previsão ==')
# Duas propriedades, e a segunda é mais importante do que a primeira: um site
# de praia que serve o sol de ontem por baixo de chuva é pior do que um site
# que não abre. O service worker guarda o ESQUELETO e recusa-se a guardar
# qualquer coisa que não seja deste domínio.
# NOTA: corre contra o _site/, e não contra a raiz, porque é lá que o
# `__VERSAO__` está preenchido pelo gerador.
import socketserver as _ss, http.server as _hs, threading as _th
class _Q(_hs.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
_P = livre()
_srv = _ss.TCPServer(('127.0.0.1', _P), lambda *a, **k: _Q(*a, directory=RAIZ + '/_site', **k))
_th.Thread(target=_srv.serve_forever, daemon=True).start()
c=Chrome(porta=livre())
try:
    c.cmd('Emulation.setDeviceMetricsOverride', width=375, height=812, deviceScaleFactor=1, mobile=True)
    c.abrir('http://127.0.0.1:%d/'%_P, espera=2.6)
    c.js("document.querySelector('.atalho').click()"); time.sleep(6.0)
    time.sleep(2.0)
    d=json.loads(c.js("""(async function(){
      var r = await navigator.serviceWorker.getRegistration();
      var ns = await caches.keys(), urls = [];
      for (const n of ns) { var ca = await caches.open(n);
        for (const q of await ca.keys()) urls.push(q.url); }
      return JSON.stringify({activo: !!(r && r.active), caches: ns, urls: urls});})()"""))
    antes = len(falhas)
    if not d['activo']: erro('o service worker não ficou activo')
    if len(d['caches']) != 1:
        erro('deviam ficar exactamente %d caches e ficaram %s' % (1, d['caches']))
    intrusos = [u for u in d['urls'] if 'open-meteo' in u or 'supabase' in u]
    if intrusos: erro('o service worker guardou PREVISÃO ou CONTA: %s' % intrusos[:3])
    if len(d['urls']) < 10: erro('só %d ficheiros no esqueleto — falta lá coisa' % len(d['urls']))
    # E agora sem rede. O `setCacheDisabled` NÃO é decoração: sem ele, a cache
    # HTTP do próprio Chrome serve a página e o teste passa mesmo com o service
    # worker partido — medido. Desligada, o que responde é só este código.
    c.cmd('Network.enable')
    c.cmd('Network.setCacheDisabled', cacheDisabled=True)
    c.cmd('Network.emulateNetworkConditions', offline=True, latency=0,
          downloadThroughput=0, uploadThroughput=0)
    time.sleep(.5)
    c.abrir('http://127.0.0.1:%d/'%_P, espera=4.0)
    e=json.loads(c.js(r"""JSON.stringify({
      atalhos: document.querySelectorAll('.atalho').length,
      procura: !!document.getElementById('procura'),
      fundo: getComputedStyle(document.body).backgroundColor,
      erro: document.body.innerText.indexOf('ERR_') >= 0})"""))
    if e['erro'] or not e['procura'] or not e['atalhos']:
        erro('sem rede o site não abriu: %s' % e)
    if e['fundo'] in ('rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)'):
        erro('sem rede o site abriu SEM ESTILO (fundo %s) — o CSS não veio da cache' % e['fundo'])
    if len(falhas) == antes:
        print('  offline       ✓ abre sem rede, com estilo, %d atalhos e a procura' % e['atalhos'])
        print('  sem previsão  ✓ %d ficheiros no esqueleto, zero da Open-Meteo ou do Supabase' % len(d['urls']))

    # NA AREIA, HORAS DEPOIS. O sessionStorage é por separador e sobrevive a um
    # recarregar; horas depois, num telemóvel, já não existe. É esse o caso que
    # interessa: a previsão vem da reserva no localStorage, e AÍ tem de dizer
    # de que horas é. Um número velho servido como novo é a pior coisa que este
    # site pode fazer, pior do que não abrir.
    antes = len(falhas)
    c.cmd('Network.emulateNetworkConditions', offline=False, latency=0,
          downloadThroughput=-1, uploadThroughput=-1)
    c.cmd('Network.setCacheDisabled', cacheDisabled=False)
    time.sleep(.4)
    c.abrir('http://127.0.0.1:%d/'%_P, espera=3.0)
    c.js("document.querySelector('.atalho').click()"); time.sleep(6.0)
    guardadas = int(c.js("Object.keys(localStorage).filter(function(k){"
                         "return k.indexOf('pm:g:')===0;}).length"))
    visivelComRede = c.js("document.getElementById('v-antiga').hidden ? 0 : 1")
    if not guardadas: erro('a previsão não ficou guardada na reserva')
    if visivelComRede: erro('COM rede o cartão diz que a previsão é guardada — só pode dizer sem rede')
    c.js("sessionStorage.clear()")
    c.cmd('Network.setCacheDisabled', cacheDisabled=True)
    c.cmd('Network.emulateNetworkConditions', offline=True, latency=0,
          downloadThroughput=0, uploadThroughput=0)
    time.sleep(.4)
    c.abrir('http://127.0.0.1:%d/'%_P, espera=5.0); time.sleep(3.5)
    a2=json.loads(c.js(r"""JSON.stringify({
      blocos: document.querySelectorAll('.bloco').length,
      nota: (document.querySelector('.bloco__nota')||{}).textContent || '',
      antiga: document.getElementById('v-antiga').hidden ? ''
              : document.getElementById('v-antiga').textContent})"""))
    if a2['blocos'] != 2 or not a2['nota']:
        erro('sem rede e com reserva, o cartão não mostrou a previsão: %s' % a2)
    elif not a2['antiga']:
        erro('MOSTROU A PREVISÃO SEM DIZER QUE É VELHA — %s de nota, sem aviso nenhum' % a2['nota'])
    elif not re.search(r'\d+h\d\d', a2['antiga']):
        erro('o aviso não diz a HORA a que a previsão foi buscada: %r' % a2['antiga'])
    if len(falhas) == antes:
        print('  na areia      ✓ %r' % a2['antiga'])
finally:
    c.fechar(); _srv.shutdown()

print('\n== 7. sem JavaScript ==')
c=Chrome(porta=livre())
try:
    c.cmd('Emulation.setScriptExecutionDisabled', value=True)
    c.cmd('Emulation.setDeviceMetricsOverride',width=375,height=812,deviceScaleFactor=1,mobile=True)
    c.abrir('http://127.0.0.1:%d/'%PORTA, espera=2.4)
    doc=c.cmd('DOM.getDocument', depth=-1)
    html=c.cmd('DOM.getOuterHTML', nodeId=doc['root']['nodeId'])['outerHTML']
    tem_aviso = 'bandeira' in html.lower()
    # A explicação do modelo saiu da entrada a 6 de Agosto de 2026 e vive em
    # /metodologia/. O que a entrada tem de ter, sem JavaScript, é o CAMINHO
    # para lá — senão quem não corre JS fica sem forma de lá chegar.
    tem_caminho = '/metodologia/' in html
    print('  aviso das bandeiras presente :', tem_aviso)
    print('  caminho para /metodologia/   :', tem_caminho)
    if not tem_aviso: erro('sem JS: falta o aviso das bandeiras')
    if not tem_caminho: erro('sem JS: a entrada não tem ligação para /metodologia/')

    # e a própria /metodologia/ tem de abrir sem JavaScript nenhum
    c.abrir('http://127.0.0.1:%d/metodologia/'%PORTA, espera=1.6)
    doc2=c.cmd('DOM.getDocument', depth=-1)
    m=c.cmd('DOM.getOuterHTML', nodeId=doc2['root']['nodeId'])['outerHTML']
    tem_pesos = '34' in m and 'Vento' in m
    print('  /metodologia/ sem JS         :', tem_pesos)
    if not tem_pesos: erro('sem JS: a /metodologia/ não mostra os pesos')
finally: c.fechar()

print('\n== 8. SEO: o que não pode desfazer-se sozinho ==')
# Isto não testa o site: testa os ficheiros. São correcções de higiene que uma
# refactorização distraída desfaz sem partir nada de visível — e que só se
# dariam por elas meses depois, no Search Console.
#
# NOTA: três verificações não cabem aqui e vivem em `verificar_producao()`, mais
# abaixo. O `python3 -m http.server` serve TUDO; é o Jekyll do GitHub Pages que
# esconde o /MODELO.md e a pasta _source, e o Jekyll só corre lá.
import re as _re
_ler = lambda n: open(os.path.join(RAIZ, n), encoding='utf-8').read()
# Os comentários deste projecto explicam o que ficou para trás e por isso citam
# o domínio antigo e nomes de etiquetas. Uma asserção que tropeça na prosa que
# a explica não vale nada — o que conta é o que o browser recebe.
_sem_comentarios = lambda n: _re.sub(r'<!--.*?-->', '', _ler(n), flags=_re.S)

for nome in ('robots.txt', 'sitemap.xml', '404.html', '_config.yml'):
    if not os.path.exists(os.path.join(RAIZ, nome)):
        erro('falta o ficheiro %s' % nome)
    else:
        print('  %-18s ✓ existe' % nome)

for pagina, esperado in (('index.html', 'https://praiometro.pt/'),
                         ('privacidade.html', 'https://praiometro.pt/privacidade.html'),
                         ('metodologia/index.html', 'https://praiometro.pt/metodologia/'),
                         ('nortada/index.html', 'https://praiometro.pt/nortada/'),
                         ('praias/index.html', 'https://praiometro.pt/praias/'),
                         ('praias/centro/index.html', 'https://praiometro.pt/praias/centro/')):
    h = _sem_comentarios(pagina)
    m = _re.search(r'<link rel="canonical" href="([^"]+)"', h)
    if not m:
        erro('%s sem canonical' % pagina)
    elif m.group(1) != esperado:
        erro('%s: canonical é %s, esperado %s' % (pagina, m.group(1), esperado))
    else:
        print('  %-18s ✓ canonical %s' % (pagina, m.group(1)))
    # A imagem de partilha tem de estar no domínio novo: os robôs do WhatsApp e
    # do LinkedIn não seguem o 301 do renatovalente5.github.io para a ir buscar.
    for og in _re.findall(r'<meta property="og:image" content="([^"]+)"', h):
        if not og.startswith('https://praiometro.pt/'):
            erro('%s: og:image fora do domínio — %s' % (pagina, og))
    if 'renatovalente5.github.io' in h:
        erro('%s ainda aponta para o domínio antigo' % pagina)

# Caminhos relativos numa página que vai ser servida a partir de /praia/x/
# apontam para o sítio errado. Já não pode haver nenhum.
for pagina in ('index.html', 'privacidade.html', '404.html',
               'metodologia/index.html', 'nortada/index.html',
               'praias/index.html', 'praias/centro/index.html'):
    maus = _re.findall(r'(?:href|src)="(?!https?:|/|#|mailto:|data:)([^"]+)"', _sem_comentarios(pagina))
    if maus:
        erro('%s com caminhos relativos: %s' % (pagina, maus))
    else:
        print('  %-18s ✓ sem caminhos relativos' % pagina)

# O href do preload e o argumento do fetch têm de ser iguais LETRA A LETRA.
# Se divergirem, o preload é descartado e o ficheiro é descarregado duas vezes.
pre = _re.search(r'<link rel="preload" href="([^"]+)"[^>]*as="fetch"([^>]*)>', _sem_comentarios('index.html'))
fet = _re.search(r"fetch\('([^']+praias\.json)'\)", _ler('assets/js/app.js'))
if not pre or not fet:
    erro('não encontrei o par preload/fetch do praias.json')
elif pre.group(1) != fet.group(1):
    erro('preload (%s) != fetch (%s)' % (pre.group(1), fet.group(1)))
elif 'crossorigin' not in pre.group(2):
    erro('o preload do praias.json não tem crossorigin — vem duas vezes')
else:
    print('  preload/fetch      ✓ %s, com crossorigin' % pre.group(1))

# Todas as URLs do sitemap têm de responder.
mapa = _ler('sitemap.xml')
for loc in _re.findall(r'<loc>([^<]+)</loc>', mapa):
    caminho = loc.replace('https://praiometro.pt', '') or '/'
    alvo = 'index.html' if caminho == '/' else caminho.lstrip('/')
    if alvo.endswith('/'): alvo += 'index.html'
    if not os.path.exists(os.path.join(RAIZ, alvo)):
        erro('sitemap aponta para %s, que não existe' % loc)
    else:
        print('  sitemap            ✓ %s' % loc)
if 'https://praiometro.pt/sitemap.xml' not in _ler('robots.txt'):
    erro('o robots.txt não indica o sitemap')

# A privacidade está fora do Google de propósito. As duas metades desta decisão
# têm de andar sempre juntas: `noindex` na página E fora do sitemap. Só uma
# delas é um sinal contraditório, e o Search Console acusa-o como erro.
_priv = _sem_comentarios('privacidade.html')
_m = _re.search(r'<meta name="robots" content="([^"]*)"', _priv)
_robots = _m.group(1) if _m else ''
# Por directiva, e não por substring: «nofollow» contém «follow», e um
# `in` ingénuo dava o teste por passado com o sinal exactamente ao contrário.
_directivas = [d.strip().lower() for d in _robots.split(',')]
_tem_noindex = 'noindex' in _directivas
# Os <loc>, e não o texto do ficheiro: o comentário deste sitemap explica
# porque é que a privacidade saiu de lá, e a palavra aparece nele.
_no_mapa = any('privacidade' in loc for loc in _re.findall(r'<loc>([^<]+)</loc>', mapa))

if _tem_noindex and _no_mapa:
    erro('privacidade.html tem noindex E está no sitemap — sinais ao contrário')
elif not _tem_noindex and not _no_mapa:
    erro('privacidade.html perdeu o noindex mas continua fora do sitemap — falta uma das metades')
elif _tem_noindex:
    if 'follow' not in _directivas:
        erro('o noindex da privacidade não diz `follow` — deixa de passar as ligações para a app')
    else:
        print('  privacidade.html   ✓ noindex, follow, e fora do sitemap')
else:
    print('  privacidade.html   ✓ indexável e no sitemap')

# Um <h1> e um só, e nada de <h2>/<h3> antes dele. Os diálogos da conta
# estavam dentro do <header>, e punham lá cinco.
h = _sem_comentarios('index.html')
if h.count('<h1') != 1:
    erro('index.html tem %d <h1>' % h.count('<h1'))
elif _re.search(r'<h[23]', h[:h.index('<h1')]):
    erro('index.html tem um <h2> ou <h3> antes do <h1>')
else:
    print('  index.html         ✓ um <h1>, e nada de <h2>/<h3> antes dele')


def verificar_producao():
    """As três que só se podem medir em https://praiometro.pt.

       Correr DEPOIS de publicar: `python3 -c "import sys; sys.path.insert(0,'_source');
       import verificar; verificar.verificar_producao()"` — ou à mão com curl."""
    import urllib.request, urllib.error
    def codigo(caminho):
        pedido = urllib.request.Request('https://praiometro.pt' + caminho, method='HEAD')
        try:
            return urllib.request.urlopen(pedido, timeout=15).status
        except urllib.error.HTTPError as e:
            return e.code
    for caminho in ('/MODELO.md', '/MONETIZACAO.md', '/README.md', '/LICENSE',
                    '/_source/verificar.py'):
        c = codigo(caminho)
        print('  %-24s %s %s' % (caminho, c, '✓' if c == 404 else '✗ TEM DE DAR 404'))
    for caminho in ('/robots.txt', '/sitemap.xml', '/'):
        c = codigo(caminho)
        print('  %-24s %s %s' % (caminho, c, '✓' if c == 200 else '✗ TEM DE DAR 200'))
    print('  %-24s %s %s' % ('/nao-existe-xpto', codigo('/nao-existe-xpto'),
                             '✓' if codigo('/nao-existe-xpto') == 404 else '✗'))


srv.shutdown()
print('\n'+'='*54)
print('FALHAS: %d' % len(falhas))
for f in falhas: print('  - '+f)
print('='*54)
