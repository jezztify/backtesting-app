import { ThemePreference } from '../hooks/useTheme';

interface ThemeToggleProps {
    value: ThemePreference;
    onChange: (value: ThemePreference) => void;
}

const labels: Record<ThemePreference, string> = {
    light: 'Light',
    dark: 'Dark',
    system: 'System',
};

const ThemeToggle = ({ value, onChange }: ThemeToggleProps) => {
    return (
        <div className="theme-toggle" role="radiogroup" aria-label="Theme selection">
            {(Object.keys(labels) as ThemePreference[]).map((option) => (
                <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={value === option}
                    className={value === option ? 'active' : ''}
                    onClick={() => onChange(option)}
                >
                    {labels[option]}
                </button>
            ))}
        </div>
    );
};

export default ThemeToggle;
