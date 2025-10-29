'use strict';
const freeze = require('./freeze');
const Decoder = require('./LZMA/Decoder');
const Encoder = require('./LZMA/Encoder');

module.exports = freeze({
  Decoder: Decoder,
  Encoder: Encoder
});
