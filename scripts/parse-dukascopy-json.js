const fs = require('fs');
const path = require('path');

function normalizeTimestamp(ts) {
    if (ts == null) return null;
    let n = Number(ts);
    if (Number.isNaN(n)) return null;
    // If a string ISO was passed, Date.parse may be used elsewhere; here we
    // expect numeric epoch values. Reduce by 1000 until value looks like seconds.
    while (n > 1e11) n = Math.floor(n / 1000);
    return Math.floor(n);
}

function parseDukascopyArray(vals) {
    if (!Array.isArray(vals)) return [];
    const out = [];
    for (const v of vals) {
        if (!v) continue;
        const cand = v.timestamp ?? v.time ?? v.t ?? v.datetime ?? v.date ?? null;
        let ts = null;
        if (typeof cand === 'number' || (typeof cand === 'string' && /^\d+$/.test(cand))) ts = Number(cand);
        else if (typeof cand === 'string') {
            const parsed = Date.parse(cand.replace(' ', 'T'));
            if (!Number.isNaN(parsed)) ts = parsed;
        }
        if (ts == null) continue;
        const time = normalizeTimestamp(ts);
        if (!time) continue;
        const open = parseFloat(v.open ?? v.o ?? v.O ?? NaN);
        const high = parseFloat(v.high ?? v.h ?? v.H ?? NaN);
        const low = parseFloat(v.low ?? v.l ?? v.L ?? NaN);
        const close = parseFloat(v.close ?? v.c ?? v.C ?? NaN);
        const vol = v.volume ?? v.v ?? v.V ?? undefined;
        const volume = vol !== undefined ? parseFloat(String(vol)) : undefined;
        if ([open, high, low, close].some((n) => Number.isNaN(n))) continue;
        out.push({ time, open, high, low, close, volume: Number.isNaN(volume) ? undefined : volume });
    }
    return out;
}

const filePath = process.argv[2] || path.join(__dirname, '..', 'Frontend', 'src', 'data', 'dukascopy', 'EURUSD_1min_20251001_20251002.json');
try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(raw);
    const vals = Array.isArray(json) ? json : Array.isArray(json.values) ? json.values : Array.isArray(json.data) ? json.data : [];
    const candles = parseDukascopyArray(vals);
    // Simulate UI state: dataset label, candles count, detected timeframe
    const filename = path.basename(filePath);
    const datasetLabel = filename.replace(/\.(csv|json)$/i, '');

    // Timeframe detection (mirror logic from timeframe.ts)
    const fn = filename.toLowerCase();
    const detectTimeframeFromFilename = (name) => {
        const s = name.toLowerCase();
        if (s.match(new RegExp('(^|[^0-9a-z])1\\s*min([^0-9a-z]|$)')) || s.match(new RegExp('(^|[^0-9a-z])m1([^0-9a-z]|$)'))) return 'M1';
        if (s.match(new RegExp('(^|[^0-9a-z])5\\s*min([^0-9a-z]|$)')) || s.match(new RegExp('(^|[^0-9a-z])m5([^0-9a-z]|$)'))) return 'M5';
        if (s.match(new RegExp('(^|[^0-9a-z])15\\s*min([^0-9a-z]|$)')) || s.match(new RegExp('(^|[^0-9a-z])m15([^0-9a-z]|$)'))) return 'M15';
        if (s.match(new RegExp('(^|[^0-9a-z])30\\s*min([^0-9a-z]|$)')) || s.match(new RegExp('(^|[^0-9a-z])m30([^0-9a-z]|$)'))) return 'M30';
        if (s.match(new RegExp('(^|[^0-9a-z])1\\s*h(?:our)?s?([^0-9a-z]|$)')) || s.match(new RegExp('(^|[^0-9a-z])h1([^0-9a-z]|$)'))) return 'H1';
        if (s.match(new RegExp('(^|[^0-9a-z])4\\s*h(?:our)?s?([^0-9a-z]|$)')) || s.match(new RegExp('(^|[^0-9a-z])h4([^0-9a-z]|$)'))) return 'H4';
        if (s.includes('daily') || s.match(/\bdaily\b|\bd\b|\bd1\b/)) return 'Daily';
        if (s.includes('weekly') || s.match(/\bweekly\b|\bw\b|\bw1\b/)) return 'Weekly';
        if (s.includes('monthly') || s.match(/\bmonthly\b|\bmn\b|\bmn1\b/)) return 'Monthly';
        return 'Unknown';
    };

    const timeframe = detectTimeframeFromFilename(fn);
    const getTimeframeLabel = (tf) => {
        switch (tf) {
            case 'M1': return '1 Minute';
            case 'M5': return '5 Minutes';
            case 'M15': return '15 Minutes';
            case 'M30': return '30 Minutes';
            case 'H1': return '1 Hour';
            case 'H4': return '4 Hours';
            case 'Daily': return 'Daily';
            case 'Weekly': return 'Weekly';
            case 'Monthly': return 'Monthly';
            default: return 'Unknown';
        }
    };

    console.log('Simulated UI state for import:');
    console.log('  File:', filePath);
    console.log('  Dataset label:', datasetLabel);
    console.log('  Parsed candles:', candles.length);
    console.log('  Detected timeframe:', timeframe, '-', getTimeframeLabel(timeframe));
    if (candles.length > 0) {
        const first = candles[0];
        const last = candles[candles.length - 1];
        console.log('  First candle time (ISO):', new Date(first.time * 1000).toISOString());
        console.log('  Last  candle time (ISO):', new Date(last.time * 1000).toISOString());
    }
} catch (err) {
    console.error('Failed to parse file:', err && err.message ? err.message : err);
    process.exit(2);
}
