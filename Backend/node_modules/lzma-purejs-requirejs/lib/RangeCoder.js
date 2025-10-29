'use strict';
const freeze = require('./freeze');
const BitTreeDecoder = require('./RangeCoder/BitTreeDecoder');
const BitTreeEncoder = require('./RangeCoder/BitTreeEncoder');
const Decoder = require('./RangeCoder/Decoder');
const Encoder = require('./RangeCoder/Encoder');

module.exports = freeze({
  BitTreeDecoder: BitTreeDecoder,
  BitTreeEncoder: BitTreeEncoder,
  Decoder: Decoder,
  Encoder: Encoder
});
