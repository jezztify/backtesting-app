export const MAX_PRICE_PRECISION = 8;
const PRECISION_TOLERANCE = 1e-8;

export const computeValuePrecision = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    let precision = 0;
    while (precision < MAX_PRICE_PRECISION) {
        const factor = Math.pow(10, precision);
        const scaled = value * factor;
        if (Math.abs(Math.round(scaled) - scaled) < PRECISION_TOLERANCE) {
            return precision;
        }
        precision += 1;
    }
    return MAX_PRICE_PRECISION;
};

export const formatNumberToPrecision = (value: number, precision: number): number => {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
};

export const determinePriceFormat = (values: number[]) => {
    if (!values || values.length === 0) {
        return { type: 'price' as const, precision: 2, minMove: 0.01 };
    }

    let maxPrecision = 0;
    const uniqueValues = new Set<number>();

    values.forEach((v) => {
        if (!Number.isFinite(v)) return;
        uniqueValues.add(v);
        const precision = computeValuePrecision(v);
        if (precision > maxPrecision) maxPrecision = precision;
    });

    const sortedValues = Array.from(uniqueValues).sort((a, b) => a - b);
    let minDiff = Number.POSITIVE_INFINITY;
    for (let i = 1; i < sortedValues.length; i += 1) {
        const diff = sortedValues[i] - sortedValues[i - 1];
        if (diff > PRECISION_TOLERANCE && diff < minDiff) {
            minDiff = diff;
        }
    }

    if (!Number.isFinite(minDiff) || minDiff === 0) {
        minDiff = 1 / Math.pow(10, maxPrecision || 2);
    }

    const minMovePrecision = computeValuePrecision(minDiff);
    const precision = Math.min(MAX_PRICE_PRECISION, Math.max(maxPrecision, minMovePrecision));
    const minMove = formatNumberToPrecision(minDiff, precision);

    return { type: 'price' as const, precision, minMove };
};

export const formatPrice = (value: number | undefined | null, precision: number): string => {
    if (value === undefined || value === null || !Number.isFinite(value)) return '';
    return value.toFixed(precision);
};
