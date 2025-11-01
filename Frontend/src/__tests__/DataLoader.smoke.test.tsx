import React from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';

// Mock parseCsvCandles to avoid File/CSV parsing
vi.mock('../utils/csv', () => ({ parseCsvCandles: vi.fn(async () => ({ candles: [] })) }));

vi.mock('../components/TimeframeSelector', () => ({ default: () => React.createElement('div', null, 'tf') }));

import DataLoader from '../components/DataLoader';

describe('DataLoader smoke', () => {
    it('renders without crashing', () => {
        const { container } = render(<DataLoader onDatasetLoaded={() => { }} />);
        expect(container).toBeTruthy();
    });
});
