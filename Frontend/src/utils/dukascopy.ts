// Re-export parsing helpers from shared JS module to avoid duplication.
// The shared module is CommonJS; TypeScript can import it as a JS module.
const shared = require('./dukascopy.shared.js');

export const expandCompressedDay = shared.expandCompressedDay;
export const parseDukascopyNativeJson = shared.parseDukascopyNativeJson;
