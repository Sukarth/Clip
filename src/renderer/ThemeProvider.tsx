import React, { useEffect, useState, useMemo } from 'react';

interface ThemeProviderProps {
    theme: 'dark' | 'light' | 'system';
    children: React.ReactNode;
    onSystemThemeChange?: () => void;
}

const ThemeProvider: React.FC<ThemeProviderProps> = ({ theme, children, onSystemThemeChange }) => {
    const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    // Listen for system theme changes if using system theme
    useEffect(() => {
        if (theme !== 'system') return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e: MediaQueryListEvent) => {
            setSystemPrefersDark(e.matches);
            if (onSystemThemeChange) onSystemThemeChange();
        };

        // Modern way with addEventListener
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme, onSystemThemeChange]);

    const themeClass = useMemo(() => {
        if (theme === 'system') {
            return systemPrefersDark ? 'theme-dark' : 'theme-light';
        }
        return `theme-${theme}`;
    }, [theme, systemPrefersDark]);

    useEffect(() => {
        // Set theme class on body for global CSS (scrollbars, etc)
        document.body.classList.remove('theme-dark', 'theme-light');
        document.body.classList.add(themeClass);
        // Also set on html element for maximum compatibility
        document.documentElement.classList.remove('theme-dark', 'theme-light');
        document.documentElement.classList.add(themeClass);
        return () => {
            document.body.classList.remove('theme-dark', 'theme-light');
            document.documentElement.classList.remove('theme-dark', 'theme-light');
        };
    }, [themeClass]);

    return <div className={themeClass}>{children}</div>;
};

export default ThemeProvider;
