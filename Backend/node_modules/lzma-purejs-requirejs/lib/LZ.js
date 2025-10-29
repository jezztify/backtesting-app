'use strict';
const freeze = require('./freeze');
const BinTree = require('./LZ/BinTree');
const InWindow = require('./LZ/InWindow');
const OutWindow = require('./LZ/OutWindow');

module.exports = freeze({
  BinTree: BinTree,
  InWindow: InWindow,
  OutWindow: OutWindow
});
