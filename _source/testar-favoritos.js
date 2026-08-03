/* Testes do módulo de favoritos, sem browser.
   Correr:  node _source/testar-favoritos.js                                   */

/* ------------------------------------------------ um browser de mentira */
function armazem() {
  var d = {};
  return {
    getItem: function (k) { return k in d ? d[k] : null; },
    setItem: function (k, v) { d[k] = String(v); },
    removeItem: function (k) { delete d[k]; },
    clear: function () { d = {}; }
  };
}
global.localStorage = armazem();
global.window = global;
global.addEventListener = function () { };

var falhas = 0, feitos = 0;
function ok(cond, texto) {
  feitos++;
  if (cond) { console.log('  ✓ ' + texto); }
  else { falhas++; console.log('  ✗ ' + texto); }
}
function recarregar() {
  delete require.cache[require.resolve('../assets/js/favoritos.js')];
  require('../assets/js/favoritos.js');
  return global.Favoritos;
}

var praia = function (n, la, lo) { return { n: n, la: la, lo: lo, m: 1 }; };
var F = recarregar();

console.log('\n== a chave é a coordenada, não o nome ==');
var a = praia('Praia dos Pescadores', 37.01234, -8.98765);
var b = praia('Praia dos Pescadores', 41.11111, -8.22222);
ok(F.id(a) === '37.0123,-8.9877', 'quatro casas decimais, arredondadas: ' + F.id(a));
ok(F.id(a) !== F.id(b), 'dois nomes iguais em sítios diferentes têm chaves diferentes');
F.alternar(a);
ok(F.tem(a) && !F.tem(b), 'marcar uma «Praia dos Pescadores» não marca a outra');

console.log('\n== marcar, desmarcar, e o que devolve ==');
localStorage.clear(); F = recarregar();
ok(F.alternar(a) === 'marcada', 'a primeira vez devolve «marcada»');
ok(F.alternar(a) === 'removida', 'a segunda devolve «removida»');
ok(F.lista().length === 0, 'e a lista fica vazia');

console.log('\n== o limite recusa, não deita fora em silêncio ==');
localStorage.clear(); F = recarregar();
for (var i = 0; i < 15; i++) F.alternar(praia('Praia ' + i, 40 + i / 100, -8));
ok(F.lista().length === 15, 'entram 15');
var primeira = F.lista()[F.lista().length - 1].n;
ok(F.alternar(praia('A mais', 39, -9)) === 'cheio', 'a 16.ª devolve «cheio»');
ok(F.lista().length === 15, 'continuam 15');
ok(F.lista()[F.lista().length - 1].n === primeira,
   'a mais antiga NÃO foi deitada fora — seria uma perda invisível para quem carregou na estrela');

console.log('\n== resolver contra a lista de praias ==');
localStorage.clear(); F = recarregar();
var lista = [praia('Praia A', 40.1, -8.1), praia('Praia B', 41.2, -8.2)];
F.alternar(lista[0]); F.alternar(lista[1]);
ok(F.resolver(lista).length === 2, 'resolve as duas pela coordenada');

/* O ficheiro de praias é regenerado do OpenStreetMap de tempos a tempos e um
   ponto pode andar uns metros. O nome serve de rede — e a chave actualiza-se. */
localStorage.clear(); F = recarregar();
F.alternar(praia('Praia A', 40.1, -8.1));
var mexida = [praia('Praia A', 40.1009, -8.1009)];
var r = F.resolver(mexida);
ok(r.length === 1, 'uma praia que andou uns metros é reencontrada pelo nome');
ok(F.lista()[0].id === F.id(mexida[0]), 'e a chave guardada passa a ser a nova');

localStorage.clear(); F = recarregar();
F.alternar(praia('Praia Que Desapareceu', 39.9, -7.7));
ok(F.resolver([praia('Outra', 40, -8)]).length === 0, 'uma praia que já não existe some');
ok(F.lista().length === 0, 'e some também do que está guardado, sem erro');

console.log('\n== juntar as duas listas ao entrar na conta ==');
localStorage.clear(); F = recarregar();
var junta = F.substituir([
  { id: '40.1000,-8.1000', n: 'A' },
  { id: '41.2000,-8.2000', n: 'B' },
  { id: '40.1000,-8.1000', n: 'A outra vez' }
]);
ok(junta.length === 2, 'repetidas contam uma vez só');
ok(junta[0].n === 'A', 'fica a primeira ocorrência');
var muitas = [];
for (var j = 0; j < 40; j++) muitas.push({ id: '4' + (j % 9) + '.0000,-8.0000', n: 'p' + j });
ok(F.substituir(muitas).length <= 15, 'a união também respeita o limite');

console.log('\n== armazenamento estragado não parte a página ==');
localStorage.clear();
localStorage.setItem('favoritos', 'isto não é JSON');
F = recarregar();
ok(F.lista().length === 0, 'lixo em vez de JSON dá lista vazia');
localStorage.setItem('favoritos', '{"nao":"e um array"}');
F = recarregar();
ok(F.lista().length === 0, 'um objecto em vez de um array dá lista vazia');
localStorage.setItem('favoritos', '[{"sem":"id"},{"id":"40.1000,-8.1000","n":"boa"}]');
F = recarregar();
ok(F.lista().length === 1 && F.lista()[0].n === 'boa', 'entradas sem forma de favorito são descartadas');

console.log('\n== quem ouve as mudanças recebe o que mudou ==');
localStorage.clear(); F = recarregar();
var visto = [];
F.aoMudar(function (itens, mudanca) { visto.push(mudanca && mudanca.tipo); });
var p = praia('Praia X', 38.5, -9.1);
F.alternar(p); F.alternar(p);
ok(visto[0] === 'marcada' && visto[1] === 'removida', 'avisa o tipo de cada mudança');
F.substituir([]);
ok(visto.length === 3 && !visto[2],
   'a junção da conta avisa, mas sem «mudança» — é o que impede o app.js de voltar a subir tudo');

console.log('\n' + '='.repeat(50));
console.log(falhas ? '✗ ' + falhas + ' de ' + feitos + ' falharam' : '✓ TODOS OS ' + feitos + ' TESTES PASSARAM');
console.log('='.repeat(50));
process.exit(falhas ? 1 : 0);
