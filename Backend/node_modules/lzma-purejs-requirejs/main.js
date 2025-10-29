'use strict';

const freeze = require('./lib/freeze');
const LZ = require('./lib/LZ');
const LZMA = require('./lib/LZMA');
const RangeCoder = require('./lib/RangeCoder');
const Stream = require('./lib/Stream');
const Util = require('./lib/Util');

module.exports = freeze({
      version: "0.9.0",
      LZ: LZ,
      LZMA: LZMA,
      RangeCoder: RangeCoder,
      Stream: Stream,
      Util: Util,
      // utility methods
      compress: Util.compress,
      compressFile: Util.compressFile,
      decompress: Util.decompress,
      decompressFile: Util.decompressFile
});
