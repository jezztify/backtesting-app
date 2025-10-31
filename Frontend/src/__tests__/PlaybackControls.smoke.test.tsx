import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../components/TimeframeSelector', () => ({ default: () => React.createElement('div', null, 'tf') }));

import PlaybackControls from '../components/PlaybackControls';

describe('PlaybackControls smoke', () => {
    it('renders and responds to play/pause and controls', async () => {
        const onTogglePlay = vi.fn();
        const onSeek = vi.fn();
        const onStep = vi.fn();
        const onTickRateChange = vi.fn();
        const onTickSourceChange = vi.fn();
        const onJumpToCurrent = vi.fn();

        const { container, getByText, getByLabelText } = render(
            <PlaybackControls
                playbackIndex={0}
                maxIndex={10}
                isPlaying={false}
                tickRate={10}
                tickSource={'M1'}
                availableTickSources={['M1']}
                onTogglePlay={onTogglePlay}
                onSeek={onSeek}
                onStep={onStep}
                onTickRateChange={onTickRateChange}
                onTickSourceChange={onTickSourceChange}
                onJumpToCurrent={onJumpToCurrent}
            /> as any
        );

        expect(container).toBeTruthy();
        // Play button should toggle
        const playBtn = getByText('Play');
        playBtn && playBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(onTogglePlay).toHaveBeenCalled();

        // Prev/Next buttons exist
        const prev = getByText('◀ Prev');
        const next = getByText('Next ▶');
        expect(prev).toBeTruthy();
        expect(next).toBeTruthy();

        // Tick rate select exists
        const rateSelect = getByLabelText('Tick Rate') as HTMLSelectElement;
        expect(rateSelect).toBeTruthy();
    });
});
