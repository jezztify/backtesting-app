import React from 'react';
import { render } from '@testing-library/react';

import TimeframeSelector from '../components/TimeframeSelector';

describe('TimeframeSelector smoke', () => {
    it('renders without crashing', () => {
        const { container } = render(<TimeframeSelector timeframe={'Daily'} onChange={() => { }} /> as any);
        expect(container).toBeTruthy();
    });
});
