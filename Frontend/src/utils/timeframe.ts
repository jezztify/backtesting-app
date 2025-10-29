import { Timeframe, TimeframeConfig } from '../types/series';

// TickMarkType enum values from lightweight-charts
enum TickMarkType {
  Year = 0,
  Month = 1,
  DayOfMonth = 2,
  Time = 3,
  TimeWithSeconds = 4,
}

/**
 * Helper function to format timestamp to local date/time parts
 */
const formatTimestamp = (timestamp: number, timezone: string = 'UTC'): { date: Date; hours: string; minutes: string; day: string; month: string; year: string } => {
  const date = new Date(timestamp * 1000);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  const hours = get('hour').padStart(2, '0');
  const minutes = get('minute').padStart(2, '0');
  const day = get('day');
  const month = get('month');
  const year = get('year');
  return { date, hours, minutes, day, month, year };
};

/**
 * Create a tick mark formatter for minute-based timeframes (M1, M5, M15, M30)
 */
const createMinuteFormatter = (timezone: string = 'UTC') => {
  return (time: number, tickMarkType: number, _locale: string) => {
    const { hours, minutes, day, month, year } = formatTimestamp(time, timezone);
    switch (tickMarkType) {
      case TickMarkType.Year:
        return year;
      case TickMarkType.Month:
        return month;
      case TickMarkType.DayOfMonth:
        return `${month} ${day}`;
      case TickMarkType.Time:
      case TickMarkType.TimeWithSeconds:
        return `${hours}:${minutes}`;
      default:
        return `${hours}:${minutes}`;
    }
  };
};

/**
 * Create a tick mark formatter for hourly timeframes (H1, H4)
 */
const createHourlyFormatter = (timezone: string = 'UTC') => {
  return (time: number, tickMarkType: number, _locale: string) => {
    const { hours, minutes, day, month, year } = formatTimestamp(time, timezone);
    switch (tickMarkType) {
      case TickMarkType.Year:
        return year;
      case TickMarkType.Month:
        return month;
      case TickMarkType.DayOfMonth:
        return `${month} ${day}`;
      case TickMarkType.Time:
      case TickMarkType.TimeWithSeconds:
        return `${hours}:${minutes}`;
      default:
        return `${hours}:${minutes}`;
    }
  };
};

/**
 * Create a tick mark formatter for daily timeframes
 */
const createDailyFormatter = (timezone: string = 'UTC') => {
  return (time: number, tickMarkType: number, _locale: string) => {
    const { day, month, year } = formatTimestamp(time, timezone);
    switch (tickMarkType) {
      case TickMarkType.Year:
        return year;
      case TickMarkType.Month:
        return month;
      case TickMarkType.DayOfMonth:
      case TickMarkType.Time:
      case TickMarkType.TimeWithSeconds:
        return `${month} ${day}`;
      default:
        return `${month} ${day}`;
    }
  };
};

/**
 * Create a tick mark formatter for weekly/monthly timeframes
 */
const createLongTermFormatter = (timezone: string = 'UTC') => {
  return (time: number, tickMarkType: number, _locale: string) => {
    const { month, year } = formatTimestamp(time, timezone);
    switch (tickMarkType) {
      case TickMarkType.Year:
        return year;
      case TickMarkType.Month:
      case TickMarkType.DayOfMonth:
      case TickMarkType.Time:
      case TickMarkType.TimeWithSeconds:
        return month;
      default:
        return month;
    }
  };
};

/**
 * Detect timeframe from filename
 * Expected patterns: M1, M5, M15, M30, H1, H4, Daily, Weekly, Monthly
 */
export const detectTimeframeFromFilename = (filename: string): Timeframe => {
  const fn = filename.toLowerCase();

  // Minute-based patterns: handle separators like '_' or '-' or start/end
  const sep = /(^|[^0-9a-z])/;
  const sepEnd = /([^0-9a-z]|$)/;
  if (fn.match(new RegExp('(^|[^0-9a-z])1\\s*min([^0-9a-z]|$)'))) return 'M1';
  if (fn.match(new RegExp('(^|[^0-9a-z])m1([^0-9a-z]|$)'))) return 'M1';
  if (fn.match(new RegExp('(^|[^0-9a-z])5\\s*min([^0-9a-z]|$)')) || fn.match(new RegExp('(^|[^0-9a-z])m5([^0-9a-z]|$)'))) return 'M5';
  if (fn.match(new RegExp('(^|[^0-9a-z])15\\s*min([^0-9a-z]|$)')) || fn.match(new RegExp('(^|[^0-9a-z])m15([^0-9a-z]|$)'))) return 'M15';
  if (fn.match(new RegExp('(^|[^0-9a-z])30\\s*min([^0-9a-z]|$)')) || fn.match(new RegExp('(^|[^0-9a-z])m30([^0-9a-z]|$)'))) return 'M30';

  // Hour-based patterns: '1h', 'h1', '1 hour' — handle separators
  if (fn.match(new RegExp('(^|[^0-9a-z])1\\s*h(?:our)?s?([^0-9a-z]|$)')) || fn.match(new RegExp('(^|[^0-9a-z])h1([^0-9a-z]|$)'))) return 'H1';
  if (fn.match(new RegExp('(^|[^0-9a-z])4\\s*h(?:our)?s?([^0-9a-z]|$)')) || fn.match(new RegExp('(^|[^0-9a-z])h4([^0-9a-z]|$)'))) return 'H4';

  // Day/week/month
  if (fn.includes('daily') || fn.match(/\bdaily\b|\bd\b|\bd1\b/)) return 'Daily';
  if (fn.includes('weekly') || fn.match(/\bweekly\b|\bw\b|\bw1\b/)) return 'Weekly';
  if (fn.includes('monthly') || fn.match(/\bmonthly\b|\bmn\b|\bmn1\b/)) return 'Monthly';

  return 'Unknown';
};

/**
 * Get timeframe configuration for chart display
 */
export const getTimeframeConfig = (timeframe: Timeframe, timezone: string = 'UTC'): TimeframeConfig => {
  switch (timeframe) {
    case 'M1':
    case 'M5':
    case 'M15':
    case 'M30':
      return {
        timeframe,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: createMinuteFormatter(timezone),
      };

    case 'H1':
    case 'H4':
      return {
        timeframe,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: createHourlyFormatter(timezone),
      };

    case 'Daily':
      return {
        timeframe,
        timeVisible: false,
        secondsVisible: false,
        tickMarkFormatter: createDailyFormatter(timezone),
      };

    case 'Weekly':
    case 'Monthly':
      return {
        timeframe,
        timeVisible: false,
        secondsVisible: false,
        tickMarkFormatter: createLongTermFormatter(timezone),
      };

    case 'Unknown':
    default:
      return {
        timeframe: 'Unknown',
        timeVisible: false,
        secondsVisible: false,
      };
  }
};

/**
 * Get a human-readable label for the timeframe
 */
export const getTimeframeLabel = (timeframe: Timeframe): string => {
  switch (timeframe) {
    case 'M1': return '1 Minute';
    case 'M5': return '5 Minutes';
    case 'M15': return '15 Minutes';
    case 'M30': return '30 Minutes';
    case 'H1': return '1 Hour';
    case 'H4': return '4 Hours';
    case 'Daily': return 'Daily';
    case 'Weekly': return 'Weekly';
    case 'Monthly': return 'Monthly';
    case 'Unknown': return 'Unknown';
    default: return 'Unknown';
  }
};

/**
 * Calculate appropriate padding based on timeframe
 * Returns number of bars to use as padding
 */
export const getTimeframePadding = (timeframe: Timeframe): number => {
  switch (timeframe) {
    case 'M1':
      return 60 * 24 * 4; // 4 days of 1-minute bars
    case 'M5':
      return 12 * 24 * 4; // 4 days of 5-minute bars
    case 'M15':
      return 4 * 24 * 10; // 10 days of 15-minute bars
    case 'M30':
      return 2 * 24 * 15; // 15 days of 30-minute bars
    case 'H1':
      return 24 * 30; // 30 days of 1-hour bars
    case 'H4':
      return 6 * 60; // 60 days of 4-hour bars
    case 'Daily':
      return 120; // ~4 months of daily bars
    case 'Weekly':
      return 52; // ~1 year of weekly bars
    case 'Monthly':
      return 24; // ~2 years of monthly bars
    case 'Unknown':
    default:
      return 120; // Default to daily padding
  }
};

/**
 * Get the bar interval in seconds for a given timeframe
 * This is used for calculating whitespace padding
 */
export const getBarIntervalSeconds = (timeframe: Timeframe): number => {
  switch (timeframe) {
    case 'M1':
      return 60; // 1 minute
    case 'M5':
      return 5 * 60; // 5 minutes
    case 'M15':
      return 15 * 60; // 15 minutes
    case 'M30':
      return 30 * 60; // 30 minutes
    case 'H1':
      return 60 * 60; // 1 hour
    case 'H4':
      return 4 * 60 * 60; // 4 hours
    case 'Daily':
      return 24 * 60 * 60; // 1 day
    case 'Weekly':
      return 7 * 24 * 60 * 60; // 7 days
    case 'Monthly':
      return 30 * 24 * 60 * 60; // ~30 days (approximate)
    case 'Unknown':
    default:
      return 24 * 60 * 60; // Default to 1 day
  }
};

/**
 * Get the timeframe multiplier in minutes
 * Used for normalizing playback index across different timeframes
 */
export const getTimeframeMultiplier = (timeframe: Timeframe): number => {
  switch (timeframe) {
    case 'M1':
      return 1;
    case 'M5':
      return 5;
    case 'M15':
      return 15;
    case 'M30':
      return 30;
    case 'H1':
      return 60;
    case 'H4':
      return 240;
    case 'Daily':
      return 1440;
    case 'Weekly':
      return 10080;
    case 'Monthly':
      return 43800;
    case 'Unknown':
    default:
      return 1440; // Default to Daily
  }
};
