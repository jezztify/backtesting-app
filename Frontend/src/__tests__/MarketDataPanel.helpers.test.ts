import { floorDate, aggregateOHLCV, formatDateTime, addDays, addInterval, normalizeDukascopyValues } from '../components/MarketDataPanel';

describe('MarketDataPanel helpers', () => {
  test('floorDate rounds to expected buckets', () => {
    const d = new Date('2025-10-31T12:34:56Z');
    expect(floorDate(d, '1min').getSeconds()).toBe(0);
    const d5 = new Date('2025-10-31T12:37:10Z');
    expect(floorDate(d5, '5min').getMinutes() % 5).toBe(0);
    const dow = new Date('2025-10-31T00:00:00Z');
    const fweek = floorDate(dow, '1week');
    expect(fweek.getDay()).toBe(0);
  });

  test('aggregateOHLCV groups rows into buckets', () => {
    const rows = [
      { datetime: '2025-10-31 00:00:00', open: '1.0', high: '1.1', low: '0.9', close: '1.05', volume: '10' },
      { datetime: '2025-10-31 00:01:00', open: '1.05', high: '1.2', low: '1.0', close: '1.15', volume: '5' },
    ];
    const out = aggregateOHLCV(rows, '1min', '5min');
    expect(out.length).toBe(1);
    expect(out[0].volume).toBe('15');
    expect(out[0].open).toBe('1.0');
    expect(out[0].close).toBe('1.15');
  });

  test('date helpers produce consistent strings and increments', () => {
    const d = new Date('2025-10-31T00:00:00Z');
    expect(formatDateTime(d)).toContain('2025-10-31');
  const d2 = addDays(d, 2);
  // sanity: day number should change (handles month rollover)
  expect(d2.getDate()).not.toBe(d.getDate());
    const d3 = addInterval(d, '1h');
    expect(d3.getTime()).toBeGreaterThan(d.getTime());
  });

  test('normalizeDukascopyValues handles several timestamp formats', () => {
    const msTs = { timestamp: 1759276800000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 };
    const secTs = { time: 1759276800, o: 1, h: 2, l: 0.5, c: 1.5, v: 50 };
    const isoTs = { datetime: '2025-10-31T00:00:00Z', open: 1, high: 2, low: 0.5, close: 1.5 };
    const out = normalizeDukascopyValues([msTs, secTs, isoTs]);
    expect(out.length).toBe(3);
    expect(out[0].open).toBe(String(msTs.open));
    expect(out[1].open).toBe(String(secTs.o));
  });
});
