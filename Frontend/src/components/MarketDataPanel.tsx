import React, { useEffect, useState } from 'react';

// Small helpers
function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function floorDate(date: Date, interval: string) {
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

function aggregateOHLCV(data: any[], fromInterval: string, toInterval: string) {
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

function formatDateTime(date: Date) {
    return date.toISOString().replace('T', ' ').slice(0, 19);
}

function addDays(date: Date, days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function addInterval(date: Date, interval: string) {
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

// Providers: only Twelve Data for now
const PROVIDERS = [{ id: 'twelve_data', name: 'Twelve Data' }];

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
async function fetchTwelveDataChunked(symbol: string, interval: string, apiKey: string, startDate: string, endDate: string) {
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

const MarketDataPanel: React.FC = () => {
    const [selectedProvider, setSelectedProvider] = useState(PROVIDERS[0].id);
    const [apiKey, setApiKey] = useState('');
    const [symbol, setSymbol] = useState('EURUSD');
    const [interval, setInterval] = useState('1day');
    const [aggInterval, setAggInterval] = useState('1day');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [useChunked, setUseChunked] = useState(true);
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
            } else {
                throw new Error('Provider not implemented');
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
            <h2>Market Data</h2>
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

            <label style={{ display: 'block', marginBottom: 10 }}>
                API Key:
                <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={{ marginLeft: 10, width: 200 }} />
                <button onClick={handleSaveKey} style={{ marginLeft: 8 }}>
                    Save
                </button>
            </label>

            <label style={{ display: 'block', marginBottom: 10 }}>
                Symbol:
                <input type="text" value={symbol} onChange={(e) => setSymbol(e.target.value)} style={{ marginLeft: 10, width: 140 }} />
            </label>

            <label style={{ display: 'block', marginBottom: 10 }}>
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
            </label>

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
            </div>

            <div style={{ marginTop: 10, minHeight: 24, color: status.startsWith('Error') ? 'red' : '#2563eb' }}>{status}</div>
            {fetchedData && (
                <pre style={{ maxHeight: 360, overflow: 'auto', background: '#fff', padding: 10, borderRadius: 6, marginTop: 10, fontSize: 12 }}>{JSON.stringify(fetchedData, null, 2)}</pre>
            )}
        </div>
    );
};

export default MarketDataPanel;