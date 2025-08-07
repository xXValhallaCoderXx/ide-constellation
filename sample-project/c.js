// File c.js - standalone file with no dependencies
console.log('File C loaded');

function functionFromC() {
  return 'Hello from C (no dependencies)';
}

module.exports = {
  functionFromC
};