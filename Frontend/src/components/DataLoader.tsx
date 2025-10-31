import { ChangeEvent, useState } from 'react';
import { parseCsvCandles } from '../utils/csv';
import { Candle, Timeframe } from '../types/series';
import { detectTimeframeFromFilename } from '../utils/timeframe';

interface DataLoaderProps {
  onDatasetLoaded: (label: string, candles: Candle[], timeframe: Timeframe) => void;
}

const DataLoader = ({ onDatasetLoaded }: DataLoaderProps) => {
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setIsLoading(true);
    setErrors([]);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'csv') {
        const result = await parseCsvCandles(file);
        if (result.errors.length > 0) {
          setErrors(result.errors);
        }
        if (result.candles.length > 0) {
          const timeframe = detectTimeframeFromFilename(file.name);
          onDatasetLoaded(file.name.replace(/\.(csv|json)$/i, ''), result.candles, timeframe);
        }
      } else if (ext === 'json') {
        const text = await file.text();
        let json: any;
        try {
          json = JSON.parse(text);
        } catch (e) {
          setErrors(['Invalid JSON file']);
          return;
        }

        // Helper: normalize arrays of dukascopy-style objects into Candle[]
        const parseDukascopyArray = (vals: any[]): Candle[] => {
          if (!Array.isArray(vals)) return [];
          const result: Candle[] = [];
          for (const v of vals) {
            if (!v) continue;
            // find timestamp-like field
            let ts: number | null = null;
            const cand = v.timestamp ?? v.time ?? v.t ?? v.datetime ?? v.date ?? null;
            if (typeof cand === 'number') ts = cand;
            else if (typeof cand === 'string' && /^\d+$/.test(cand)) ts = Number(cand);
            else if (typeof cand === 'string') {
              const parsed = Date.parse(cand.replace(' ', 'T'));
              if (!Number.isNaN(parsed)) ts = parsed;
            }

            if (ts != null) {
              // Normalize numeric timestamps to seconds.
              // Dukascopy files may contain seconds, milliseconds or microseconds.
              // Reduce by factors of 1000 until the value looks like seconds (around 1e9-1e10).
              while (ts > 1e11) {
                ts = Math.floor(ts / 1000);
              }
            }

            const open = v.open ?? v.o ?? v.O ?? null;
            const high = v.high ?? v.h ?? v.H ?? null;
            const low = v.low ?? v.l ?? v.L ?? null;
            const close = v.close ?? v.c ?? v.C ?? null;
            const volume = v.volume ?? v.v ?? v.V ?? undefined;

            if (ts == null || open == null || high == null || low == null || close == null) continue;

            const timeSec = Math.floor(Number(ts));
            const o = parseFloat(String(open));
            const h = parseFloat(String(high));
            const l = parseFloat(String(low));
            const c = parseFloat(String(close));
            const vol = volume !== undefined && volume !== null ? parseFloat(String(volume)) : undefined;
            if ([o, h, l, c].some((n) => Number.isNaN(n))) continue;
            result.push({ time: timeSec, open: o, high: h, low: l, close: c, volume: Number.isNaN(vol as number) ? undefined : vol });
          }
          return result;
        };

        // Handle Twelve Data format (json.values)
        if (json && Array.isArray(json.values)) {
          const candles = json.values.map((v: any) => {
            const dt = v.datetime ? Math.floor(new Date(v.datetime.replace(' ', 'T')).getTime() / 1000) : undefined;
            return {
              time: dt,
              open: parseFloat(v.open),
              high: parseFloat(v.high),
              low: parseFloat(v.low),
              close: parseFloat(v.close),
              volume: v.volume !== undefined ? parseFloat(v.volume) : undefined,
            };
          }).filter((c: any) => c.time && !isNaN(c.open) && !isNaN(c.high) && !isNaN(c.low) && !isNaN(c.close));
          if (candles.length > 0) {
            let timeframe = detectTimeframeFromFilename(file.name);
            if ((!timeframe || timeframe === 'Unknown') && json.meta && typeof json.meta.interval === 'string') {
              const map: Record<string, Timeframe> = {
                '1min': 'M1', '5min': 'M5', '15min': 'M15', '30min': 'M30',
                '1h': 'H1', '4h': 'H4', '1day': 'Daily', '1week': 'Weekly', '1month': 'Monthly',
              };
              timeframe = map[json.meta.interval] || 'Unknown';
            }
            onDatasetLoaded(file.name.replace(/\.(csv|json)$/i, ''), candles, timeframe);
            return;
          }
        }

        // Handle Dukascopy native JSON (array or wrapped in .values/.data)
        const vals = Array.isArray(json) ? json : Array.isArray(json.values) ? json.values : Array.isArray(json.data) ? json.data : [];

        // Dukascopy comes in two common JSON shapes:
        // 1) array of objects: [{ timestamp, open, high, low, close, volume }, ...]
        // 2) array of arrays: [[ts, open, high, low, close, volume], ...]
        let dukCands: Candle[] = [];
        if (vals.length > 0 && Array.isArray(vals[0])) {
          // arrays-of-arrays case
          dukCands = (vals as any[])
            .map((arr) => {
              if (!Array.isArray(arr) || arr.length < 5) return null;
              let ts: any = arr[0];
              if (typeof ts === 'string' && /^\d+$/.test(ts)) ts = Number(ts);
              if (typeof ts === 'number') {
                // Normalize to seconds (dukascopy timestamps may be ms)
                while (ts > 1e11) {
                  ts = Math.floor(ts / 1000);
                }
              }
              const timeSec = Number.isFinite(ts) ? Math.floor(ts) : undefined;
              const o = parseFloat(String(arr[1]));
              const h = parseFloat(String(arr[2]));
              const l = parseFloat(String(arr[3]));
              const c = parseFloat(String(arr[4]));
              const vol = arr.length >= 6 ? Number(arr[5]) : undefined;
              if (timeSec == null || [o, h, l, c].some((n) => Number.isNaN(n))) return null;
              return { time: timeSec, open: o, high: h, low: l, close: c, volume: typeof vol === 'number' && !Number.isNaN(vol) ? vol : undefined } as Candle;
            })
            .filter((c) => c !== null) as Candle[];
        } else {
          dukCands = parseDukascopyArray(vals);
        }

        if (dukCands.length > 0) {
          const timeframe = detectTimeframeFromFilename(file.name) || 'Unknown';
          onDatasetLoaded(file.name.replace(/\.(csv|json)$/i, ''), dukCands, timeframe);
          return;
        }

        setErrors(['JSON file not recognized as Twelve Data or Dukascopy format']);
      } else {
        setErrors(['Unsupported file type. Please upload a CSV or Twelve Data/Dukascopy JSON file.']);
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Failed to parse file']);
    } finally {
      setIsLoading(false);
      try {
        (event.target as HTMLInputElement).value = '';
      } catch { }
    }
  };

  return (
    <div className="data-loader">
      <label className="file-upload">
        <input type="file" accept=".csv,application/json,text/csv,application/json" onChange={handleFileChange} disabled={isLoading} />
        <span>{isLoading ? 'Loading…' : 'Load Market Data'}</span>
      </label>
      {errors.length > 0 && (
        <ul className="error-list">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DataLoader;