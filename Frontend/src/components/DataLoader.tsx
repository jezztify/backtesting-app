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
        // Check for Twelve Data format
        if (json && Array.isArray(json.values)) {
          // Convert to Candle[]
          const candles = json.values.map((v: any) => {
            // Try to parse datetime as Unix timestamp (seconds)
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
            // Try to infer timeframe from meta or filename
            let timeframe = detectTimeframeFromFilename(file.name);
            if ((!timeframe || timeframe === 'Unknown') && json.meta && typeof json.meta.interval === 'string') {
              // Map Twelve Data interval to Timeframe
              const map: Record<string, Timeframe> = {
                '1min': 'M1', '5min': 'M5', '15min': 'M15', '30min': 'M30',
                '1h': 'H1', '4h': 'H4', '1day': 'Daily', '1week': 'Weekly', '1month': 'Monthly',
              };
              timeframe = map[json.meta.interval] || 'Unknown';
            }
            onDatasetLoaded(file.name.replace(/\.(csv|json)$/i, ''), candles, timeframe);
          } else {
            setErrors(['No valid candles found in JSON file']);
          }
        } else {
          setErrors(['JSON file not recognized as Twelve Data format']);
        }
      } else {
        setErrors(['Unsupported file type. Please upload a CSV or Twelve Data JSON file.']);
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Failed to parse file']);
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="data-loader">
      <label className="file-upload">
        <input type="file" accept=".csv,application/json,text/csv,application/json" onChange={handleFileChange} disabled={isLoading} />
        <span>{isLoading ? 'Loading…' : 'Import Data'}</span>
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