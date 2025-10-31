import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MarketDataPanel from '../components/MarketDataPanel';

describe('MarketDataPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders basic UI and back button (smoke)', async () => {
    const onBack = vi.fn();
    render(<MarketDataPanel onBack={onBack} />);

    // heading and buttons exist
    expect(screen.getByText(/Import Market Data/i)).toBeInTheDocument();
    const back = screen.getByRole('button', { name: /Back to Workspace/i });
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalled();
    expect(screen.getByText(/Fetch Data/i)).toBeInTheDocument();
    expect(screen.getByText(/Save Data/i)).toBeInTheDocument();
  });

  it('fetches data for Twelve Data and triggers save flow', async () => {
    // Mock fetch to return a valid twelve-data style response
    const mockResponse = {
      status: 'ok',
      values: [
        {
          datetime: '2025-01-01 00:00:00',
          open: '1.1000',
          high: '1.2000',
          low: '1.0000',
          close: '1.1500',
          volume: '100',
        },
      ],
    };

    // @ts-ignore - override global fetch
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(mockResponse) }));

    // Mock URL.createObjectURL and revoke to avoid real blob work (jsdom may not implement these)
    if (!(URL as any).createObjectURL) {
      (URL as any).createObjectURL = vi.fn(() => 'blob:mock');
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    }
    if (!(URL as any).revokeObjectURL) {
      (URL as any).revokeObjectURL = vi.fn(() => {});
    } else {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    }
    // Spy on anchor click to ensure save is triggered
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<MarketDataPanel />);

    // switch provider to twelve_data
    const providerSelect = screen.getByLabelText(/Provider/i) as HTMLSelectElement;
    fireEvent.change(providerSelect, { target: { value: 'twelve_data' } });

    // set an api key so fetch URL includes it (not strictly required)
    const apiInput = screen.getByLabelText(/API Key/i) as HTMLInputElement;
    fireEvent.change(apiInput, { target: { value: 'demokey' } });

    // click fetch
    fireEvent.click(screen.getByText(/Fetch Data/i));

    // wait for status update
    await waitFor(() => expect(screen.getByText(/Data fetched!/i)).toBeInTheDocument(), { timeout: 3000 });

    // save button should now be enabled
    const saveBtn = screen.getByText(/Save Data/i) as HTMLButtonElement;
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });
});
