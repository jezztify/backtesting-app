import { useEffect, useMemo, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'charting-workspace:theme-preference';

const getStoredPreference = (): ThemePreference => {
    if (typeof window === 'undefined') {
        return 'system';
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
    }

    return 'system';
};

const getSystemTheme = (mediaQueryList: MediaQueryList | null): 'light' | 'dark' => {
    if (!mediaQueryList) {
        return 'light';
    }

    return mediaQueryList.matches ? 'dark' : 'light';
};

const applyThemeToDocument = (theme: ThemePreference, effectiveTheme: 'light' | 'dark') => {
    if (typeof document === 'undefined') {
        return;
    }

    const root = document.documentElement;

    if (theme === 'system') {
        root.removeAttribute('data-theme');
    } else {
        root.setAttribute('data-theme', theme);
    }

    root.style.colorScheme = effectiveTheme;

    // Force update chart color CSS variables for immediate effect
    if (effectiveTheme === 'light') {
        root.style.setProperty('--color-chart-surface', '#ffffff');
        root.style.setProperty('--color-chart-text', '#1f2937');
        root.style.setProperty('--color-chart-grid', 'rgba(148, 163, 184, 0.25)');
        root.style.setProperty('--color-success', '#16a34a');
        root.style.setProperty('--color-danger', '#ef4444');
    } else {
        root.style.setProperty('--color-chart-surface', '#0f172a');
        root.style.setProperty('--color-chart-text', '#cbd5f5');
        root.style.setProperty('--color-chart-grid', 'rgba(148, 163, 184, 0.1)');
        root.style.setProperty('--color-success', '#26a69a');
        root.style.setProperty('--color-danger', '#ef5350');
    }
};

export const useTheme = () => {
    const [preference, setPreference] = useState<ThemePreference>(() => getStoredPreference());
    const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
        if (typeof window === 'undefined') {
            return 'light';
        }

        return getSystemTheme(window.matchMedia?.('(prefers-color-scheme: dark)') ?? null);
    });

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
        if (!mediaQuery) {
            return;
        }

        const listener = (event: MediaQueryListEvent) => {
            setSystemTheme(event.matches ? 'dark' : 'light');
        };

        mediaQuery.addEventListener('change', listener);
        setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

        return () => mediaQuery.removeEventListener('change', listener);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        window.localStorage.setItem(STORAGE_KEY, preference);
    }, [preference]);

    const effectiveTheme = useMemo<'light' | 'dark'>(() => {
        if (preference === 'system') {
            return systemTheme;
        }

        return preference;
    }, [preference, systemTheme]);

    useEffect(() => {
        applyThemeToDocument(preference, effectiveTheme);
    }, [preference, effectiveTheme]);

    return {
        preference,
        setPreference,
        effectiveTheme,
    } as const;
};
