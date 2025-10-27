import { Candle } from '../types/series';

const DATE_PARSER_CACHE = new Map<string, number>();

const parseTimestamp = (dateValue: string, timeValue?: string): number | null => {
  const dateTrimmed = dateValue.trim();
  if (dateTrimmed === '') {
    return null;
  }

  // Combine date and time if both provided
  const combinedKey = timeValue ? `${dateTrimmed} ${timeValue.trim()}` : dateTrimmed;
  const cached = DATE_PARSER_CACHE.get(combinedKey);
  if (cached !== undefined) {
    return cached;
  }

  let timestamp: number | null = null;

  // Pure numeric timestamp
  if (/^\d+$/.test(dateTrimmed)) {
    const numeric = Number(dateTrimmed);

    // Check if it's a Unix timestamp (10 or 13 digits)
    if (numeric > 1e12) {
      timestamp = Math.floor(numeric / 1000);
    } else if (numeric > 1e9) {
      timestamp = numeric;
    } else if (dateTrimmed.length === 8) {
      // YYYYMMDD format (e.g., 20010102)
      const year = parseInt(dateTrimmed.substring(0, 4), 10);
      const month = parseInt(dateTrimmed.substring(4, 6), 10) - 1; // Month is 0-indexed
      const day = parseInt(dateTrimmed.substring(6, 8), 10);

      // Parse time if provided (HHMMSS format)
      let hours = 0, minutes = 0, seconds = 0;
      if (timeValue) {
        const timeTrimmed = timeValue.trim();
        if (/^\d{6}$/.test(timeTrimmed)) {
          hours = parseInt(timeTrimmed.substring(0, 2), 10);
          minutes = parseInt(timeTrimmed.substring(2, 4), 10);
          seconds = parseInt(timeTrimmed.substring(4, 6), 10);
        }
      }

      const date = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
      timestamp = Math.floor(date.getTime() / 1000);
    } else {
      timestamp = numeric;
    }
  } else {
    // MT5 format: 2025.01.01 → convert dots to dashes for better parsing
    const normalizedDate = dateTrimmed.replace(/\./g, '-');
    const dateTimeString = timeValue ? `${normalizedDate} ${timeValue.trim()}` : normalizedDate;

    const parsed = Date.parse(dateTimeString);
    if (!Number.isNaN(parsed)) {
      timestamp = Math.floor(parsed / 1000);
    }
  }

  if (timestamp !== null) {
    DATE_PARSER_CACHE.set(combinedKey, timestamp);
  }

  return timestamp;
};

export interface CsvParseResult {
  candles: Candle[];
  errors: string[];
}

export const parseCsvCandles = async (file: File): Promise<CsvParseResult> => {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { candles: [], errors: ['CSV file is empty'] };
  }

  // Detect delimiter: tab (MT5) or comma (standard CSV)
  const delimiter = lines[0].includes('\t') ? '\t' : ',';

  // Normalize column names: remove angle brackets, convert to lowercase
  const header = lines[0]
    .split(delimiter)
    .map((h) => h.trim().replace(/[<>]/g, '').toLowerCase());

  // Map MT5 column names to expected names
  const columnMapping: Record<string, string[]> = {
    time: ['time', 'date', 'datetime', 'timestamp', 'dtyyyymmdd'],
    open: ['open'],
    high: ['high'],
    low: ['low'],
    close: ['close'],
    volume: ['volume', 'vol', 'tickvol'],
  };

  // Find the actual column index for each required field
  const findColumnIndex = (aliases: string[]): number => {
    for (const alias of aliases) {
      const index = header.indexOf(alias);
      if (index !== -1) {
        return index;
      }
    }
    return -1;
  };

  const timeIndex = findColumnIndex(columnMapping.time);
  const openIndex = findColumnIndex(columnMapping.open);
  const highIndex = findColumnIndex(columnMapping.high);
  const lowIndex = findColumnIndex(columnMapping.low);
  const closeIndex = findColumnIndex(columnMapping.close);
  const volumeIndex = findColumnIndex(columnMapping.volume);

  // Check for separate TIME column (MT5 intraday format or tick data format)
  const timeColumnIndex = header.indexOf('time');
  const dateColumnIndex = header.indexOf('date');
  const dtColumnIndex = header.indexOf('dtyyyymmdd'); // Tick data format
  const hasDateTimeColumns =
    (dateColumnIndex !== -1 && timeColumnIndex !== -1 && dateColumnIndex !== timeColumnIndex) ||
    (dtColumnIndex !== -1 && timeColumnIndex !== -1 && dtColumnIndex !== timeColumnIndex);

  // Check for missing required columns
  const missingColumns: string[] = [];
  if (timeIndex === -1 && !hasDateTimeColumns) missingColumns.push('time/date');
  if (openIndex === -1) missingColumns.push('open');
  if (highIndex === -1) missingColumns.push('high');
  if (lowIndex === -1) missingColumns.push('low');
  if (closeIndex === -1) missingColumns.push('close');

  if (missingColumns.length > 0) {
    return {
      candles: [],
      errors: [`Missing required columns: ${missingColumns.join(', ')}`],
    };
  }

  const candles: Candle[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') {
      continue;
    }

    const cells = line.split(delimiter);
    if (cells.length < 5) {
      errors.push(`Line ${i + 1}: not enough columns`);
      continue;
    }

    // Parse timestamp - handle both single column and date+time columns
    let time: number | null = null;
    if (hasDateTimeColumns) {
      // Handle tick data format (dtyyyymmdd + time) or standard (date + time)
      const dateCol = dtColumnIndex !== -1 ? dtColumnIndex : dateColumnIndex;
      time = parseTimestamp(cells[dateCol], cells[timeColumnIndex]);
    } else {
      time = parseTimestamp(cells[timeIndex]);
    }

    const open = Number.parseFloat(cells[openIndex]);
    const high = Number.parseFloat(cells[highIndex]);
    const low = Number.parseFloat(cells[lowIndex]);
    const close = Number.parseFloat(cells[closeIndex]);
    const volumeValue = volumeIndex >= 0 ? Number.parseFloat(cells[volumeIndex]) : undefined;

    if (time === null || time <= 0 || [open, high, low, close].some((value) => Number.isNaN(value))) {
      errors.push(`Line ${i + 1}: invalid numeric value or timestamp`);
      continue;
    }

    candles.push({ time, open, high, low, close, volume: Number.isNaN(volumeValue) ? undefined : volumeValue });
  }

  return { candles, errors };
};