require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getHistoricalRates } = require('dukascopy-node');
const { format } = require('path');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Simple in-memory cache for chunk results. Keyed by instrument_from_to_timeframe
const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes

function cacheKey(instr, fromISO, toISO, timeframe) {
    return `${instr}_${fromISO}_${toISO}_${timeframe}`;
}

function isValidDateString(s) {
    const d = new Date(String(s));
    return !Number.isNaN(d.getTime());
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function endOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

// GET /api/dukascopy/historical
// Supports optional paging via `page` (0-based) and `chunkDays` (default 5).
// If `page` is provided the endpoint will return only that chunk: from + page*chunkDays -> min(to, +chunkDays)
app.get('/api/dukascopy/historical', async (req, res) => {
    try {
        const { instrument, from, to, timeframe, page, chunkDays } = req.query;
        console.log('[dukascopy] incoming request', { instrument, from, to, timeframe, page, chunkDays });
        // per-request id for easier tracing in logs
        const reqId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        // logger: prints extra meta when VERBOSE=1 or ?verbose=true is provided
        const isVerbose = process.env.VERBOSE === '1' || String(req.query.verbose) === 'true';
        const logger = (msg, meta) => {
            if (isVerbose) console.log(`[dukascopy] ${new Date().toISOString()} [${reqId}] ${msg}`, meta || '');
            else console.log(`[dukascopy] ${new Date().toISOString()} [${reqId}] ${msg}`);
        };
        if (!instrument || !from || !to) return res.status(400).json({ error: 'instrument, from and to are required' });
        if (!isValidDateString(from) || !isValidDateString(to)) return res.status(400).json({ error: 'invalid from/to date' });

        const instrRaw = String(instrument);
        const instr = instrRaw.replace('/', '').toLowerCase();
        const fromDate = new Date(String(from));
        const toDate = new Date(String(to));
        if (fromDate > toDate) return res.status(400).json({ error: 'from must be <= to' });

        const tf = String(timeframe || 'm1');
        const chunk = Math.max(1, parseInt(String(chunkDays || '5'), 10));

        if (typeof page !== 'undefined') {
            // serve a single chunk (page)
            const pg = Math.max(0, parseInt(String(page), 10));
            const chunkStart = addDays(fromDate, pg * chunk);
            if (chunkStart > toDate) return res.json({ values: [], page: pg, done: true });
            const chunkEnd = addDays(chunkStart, chunk - 1);
            let effectiveEnd = chunkEnd > toDate ? toDate : chunkEnd;
            // make end inclusive by moving to end of day to match user expectations
            effectiveEnd = endOfDay(effectiveEnd);

            const fromISO = chunkStart.toISOString();
            const toISO = effectiveEnd.toISOString();
            const key = cacheKey(instr, fromISO, toISO, tf);
            const now = Date.now();
            if (cache.has(key)) {
                const entry = cache.get(key);
                if (now - entry.ts < CACHE_TTL_MS) {
                    console.log('[dukascopy] cache hit', { key, page: pg });
                    return res.json({ values: entry.values, page: pg, done: effectiveEnd.getTime() >= toDate.getTime() });
                } else {
                    console.log('[dukascopy] cache stale, will refetch', { key });
                }
            } else {
                console.log('[dukascopy] cache miss', { key });
            }

            console.log('[dukascopy] fetching chunk from Dukascopy', { instrument: instr, from: chunkStart.toISOString(), to: effectiveEnd.toISOString(), timeframe: tf });
            const t0 = Date.now();
            const result = await getHistoricalRates({
                instrument: instr,
                dates: { from: chunkStart, to: effectiveEnd },
                timeframe: tf,
            });
            const took = Date.now() - t0;
            console.log('[dukascopy] fetch complete', { key, tookMs: took });
            // dump a small summary of the raw result for debugging
            try {
                const shape = result && typeof result === 'object' ? Object.keys(result).slice(0, 10) : typeof result;
                console.log('[dukascopy] raw result shape', { shape, sample: Array.isArray(result) ? result.length : (result && result.values ? (Array.isArray(result.values) ? result.values.length : 'non-array') : 'empty') });
            } catch (e) {
                console.log('[dukascopy] raw result logging failed', String(e));
            }

            let values = [];
            if (result) {
                if (Array.isArray(result)) values = result;
                else if (Array.isArray(result.values)) values = result.values;
                else if (typeof result === 'object') {
                    // try to pick up common shapes
                    values = result.values && Array.isArray(result.values) ? result.values : [];
                }
            }
            cache.set(key, { ts: now, values });
            console.log('[dukascopy] cache set', { key, count: values.length });
            return res.json({ values, page: pg, done: effectiveEnd.getTime() >= toDate.getTime() });
        }

        // No paging requested: fetch the full range (may be large). We will
        // attempt to use cached whole-range response if present.
        // make the toDate inclusive to match user expectations (end of day)
        const inclusiveToDate = endOfDay(toDate);
        const fromISO = fromDate.toISOString();
        const toISO = inclusiveToDate.toISOString();
        const fullKey = cacheKey(instr, fromISO, toISO, tf);
        const now = Date.now();
        if (cache.has(fullKey)) {
            const entry = cache.get(fullKey);
            if (now - entry.ts < CACHE_TTL_MS) {
                logger('full-range cache hit', { fullKey });
                return res.json(entry.values);
            } else {
                logger('full-range cache stale, refetching', { fullKey });
            }
        }

        // Chunked fetching for full-range to provide progress logs and avoid
        // single huge requests. chunkDays query param controls chunk size.
        const msPerDay = 24 * 60 * 60 * 1000;
        const totalDays = Math.ceil((inclusiveToDate.getTime() - fromDate.getTime() + 1) / msPerDay);
        const totalChunks = Math.max(1, Math.ceil(totalDays / chunk));

        logger('starting chunked full-range fetch', { instrument: instr, from: fromISO, to: toISO, timeframe: tf, chunkDays: chunk, totalDays, totalChunks });

        const allValues = [];
        let fetchedCount = 0;
        for (let pg = 0; pg < totalChunks; pg++) {
            const chunkStart = addDays(fromDate, pg * chunk);
            if (chunkStart > inclusiveToDate) break;
            const chunkEnd = addDays(chunkStart, chunk - 1);
            let effectiveEnd = chunkEnd > inclusiveToDate ? inclusiveToDate : chunkEnd;
            // make end inclusive
            effectiveEnd = endOfDay(effectiveEnd);

            const chunkFromISO = chunkStart.toISOString();
            const chunkToISO = effectiveEnd.toISOString();
            const chunkKey = cacheKey(instr, chunkFromISO, chunkToISO, tf);

            if (cache.has(chunkKey)) {
                const entry = cache.get(chunkKey);
                if (Date.now() - entry.ts < CACHE_TTL_MS) {
                    logger('chunk cache hit', { chunk: pg, chunkKey, count: entry.values.length });
                    allValues.push(...entry.values);
                    fetchedCount += entry.values.length;
                    logger('progress', { chunk: pg, fetchedChunks: pg + 1, totalChunks, fetchedCount, percent: Math.round(((pg + 1) / totalChunks) * 100) });
                    continue;
                } else {
                    logger('chunk cache stale, will refetch', { chunk: pg, chunkKey });
                }
            }

            logger('fetching chunk from Dukascopy', { chunk: pg, from: chunkFromISO, to: chunkToISO, timeframe: tf });
            const t0Chunk = Date.now();
            const result = await getHistoricalRates({
                instrument: instr,
                dates: { from: chunkStart, to: effectiveEnd },
                timeframe: tf,
            });
            const tookMs = Date.now() - t0Chunk;

            let values = [];
            if (result) {
                if (Array.isArray(result)) values = result;
                else if (Array.isArray(result.values)) values = result.values;
                else if (typeof result === 'object') values = result.values && Array.isArray(result.values) ? result.values : [];
            }

            cache.set(chunkKey, { ts: Date.now(), values });
            allValues.push(...values);
            fetchedCount += values.length;
            logger('chunk fetch complete', { chunk: pg, tookMs, chunkCount: values.length, fetchedCount, fetchedChunks: pg + 1, totalChunks, percent: Math.round(((pg + 1) / totalChunks) * 100) });
        }

        // cache aggregated full-range result for quick future responses
        cache.set(fullKey, { ts: Date.now(), values: allValues });
        logger('full-range fetch complete', { fullKey, totalCount: allValues.length });
        return res.json({ values: allValues, status: 'ok' });
    } catch (err) {
        console.error('Error in dukascopy proxy:', err);
        res.status(500).json({ error: err && err.message ? err.message : String(err) });
    }
});

app.listen(port, () => {
    console.log(`Dukascopy proxy listening on http://localhost:${port}`);
});

