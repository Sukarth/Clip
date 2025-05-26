import React, { useEffect } from 'react';

interface ThemeProviderProps {
    theme: 'dark' | 'light' | 'system';
    children: React.ReactNode;
    onSystemThemeChange?: () => void;
}

const ThemeProvider: React.FC<ThemeProviderProps> = ({ theme, children, onSystemThemeChange }) => {
    // Determine theme class based on settings
    const getThemeClass = () => {
        if (theme === 'system') {
            // Check if system theme is dark or light
            const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            return isDarkMode ? 'theme-dark' : 'theme-light';
        }
        return `theme-${theme}`;
    };

    // Listen for system theme changes if using system theme
    useEffect(() => {
        if (theme !== 'system' || !onSystemThemeChange) return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            onSystemThemeChange();
        };

        // Modern way with addEventListener
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme, onSystemThemeChange]);

    useEffect(() => {
        // Set theme class on body for global CSS (scrollbars, etc)
        const themeClass = getThemeClass();
        document.body.classList.remove('theme-dark', 'theme-light');
        document.body.classList.add(themeClass);
        // Also set on html element for maximum compatibility
        document.documentElement.classList.remove('theme-dark', 'theme-light');
        document.documentElement.classList.add(themeClass);
        return () => {
            document.body.classList.remove('theme-dark', 'theme-light');
            document.documentElement.classList.remove('theme-dark', 'theme-light');
        };
    }, [theme]);

    return <div className={getThemeClass()}>{children}</div>;
};

export default ThemeProvider;
