// File a.js - imports b.js
const b = require('./b');

console.log('File A loaded');
console.log('Calling function from B:', b.functionFromB());

module.exports = {
  functionFromA: () => 'Hello from A'
};