// File b.js - imports c.js
const c = require('./c');

console.log('File B loaded');

function functionFromB() {
  return `B says: ${c.functionFromC()}`;
}

module.exports = {
  functionFromB
};