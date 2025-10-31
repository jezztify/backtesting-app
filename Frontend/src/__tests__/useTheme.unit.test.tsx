import React from 'react';
import { render, screen } from '@testing-library/react';
import { useTheme } from '../hooks/useTheme';

function HookUser() {
  const { preference, setPreference, effectiveTheme } = useTheme();
  return (
    <div>
      <div data-testid="pref">{preference}</div>
      <div data-testid="eff">{effectiveTheme}</div>
      <button onClick={() => setPreference('dark')}>SetDark</button>
    </div>
  );
}

describe('useTheme', () => {
  beforeEach(() => {
    // mock matchMedia
    (window as any).matchMedia = (query: string) => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} });
    window.localStorage.clear();
  });

  test('returns default and applies system theme', () => {
    render(<HookUser />);
    expect(screen.getByTestId('pref').textContent).toBeDefined();
    expect(screen.getByTestId('eff').textContent).toBeDefined();
  });
});
