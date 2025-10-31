import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

// We'll create per-test mocks by mocking the module inside each test via dynamic import.

describe('PropertiesPanelModal smoke', () => {
    it('renders "Drawing not found." when no drawing exists', async () => {
        // Ensure a clean module registry so our doMock takes effect
        vi.resetModules();
        // Use doMock to avoid hoisting; set module mock at runtime
        vi.doMock('../state/drawingStore', () => ({
            useDrawingStore: (selector: any) => selector({ drawings: [] }),
        }));

        const module = await import('../components/PropertiesPanelModal');
        const PropertiesPanelModal = module.default;

        const { getByText } = render(
            <PropertiesPanelModal drawingId="missing" onClose={() => { }} onDragStart={() => { }} pricePrecision={5} />
        );

        expect(getByText('Drawing not found.')).toBeTruthy();
    });

    it('renders rectangle properties when rectangle drawing exists', async () => {
        const rect = {
            id: 'r1',
            type: 'rectangle',
            start: { time: 1, price: 1 },
            end: { time: 2, price: 2 },
            style: { strokeColor: '#000000', fillColor: '#ffffff', opacity: 0.25, strokeOpacity: 1 },
        };

        // Reset modules before applying a different mock
        vi.resetModules();
        vi.doMock('../state/drawingStore', () => ({
            useDrawingStore: (selector: any) =>
                selector({
                    drawings: [rect],
                    updateRectangleStyle: () => { },
                    updateTrendlineStyle: () => { },
                    updatePositionStyle: () => { },
                    updateVolumeProfileStyle: () => { },
                    updateFibonacciStyle: () => { },
                    updateFibonacciLevels: () => { },
                    midlineEnabled: false,
                    setMidlineEnabled: () => { },
                }),
        }));

        const module = await import('../components/PropertiesPanelModal');
        const PropertiesPanelModal = module.default;

        const { getByText } = render(
            <PropertiesPanelModal drawingId="r1" onClose={() => { }} onDragStart={() => { }} pricePrecision={2} />
        );

        expect(getByText('Rectangle Properties')).toBeTruthy();
    });
});
