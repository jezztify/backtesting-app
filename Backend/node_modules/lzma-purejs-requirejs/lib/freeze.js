'use strict';

// Object.freeze(), or a thunk if that method is not present in this
// JavaScript environment.

module.exports = Object.freeze || function(o) { return o; }