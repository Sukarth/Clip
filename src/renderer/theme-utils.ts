import {
    createDefaultThemeConfig,
    normalizeThemeProfileKey,
    type ThemeConfig,
    type ThemeProfile,
} from '../theme-config';

export function getActiveThemeProfile(config: ThemeConfig): ThemeProfile {
    const key = normalizeThemeProfileKey(config.activeProfile);
    if (config.profiles[key]) {
        return config.profiles[key];
    }

    const firstKey = Object.keys(config.profiles)[0];
    if (firstKey) {
        return config.profiles[firstKey];
    }

    return createDefaultThemeConfig().profiles.default;
}

export const getSliderStyles = (accentColor: string) => `
    input[type="range"]::-webkit-slider-runnable-track {
        background: #333;
        height: 4px;
        border-radius: 2px;
    }
    input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: ${accentColor} !important;
        cursor: pointer;
        margin-top: -7px;
        border: none;
        transition: transform 0.15s ease, background-color 0.15s ease;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    input[type="range"]::-webkit-slider-thumb:hover {
        transform: scale(1.1);
        background: ${accentColor} !important;
    }

    input[type="range"]::-moz-range-track {
        background: #333;
        height: 4px;
        border-radius: 2px;
        border: none;
    }
    input[type="range"]::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: ${accentColor} !important;
        cursor: pointer;
        border: none;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        transition: transform 0.15s ease, background-color 0.15s ease;
    }
    input[type="range"]::-moz-range-thumb:hover {
        transform: scale(1.1);
        background: ${accentColor} !important;
    }
`;

export const getRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
    if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) !== 1 ? 's' : ''} ago`;
    if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? 's' : ''} ago`;
    return `${Math.floor(days / 365)} year${Math.floor(days / 365) !== 1 ? 's' : ''} ago`;
};
