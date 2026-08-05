'use strict';
/* Endereços das páginas de praia.
   =============================================================
   A `normalizar()` daqui é uma CÓPIA da de app.js:88, e tem de continuar a ser
   — não se importa nem se substitui. Quem mexer numa tem de mexer na outra.

   E não se «arranja» nenhuma das duas. Ela substitui cada carácter que não
   seja letra ou algarismo por UM espaço, sem colapsar os seguidos e sem tirar
   os das pontas:

     «Praia do Furadouro - Norte»       -> «praia do furadouro   norte»
     «Praia dos Pescadores (Ericeira)»  -> «praia dos pescadores  ericeira »

   Parece um defeito e não é: o campo `b` das 996 praias em data/praias.json
   foi produzido com esta função exacta, e a procura do site compara o que se
   escreve contra esse campo. Corrigi-la parte a procura das 996 em silêncio.

   Por isso a `slugificar()` EMBRULHA-A: deixa-a fazer o seu trabalho e só
   depois é que tira os espaços das pontas e junta os do meio. */

function normalizar(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
}

function slugificar(s) {
  return normalizar(s).trim().replace(/\s+/g, '-');
}

/* A chave de uma praia é a coordenada com 4 casas — a mesma que o F.id() de
   favoritos.js:28 usa. Nunca o nome: há 50 nomes repetidos no ficheiro, entre
   eles quatro «Praia dos Pescadores». */
function id(p) {
  return Number(p.la).toFixed(4) + ',' + Number(p.lo).toFixed(4);
}

module.exports = { normalizar: normalizar, slugificar: slugificar, id: id };
