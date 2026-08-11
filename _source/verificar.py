# -*- coding: utf-8 -*-
"""Bateria de verificação do Praiómetro."""
import json, os, socket, socketserver, sys, threading, http.server, time
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
