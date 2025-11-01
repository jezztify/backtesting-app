export const clampLineWidth = (value: number): number => Math.min(Math.max(value, 1), 8);

// Parse a comma/space separated string of levels (percent or decimal) into normalized [0..1] numbers
export const parseFibonacciLevels = (text: string): number[] => {
  if (!text || !text.trim()) return [];
  const parts = text.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
  const parsed = parts.map((p) => {
    if (p.endsWith('%')) {
      const num = parseFloat(p.slice(0, -1));
      return Number.isNaN(num) ? NaN : num / 100;
    }
    const num = parseFloat(p);
    if (!Number.isNaN(num)) {
      return num > 1 ? Math.min(Math.max(num / 100, 0), 1) : Math.min(Math.max(num, 0), 1);
    }
    return NaN;
  }).filter(Number.isFinite).map(n => Math.min(Math.max(n, 0), 1));
  return parsed;
};

export const formatLevelsDisplay = (levels?: number[]): string => {
  const defaults = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const use = levels && levels.length > 0 ? levels : defaults;
  return use.map(l => (l * 100).toFixed(l === 0 || l === 1 ? 0 : 1) + '%').join(', ');
};
