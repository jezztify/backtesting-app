import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from '../components/ThemeToggle';

describe('ThemeToggle', () => {
  test('renders options and calls onChange', () => {
    const onChange = vi.fn();
    render(<ThemeToggle value={'light'} onChange={onChange} />);
    expect(screen.getByText('Light')).toBeInTheDocument();
    const darkBtn = screen.getByText('Dark');
    fireEvent.click(darkBtn);
    expect(onChange).toHaveBeenCalledWith('dark');
  });
});
