export const THEME_CONFIG_VERSION = 1;

export const WINDOW_SIZE_LIMITS = {
    width: { min: 320, max: 1200, default: 400 },
    height: { min: 420, max: 1600, default: 600 },
} as const;

export interface ThemeProfile {
    name: string;
    colors: {
        appBackground: string;
        panelBackground: string;
        overlayBackground: string;
        itemBackground: string;
        itemHoverBackground: string;
        inputBackground: string;
        inputBorder: string;
        border: string;
        textPrimary: string;
        textSecondary: string;
        textMuted: string;
        accent: string;
        danger: string;
        warning: string;
        success: string;
        scrollbarThumb: string;
        scrollbarTrack: string;
    };
    typography: {
        fontFamily: string;
        monoFontFamily: string;
        baseFontSize: number;
        titleFontSize: number;
        fontWeightNormal: number;
        fontWeightMedium: number;
        fontWeightBold: number;
    };
    surface: {
        borderRadius: number;
        itemRadius: number;
        transparency: number;
        backdropBlur: number;
        panelBorderWidth: number;
    };
    icons: {
        delete: string;
        pin: string;
        pinFilled: string;
        settings: string;
        close: string;
        search: string;
        confirm: string;
        clipboard: string;
    };
}

export interface ThemeConfig {
    version: number;
    activeProfile: string;
    profiles: Record<string, ThemeProfile>;
}

export const DEFAULT_THEME_PROFILE_KEY = 'default';

const DEFAULT_THEME_PROFILE: ThemeProfile = {
    name: 'Default',
    colors: {
        appBackground: 'rgba(30,32,36,0.95)',
        panelBackground: 'rgba(30,32,36,0.95)',
        overlayBackground: 'rgba(0,0,0,0.45)',
        itemBackground: 'rgba(255,255,255,0.04)',
        itemHoverBackground: 'rgba(255,255,255,0.10)',
        inputBackground: 'rgba(255,255,255,0.07)',
        inputBorder: '#333333',
        border: 'rgba(255,255,255,0.08)',
        textPrimary: '#ffffff',
        textSecondary: '#cccccc',
        textMuted: '#888888',
        accent: '#4682b4',
        danger: '#ff4136',
        warning: '#ffb300',
        success: '#2ecc40',
        scrollbarThumb: '#444444',
        scrollbarTrack: '#23252a',
    },
    typography: {
        fontFamily: 'Segoe UI, Arial, sans-serif',
        monoFontFamily: 'Consolas, Monaco, monospace',
        baseFontSize: 15,
        titleFontSize: 18,
        fontWeightNormal: 400,
        fontWeightMedium: 500,
        fontWeightBold: 600,
    },
    surface: {
        borderRadius: 18,
        itemRadius: 12,
        transparency: 0.95,
        backdropBlur: 10,
        panelBorderWidth: 1,
    },
    icons: {
        delete: '🗑️',
        pin: '📌',
        pinFilled: '📍',
        settings: '⚙️',
        close: '✕',
        search: '🔍',
        confirm: '✓',
        clipboard: '📋',
    },
};

const CSS_COLOR_HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const CSS_COLOR_FUNCTION_PATTERN = /^(rgb|rgba|hsl|hsla)\([^\n\r]{3,120}\)$/i;
const CSS_VAR_PATTERN = /^var\(--[a-z0-9-]+\)$/i;
const CSS_NAMED_COLOR_PATTERN = /^[a-z]{3,30}$/i;
const CSS_KEYWORD_PATTERN = /^(transparent|currentcolor|inherit|initial|unset)$/i;

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const rounded = Math.round(parsed * 1000) / 1000;
    return Math.min(max, Math.max(min, rounded));
}

function sanitizeString(value: unknown, fallback: string, maxLength = 200) {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function sanitizeColor(value: unknown, fallback: string) {
    const candidate = sanitizeString(value, fallback, 120);
    if (
        CSS_COLOR_HEX_PATTERN.test(candidate) ||
        CSS_COLOR_FUNCTION_PATTERN.test(candidate) ||
        CSS_VAR_PATTERN.test(candidate) ||
        CSS_NAMED_COLOR_PATTERN.test(candidate) ||
        CSS_KEYWORD_PATTERN.test(candidate)
    ) {
        return candidate;
    }
    return fallback;
}

function sanitizeIcon(value: unknown, fallback: string) {
    return sanitizeString(value, fallback, 12000);
}

export function normalizeThemeProfileKey(value: string) {
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || DEFAULT_THEME_PROFILE_KEY;
}

function sanitizeThemeProfile(input: unknown): ThemeProfile {
    const source = (input && typeof input === 'object' ? input : {}) as Partial<ThemeProfile>;
    const colors = (source.colors && typeof source.colors === 'object' ? source.colors : {}) as Partial<ThemeProfile['colors']>;
    const typography = (source.typography && typeof source.typography === 'object' ? source.typography : {}) as Partial<ThemeProfile['typography']>;
    const surface = (source.surface && typeof source.surface === 'object' ? source.surface : {}) as Partial<ThemeProfile['surface']>;
    const icons = (source.icons && typeof source.icons === 'object' ? source.icons : {}) as Partial<ThemeProfile['icons']>;

    return {
        name: sanitizeString(source.name, DEFAULT_THEME_PROFILE.name, 60),
        colors: {
            appBackground: sanitizeColor(colors.appBackground, DEFAULT_THEME_PROFILE.colors.appBackground),
            panelBackground: sanitizeColor(colors.panelBackground, DEFAULT_THEME_PROFILE.colors.panelBackground),
            overlayBackground: sanitizeColor(colors.overlayBackground, DEFAULT_THEME_PROFILE.colors.overlayBackground),
            itemBackground: sanitizeColor(colors.itemBackground, DEFAULT_THEME_PROFILE.colors.itemBackground),
            itemHoverBackground: sanitizeColor(colors.itemHoverBackground, DEFAULT_THEME_PROFILE.colors.itemHoverBackground),
            inputBackground: sanitizeColor(colors.inputBackground, DEFAULT_THEME_PROFILE.colors.inputBackground),
            inputBorder: sanitizeColor(colors.inputBorder, DEFAULT_THEME_PROFILE.colors.inputBorder),
            border: sanitizeColor(colors.border, DEFAULT_THEME_PROFILE.colors.border),
            textPrimary: sanitizeColor(colors.textPrimary, DEFAULT_THEME_PROFILE.colors.textPrimary),
            textSecondary: sanitizeColor(colors.textSecondary, DEFAULT_THEME_PROFILE.colors.textSecondary),
            textMuted: sanitizeColor(colors.textMuted, DEFAULT_THEME_PROFILE.colors.textMuted),
            accent: sanitizeColor(colors.accent, DEFAULT_THEME_PROFILE.colors.accent),
            danger: sanitizeColor(colors.danger, DEFAULT_THEME_PROFILE.colors.danger),
            warning: sanitizeColor(colors.warning, DEFAULT_THEME_PROFILE.colors.warning),
            success: sanitizeColor(colors.success, DEFAULT_THEME_PROFILE.colors.success),
            scrollbarThumb: sanitizeColor(colors.scrollbarThumb, DEFAULT_THEME_PROFILE.colors.scrollbarThumb),
            scrollbarTrack: sanitizeColor(colors.scrollbarTrack, DEFAULT_THEME_PROFILE.colors.scrollbarTrack),
        },
        typography: {
            fontFamily: sanitizeString(typography.fontFamily, DEFAULT_THEME_PROFILE.typography.fontFamily, 200),
            monoFontFamily: sanitizeString(typography.monoFontFamily, DEFAULT_THEME_PROFILE.typography.monoFontFamily, 200),
            baseFontSize: clampNumber(typography.baseFontSize, 11, 24, DEFAULT_THEME_PROFILE.typography.baseFontSize),
            titleFontSize: clampNumber(typography.titleFontSize, 13, 40, DEFAULT_THEME_PROFILE.typography.titleFontSize),
            fontWeightNormal: clampNumber(typography.fontWeightNormal, 300, 700, DEFAULT_THEME_PROFILE.typography.fontWeightNormal),
            fontWeightMedium: clampNumber(typography.fontWeightMedium, 300, 800, DEFAULT_THEME_PROFILE.typography.fontWeightMedium),
            fontWeightBold: clampNumber(typography.fontWeightBold, 400, 900, DEFAULT_THEME_PROFILE.typography.fontWeightBold),
        },
        surface: {
            borderRadius: clampNumber(surface.borderRadius, 0, 32, DEFAULT_THEME_PROFILE.surface.borderRadius),
            itemRadius: clampNumber(surface.itemRadius, 0, 24, DEFAULT_THEME_PROFILE.surface.itemRadius),
            transparency: clampNumber(surface.transparency, 0.35, 1, DEFAULT_THEME_PROFILE.surface.transparency),
            backdropBlur: clampNumber(surface.backdropBlur, 0, 30, DEFAULT_THEME_PROFILE.surface.backdropBlur),
            panelBorderWidth: clampNumber(surface.panelBorderWidth, 0, 4, DEFAULT_THEME_PROFILE.surface.panelBorderWidth),
        },
        icons: {
            delete: sanitizeIcon(icons.delete, DEFAULT_THEME_PROFILE.icons.delete),
            pin: sanitizeIcon(icons.pin, DEFAULT_THEME_PROFILE.icons.pin),
            pinFilled: sanitizeIcon(icons.pinFilled, DEFAULT_THEME_PROFILE.icons.pinFilled),
            settings: sanitizeIcon(icons.settings, DEFAULT_THEME_PROFILE.icons.settings),
            close: sanitizeIcon(icons.close, DEFAULT_THEME_PROFILE.icons.close),
            search: sanitizeIcon(icons.search, DEFAULT_THEME_PROFILE.icons.search),
            confirm: sanitizeIcon(icons.confirm, DEFAULT_THEME_PROFILE.icons.confirm),
            clipboard: sanitizeIcon(icons.clipboard, DEFAULT_THEME_PROFILE.icons.clipboard),
        },
    };
}

export function createDefaultThemeConfig(): ThemeConfig {
    return {
        version: THEME_CONFIG_VERSION,
        activeProfile: DEFAULT_THEME_PROFILE_KEY,
        profiles: {
            [DEFAULT_THEME_PROFILE_KEY]: JSON.parse(JSON.stringify(DEFAULT_THEME_PROFILE)),
        },
    };
}

export function sanitizeThemeConfig(input: unknown): ThemeConfig {
    const fallback = createDefaultThemeConfig();
    const source = (input && typeof input === 'object' ? input : {}) as Partial<ThemeConfig>;
    const sourceProfiles = (source.profiles && typeof source.profiles === 'object' ? source.profiles : {}) as Record<string, unknown>;

    const nextProfiles: Record<string, ThemeProfile> = {};
    for (const [rawKey, profile] of Object.entries(sourceProfiles)) {
        const key = normalizeThemeProfileKey(rawKey);
        nextProfiles[key] = sanitizeThemeProfile(profile);
    }

    if (Object.keys(nextProfiles).length === 0) {
        nextProfiles[DEFAULT_THEME_PROFILE_KEY] = fallback.profiles[DEFAULT_THEME_PROFILE_KEY];
    }

    const requestedProfile = normalizeThemeProfileKey(String(source.activeProfile || fallback.activeProfile));
    const activeProfile = nextProfiles[requestedProfile] ? requestedProfile : Object.keys(nextProfiles)[0];

    return {
        version: THEME_CONFIG_VERSION,
        activeProfile,
        profiles: nextProfiles,
    };
}

export function getThemeSchema() {
    return {
        version: THEME_CONFIG_VERSION,
        notes: [
            'Edit clip-theme.json while the app is closed, or use Reload Theme in settings.',
            'Supported icon formats: emoji/text, data URLs, file paths, http/https URLs, or raw <svg>...</svg> text.',
            'If clip-theme.json is missing/corrupt, Clip restores from the DB backup automatically.',
        ],
        windowSizeLimits: WINDOW_SIZE_LIMITS,
        requiredTopLevelFields: ['version', 'activeProfile', 'profiles'],
        profileStructure: {
            name: 'string (max 60 chars)',
            colors: {
                appBackground: 'CSS color',
                panelBackground: 'CSS color',
                overlayBackground: 'CSS color',
                itemBackground: 'CSS color',
                itemHoverBackground: 'CSS color',
                inputBackground: 'CSS color',
                inputBorder: 'CSS color',
                border: 'CSS color',
                textPrimary: 'CSS color',
                textSecondary: 'CSS color',
                textMuted: 'CSS color',
                accent: 'CSS color',
                danger: 'CSS color',
                warning: 'CSS color',
                success: 'CSS color',
                scrollbarThumb: 'CSS color',
                scrollbarTrack: 'CSS color',
            },
            typography: {
                fontFamily: 'string',
                monoFontFamily: 'string',
                baseFontSize: '11..24',
                titleFontSize: '13..40',
                fontWeightNormal: '300..700',
                fontWeightMedium: '300..800',
                fontWeightBold: '400..900',
            },
            surface: {
                borderRadius: '0..32',
                itemRadius: '0..24',
                transparency: '0.35..1',
                backdropBlur: '0..30',
                panelBorderWidth: '0..4',
            },
            icons: {
                delete: 'string',
                pin: 'string',
                pinFilled: 'string',
                settings: 'string',
                close: 'string',
                search: 'string',
                confirm: 'string',
                clipboard: 'string',
            },
        },
        defaults: createDefaultThemeConfig(),
    };
}
