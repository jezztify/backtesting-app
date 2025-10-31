import type { Instrument } from 'dukascopy-node';
import React, { useEffect, useState } from 'react';

// Small helpers
export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function floorDate(date: Date, interval: string) {
    const d = new Date(date);
    switch (interval) {
        case '1min':
            d.setSeconds(0, 0);
            break;
        case '5min':
            d.setMinutes(Math.floor(d.getMinutes() / 5) * 5, 0, 0);
            break;
        case '15min':
            d.setMinutes(Math.floor(d.getMinutes() / 15) * 15, 0, 0);
            break;
        case '30min':
            d.setMinutes(Math.floor(d.getMinutes() / 30) * 30, 0, 0);
            break;
        case '1h':
            d.setMinutes(0, 0, 0);
            break;
        case '4h':
            d.setHours(Math.floor(d.getHours() / 4) * 4, 0, 0, 0);
            break;
        case '1day':
            d.setHours(0, 0, 0, 0);
            break;
        case '1week':
            d.setDate(d.getDate() - d.getDay());
            d.setHours(0, 0, 0, 0);
            break;
        case '1month':
            d.setDate(1);
            d.setHours(0, 0, 0, 0);
            break;
        default:
            break;
    }
    return d;
}

export function aggregateOHLCV(data: any[], fromInterval: string, toInterval: string) {
    if (fromInterval === toInterval) return data;
    const grouped: Record<string, any[]> = {};
    for (const row of data) {
        const dt = new Date(row.datetime.replace(' ', 'T'));
        const bucket = floorDate(dt, toInterval).toISOString().replace('T', ' ').slice(0, 19);
        if (!grouped[bucket]) grouped[bucket] = [];
        grouped[bucket].push(row);
    }
    const result: any[] = [];
    for (const [datetime, group] of Object.entries(grouped)) {
        const open = group[0].open;
        const close = group[group.length - 1].close;
        const high = Math.max(...group.map((r) => parseFloat(r.high)));
        const low = Math.min(...group.map((r) => parseFloat(r.low)));
        const volume = group.reduce((sum, r) => sum + (parseFloat(r.volume) || 0), 0);
        result.push({ datetime, open, high: high.toString(), low: low.toString(), close, volume: volume.toString() });
    }
    result.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
    return result;
}

export function formatDateTime(date: Date) {
    return date.toISOString().replace('T', ' ').slice(0, 19);
}

export function addDays(date: Date, days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

export function addInterval(date: Date, interval: string) {
    const d = new Date(date);
    switch (interval) {
        case '1min':
            d.setMinutes(d.getMinutes() + 1);
            break;
        case '5min':
            d.setMinutes(d.getMinutes() + 5);
            break;
        case '15min':
            d.setMinutes(d.getMinutes() + 15);
            break;
        case '30min':
            d.setMinutes(d.getMinutes() + 30);
            break;
        case '1h':
            d.setHours(d.getHours() + 1);
            break;
        case '4h':
            d.setHours(d.getHours() + 4);
            break;
        case '1day':
            d.setDate(d.getDate() + 1);
            break;
        case '1week':
            d.setDate(d.getDate() + 7);
            break;
        case '1month':
            d.setMonth(d.getMonth() + 1);
            break;
        default:
            d.setMinutes(d.getMinutes() + 1);
            break;
    }
    return d;
}

export function normalizeDukascopyValues(values: any[]) {
    // Dukascopy sample format: { timestamp: 1759276800000, open: 1.17342, high: ..., low: ..., close: ..., volume: ... }
    // Normalize to the frontend's expected shape: { datetime: 'YYYY-MM-DD HH:mm:ss', open: '...', high: '...', low: '...', close: '...', volume: '...'}
    if (!Array.isArray(values)) return [];
    return values
        .map((v) => {
            if (v == null) return null;
            // find a timestamp value (try multiple common keys)
            let ts: number | null = null;
            const cand = v.timestamp ?? v.time ?? v.t ?? v.datetime ?? v.date ?? null;
            if (typeof cand === 'number') ts = cand;
            else if (typeof cand === 'string' && cand.match(/^\d+$/)) ts = Number(cand);
            else if (typeof cand === 'string' && isNaN(Number(cand))) {
                // try parsing ISO-like strings
                const parsed = Date.parse(cand);
                if (!Number.isNaN(parsed)) ts = parsed;
            }

            if (ts != null) {
                // heuristics: if timestamp looks like seconds (10 digits), convert to ms
                if (ts > 0 && ts < 1e11) ts = ts * 1000;
                // if it's absurdly large (microseconds), reduce to ms
                if (ts > 1e15) ts = Math.floor(ts / 1000);
            }

            const openVal = v.open ?? v.o ?? v.Open ?? null;
            const highVal = v.high ?? v.h ?? v.High ?? null;
            const lowVal = v.low ?? v.l ?? v.Low ?? null;
            const closeVal = v.close ?? v.c ?? v.Close ?? null;
            const volumeVal = v.volume ?? v.v ?? v.Volume ?? null;

            if (ts == null || openVal == null || highVal == null || lowVal == null || closeVal == null) return null;

            const dtStr = new Date(Number(ts)).toISOString().replace('T', ' ').slice(0, 19);
            const open = String(openVal);
            const high = String(highVal);
            const low = String(lowVal);
            const close = String(closeVal);
            const volume = volumeVal != null ? String(volumeVal) : '';
            return { datetime: dtStr, open, high, low, close, volume };
        })
        .filter((x) => x !== null) as any[];
}

// Providers: only Twelve Data for now
const PROVIDERS = [{ id: 'dukascopy', name: 'Dukascopy' }, { id: 'twelve_data', name: 'Twelve Data' }];

// Storage helpers
const saveApiKey = (providerId: string, apiKey: string) => {
    const keys = JSON.parse(localStorage.getItem('marketDataApiKeys') || '{}');
    keys[providerId] = apiKey;
    localStorage.setItem('marketDataApiKeys', JSON.stringify(keys));
};

const loadApiKey = (providerId: string): string => {
    const keys = JSON.parse(localStorage.getItem('marketDataApiKeys') || '{}');
    return keys[providerId] || '';
};

const saveDataAsFile = (data: any, filename: string, type: 'json' | 'csv' = 'json') => {
    let blob: Blob;
    if (type === 'json') blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    else blob = new Blob([data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

// Twelve Data chunked fetch (5-day chunks, rate-limited)
export async function fetchTwelveDataChunked(symbol: string, interval: string, apiKey: string, startDate: string, endDate: string) {
    const allValues: any[] = [];
    let current = new Date(startDate);
    const end = new Date(endDate);
    let meta: any = null;
    let requestsThisWindow = 0;
    let windowStart = Date.now();
    const MAX_REQUESTS = 7;
    const WINDOW_MS = 60 * 1000;
    while (current <= end) {
        if (requestsThisWindow >= MAX_REQUESTS) {
            const now = Date.now();
            const elapsed = now - windowStart;
            if (elapsed < WINDOW_MS) await sleep(WINDOW_MS - elapsed);
            requestsThisWindow = 0;
            windowStart = Date.now();
        }
        const chunkStart = formatDateTime(current);
        const chunkEndDate = addDays(current, 4);
        const chunkEnd = chunkEndDate > end ? formatDateTime(end) : formatDateTime(chunkEndDate);
        const params = new URLSearchParams({
            symbol,
            interval,
            apikey: apiKey,
            outputsize: '5000',
            format: 'JSON',
            start_date: chunkStart,
            end_date: chunkEnd,
            timezone: 'UTC',
        } as any);
        const url = `https://api.twelvedata.com/time_series?${params.toString()}`;
        const res = await fetch(url);
        requestsThisWindow++;
        if (!res.ok) throw new Error('Network error');
        const json = await res.json();
        if (json.status !== 'ok') throw new Error(json.message || 'API error');
        if (!meta) meta = json.meta;
        if (Array.isArray(json.values) && json.values.length > 0) allValues.push(...json.values);
        let nextStart: Date | null = null;
        if (Array.isArray(json.values) && json.values.length > 0) {
            const latest = json.values.reduce((max: any, v: any) => (!max || new Date(v.datetime) > new Date(max.datetime) ? v : max), null);
            if (latest) nextStart = addInterval(new Date(latest.datetime.replace(' ', 'T')), interval);
        }
        if (!nextStart || nextStart <= current) current = addDays(current, 5);
        else current = nextStart;
    }
    const seen = new Set();
    const deduped = allValues.filter((v) => {
        if (seen.has(v.datetime)) return false;
        seen.add(v.datetime);
        return true;
    });
    deduped.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
    return { meta, values: deduped, status: 'ok' };
}

const MarketDataPanel: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const [selectedProvider, setSelectedProvider] = useState(PROVIDERS[0].id);
    const [apiKey, setApiKey] = useState('');
    const [symbol, setSymbol] = useState('EUR/USD');
    const [interval, setInterval] = useState('1min');
    const [aggInterval, setAggInterval] = useState('1min');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [useChunked, setUseChunked] = useState(false);
    const [status, setStatus] = useState('');
    const [fetchedData, setFetchedData] = useState<any>(null);

    useEffect(() => {
        setApiKey(loadApiKey(selectedProvider));
    }, [selectedProvider]);

    const handleSaveKey = () => {
        saveApiKey(selectedProvider, apiKey);
        setStatus('API key saved!');
        setTimeout(() => setStatus(''), 1500);
    };

    const handleFetch = async () => {
        setStatus('Fetching...');
        setFetchedData(null);
        try {
            let data: any = null;
            if (selectedProvider === 'twelve_data') {
                if (useChunked && startDate && endDate) data = await fetchTwelveDataChunked(symbol, interval, apiKey, startDate, endDate);
                else {
                    const params = new URLSearchParams({ symbol, interval, apikey: apiKey, outputsize: '5000', format: 'JSON' } as any);
                    if (startDate) params.append('start_date', startDate);
                    if (endDate) params.append('end_date', endDate);
                    const url = `https://api.twelvedata.com/time_series?${params.toString()}`;
                    const res = await fetch(url);
                    if (!res.ok) throw new Error('Network error');
                    const json = await res.json();
                    if (json.status !== 'ok') throw new Error(json.message || 'API error');
                    data = json;
                }
                if (data && data.values && aggInterval && aggInterval !== interval) data = { ...data, values: aggregateOHLCV(data.values, interval, aggInterval) };
            } else if (selectedProvider === 'dukascopy') {
                // Call the backend proxy which runs dukascopy-node. Use the
                // Vite env var VITE_BACKEND_URL if provided, otherwise default
                // to http://localhost:3001.
                const backend = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:3001';

                // helper to safely parse JSON responses and provide better errors
                const parseJsonSafe = async (res: Response) => {
                    const text = await res.text();
                    if (!text) throw new Error(`Empty response body from proxy (status ${res.status})`);
                    try {
                        return JSON.parse(text);
                    } catch (err) {
                        throw new Error(`Invalid JSON from proxy (status ${res.status}): ${text.slice(0, 200)}`);
                    }
                };

                if (useChunked && startDate && endDate) {
                    // Chunked fetch: call backend per-page and show progress
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    const chunkDays = 5;
                    const msPerDay = 24 * 60 * 60 * 1000;
                    const totalDays = Math.ceil((end.getTime() - start.getTime()) / msPerDay) + 1;
                    const totalPages = Math.max(1, Math.ceil(totalDays / chunkDays));
                    const allValues: any[] = [];
                    for (let pg = 0; pg < totalPages; pg++) {
                        setStatus(`Fetching Dukascopy chunk ${pg + 1} of ${totalPages}...`);
                        const params = new URLSearchParams({
                            instrument: symbol.replace('/', '').toLowerCase(),
                            from: startDate,
                            to: endDate,
                            timeframe: 'm1',
                            page: String(pg),
                            chunkDays: String(chunkDays),
                        } as any);
                        const url = `${String(backend).replace(/\/+$/, '')}/api/dukascopy/historical?${params.toString()}`;
                        const res = await fetch(url);
                        if (!res.ok) {
                            const txt = await res.text().catch(() => '');
                            throw new Error(`Dukascopy proxy error: ${res.status} ${res.statusText} ${txt}`);
                        }
                        const json = await parseJsonSafe(res);
                        const vals = Array.isArray(json?.values) ? json.values : (json?.values || []);
                        allValues.push(...vals);
                        if (json.done) break;
                        // pause briefly to be polite
                        await sleep(200);
                    }
                    // dedupe by datetime
                    const seen = new Set();
                    const deduped = allValues.filter((v) => {
                        if (!v || !v.datetime) return false;
                        if (seen.has(v.datetime)) return false;
                        seen.add(v.datetime);
                        return true;
                    });
                    deduped.sort((a, b) => new Date(a.datetime.replace(' ', 'T')).getTime() - new Date(b.datetime.replace(' ', 'T')).getTime());
                    data = { values: deduped, status: 'ok' };
                } else {
                    const params = new URLSearchParams({
                        instrument: symbol.replace('/', '').toLowerCase(),
                        from: startDate,
                        to: endDate,
                        timeframe: 'm1',
                    } as any);
                    const url = `${String(backend).replace(/\/+$/, '')}/api/dukascopy/historical?${params.toString()}`;
                    const res = await fetch(url);
                    if (!res.ok) {
                        const txt = await res.text().catch(() => '');
                        throw new Error(`Dukascopy proxy error: ${res.status} ${res.statusText} ${txt}`);
                    }
                    const json = await parseJsonSafe(res);
                    // backend returns either values array or the raw dukascopy result
                    if (Array.isArray(json)) data = { values: json, status: 'ok' };
                    else data = json;
                }
            } else {
                throw new Error('Provider not implemented');
            }
            // Normalize dukascopy-style payloads (timestamp-based) to the frontend format
            try {
                if (data) {
                    // backend may return { values: [...] } or { values: [], status: 'ok' } or an array
                    let vals: any[] = [];
                    if (Array.isArray(data)) vals = data;
                    else if (Array.isArray(data.values)) vals = data.values;
                    else if (Array.isArray(data.data)) vals = data.data;

                    if (vals.length > 0 && (vals[0].timestamp || vals[0].datetime)) {
                        const normalized = normalizeDukascopyValues(vals);
                        if (normalized.length === 0) {
                            setStatus('No valid candles found in response');
                        } else {
                            data = { values: normalized, status: data.status || 'ok' };
                        }
                    }
                }
            } catch (err) {
                // fall back to raw data if normalization fails
                console.warn('Normalization failed', err);
            }
            setFetchedData(data);
            setStatus('Data fetched!');
        } catch (e: any) {
            setStatus('Error: ' + (e.message || e.toString()));
        }
    };

    const handleSaveData = () => {
        if (!fetchedData) return;
        const safeSymbol = symbol.replace(/\//g, '');
        const formatForFile = (s: string) => (s || '').replace(/[^\d]/g, '');
        const start = formatForFile(startDate);
        const end = formatForFile(endDate);
        const filename = `${safeSymbol}_${interval}_${start}_${end}.json`;
        saveDataAsFile(fetchedData, filename, 'json');
    };

    return (
        <div style={{ padding: 20, maxWidth: 480, background: '#f9fafb', borderRadius: 10, boxShadow: '0 2px 8px #0001' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h2 style={{ margin: 0 }}>Import Market Data</h2>
                {onBack && (
                    <button
                        onClick={onBack}
                        style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#e5e7eb', color: '#111', fontWeight: 500, cursor: 'pointer' }}
                    >
                        ← Back to Workspace
                    </button>
                )}
            </div>
            <label style={{ display: 'block', marginBottom: 10 }}>
                Provider:
                <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)} style={{ marginLeft: 10 }}>
                    {PROVIDERS.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name}
                        </option>
                    ))}
                </select>
            </label>

            {selectedProvider !== 'dukascopy' && <label style={{ display: 'block', marginBottom: 10 }}>
                API Key:
                <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={{ marginLeft: 10, width: 200 }} />
                <button onClick={handleSaveKey} style={{ marginLeft: 8 }}>
                    Save
                </button>
            </label>}

            <label style={{ display: 'block', marginBottom: 10 }}>
                Symbol:
                <input type="text" value={symbol} onChange={(e) => setSymbol(e.target.value)} style={{ marginLeft: 10, width: 140 }} />
            </label>

            {selectedProvider !== 'dukascopy' && <label style={{ display: 'block', marginBottom: 10 }}>
                Interval:
                <select value={interval} onChange={(e) => setInterval(e.target.value)} style={{ marginLeft: 10 }}>
                    <option value="1min">1min</option>
                    <option value="5min">5min</option>
                    <option value="15min">15min</option>
                    <option value="30min">30min</option>
                    <option value="1h">1h</option>
                    <option value="1day">1day</option>
                    <option value="1week">1week</option>
                    <option value="1month">1month</option>
                </select>
            </label>}

            <label style={{ display: 'block', marginBottom: 10 }}>
                Aggregate to:
                <select value={aggInterval} onChange={(e) => setAggInterval(e.target.value)} style={{ marginLeft: 10 }}>
                    <option value="1min">1min (no aggregation)</option>
                    <option value="5min">5min</option>
                    <option value="15min">15min</option>
                    <option value="30min">30min</option>
                    <option value="1h">1h</option>
                    <option value="1day">1day</option>
                    <option value="1week">1week</option>
                    <option value="1month">1month</option>
                </select>
            </label>

            <label style={{ display: 'block', marginBottom: 10 }}>
                Start Date (YYYY-MM-DD):
                <input type="text" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ marginLeft: 10, width: 160 }} placeholder="YYYY-MM-DD" />
            </label>
            <label style={{ display: 'block', marginBottom: 10 }}>
                End Date (YYYY-MM-DD):
                <input type="text" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ marginLeft: 10, width: 160 }} placeholder="YYYY-MM-DD" />
            </label>

            <label style={{ display: 'block', marginBottom: 10 }}>
                <input type="checkbox" checked={useChunked} onChange={(e) => setUseChunked(e.target.checked)} style={{ marginRight: 6 }} />
                Download in 5-day chunks (recommended for large ranges)
            </label>

            <div>
                <button onClick={handleFetch} style={{ marginRight: 8 }}>
                    Fetch Data
                </button>
                <button onClick={handleSaveData} disabled={!fetchedData}>
                    Save Data
                </button>
                {/* Import JSON file input removed per request */}
            </div>

            <div style={{ marginTop: 10, minHeight: 24, color: status.startsWith('Error') ? 'red' : '#2563eb' }}>{status}</div>
            {fetchedData && (
                <pre style={{ maxHeight: 360, overflow: 'auto', background: '#fff', padding: 10, borderRadius: 6, marginTop: 10, fontSize: 12 }}>{JSON.stringify(fetchedData, null, 2)}</pre>
            )}
        </div>
    );
};

export default MarketDataPanel;