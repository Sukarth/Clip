export const THEME_CONFIG_VERSION = 2;

export const WINDOW_SIZE_LIMITS = {
    width: { min: 320, max: 1200, default: 400 },
    height: { min: 420, max: 1600, default: 600 },
} as const;

export interface ThemeColors {
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
}

export type ThemeMode = 'dark' | 'light' | 'system';

export interface ThemeProfile {
    name: string;
    /** Palette used in dark mode. */
    colors: ThemeColors;
    /** Palette used in light mode. */
    lightColors: ThemeColors;
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
    /** Dark / light / follow-OS. Lives here (not in settings) with the palettes it selects. */
    mode: ThemeMode;
    activeProfile: string;
    profiles: Record<string, ThemeProfile>;
}

export const DEFAULT_THEME_PROFILE_KEY = 'default';
const THEME_SCHEMA_ID = 'https://clip.local/schemas/clip-theme.schema.json';

export const DEFAULT_LIGHT_COLORS: ThemeColors = {
    appBackground: 'rgba(244,246,249,0.97)',
    panelBackground: 'rgba(244,246,249,0.97)',
    overlayBackground: 'rgba(0,0,0,0.35)',
    itemBackground: '#ffffff',
    itemHoverBackground: '#e8edf3',
    inputBackground: '#ffffff',
    inputBorder: '#c9ced6',
    border: 'rgba(0,0,0,0.12)',
    textPrimary: '#1c1e21',
    textSecondary: '#49525d',
    textMuted: '#6b7280',
    accent: '#4682b4',
    danger: '#c94f4f',
    warning: '#a2731a',
    success: '#3e8e57',
    scrollbarThumb: '#c1c7cf',
    scrollbarTrack: '#e6e9ee',
};

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
    lightColors: { ...DEFAULT_LIGHT_COLORS },
    typography: {
        fontFamily: 'Lexend, sans-serif',
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
        delete: 'delete',
        pin: 'keep',
        pinFilled: 'keep',
        settings: 'settings',
        close: 'close',
        search: 'search',
        confirm: 'check',
        clipboard: 'content_paste',
    },
};

// Icon values saved by older versions (emoji defaults). Migrated on sanitize so
// existing theme files pick up the Material Symbols icons; user-customized
// icons are left untouched.
const LEGACY_ICON_MIGRATION: Record<string, string> = {
    '🗑️': 'delete',
    '📌': 'keep',
    '📍': 'keep',
    '⚙️': 'settings',
    '✕': 'close',
    '🔍': 'search',
    '✓': 'check',
    '📋': 'content_paste',
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
    const candidate = sanitizeString(value, fallback, 12000);
    if (candidate === fallback) return fallback;

    const trimmed = candidate.trim();
    const lower = trimmed.toLowerCase();

    // Inline SVG markup is sanitized/rendered as an inline data URI downstream.
    if (lower.startsWith('<svg')) {
        return candidate;
    }

    // Safe inline data: URIs are allowed through.
    if (lower.startsWith('data:')) {
        return candidate;
    }

    // Reject any value carrying a URL scheme (http:, https:, file:, javascript:,
    // Windows drive paths like "c:\...", etc.) or a protocol-relative "//" prefix.
    // These could turn an icon into an outbound beacon or a local-file probe when
    // rendered into <img src>/CSS mask. Only plain icon tokens (emoji/text),
    // inline SVG, and data: URIs are permitted.
    if (trimmed.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
        return fallback;
    }

    return candidate;
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

function sanitizeColorSet(input: unknown, defaults: ThemeColors): ThemeColors {
    const colors = (input && typeof input === 'object' ? input : {}) as Partial<ThemeColors>;
    const out = {} as ThemeColors;
    (Object.keys(defaults) as (keyof ThemeColors)[]).forEach((key) => {
        out[key] = sanitizeColor(colors[key], defaults[key]);
    });
    return out;
}

function sanitizeThemeProfile(input: unknown): ThemeProfile {
    const source = (input && typeof input === 'object' ? input : {}) as Partial<ThemeProfile>;
    const typography = (source.typography && typeof source.typography === 'object' ? source.typography : {}) as Partial<ThemeProfile['typography']>;
    const surface = (source.surface && typeof source.surface === 'object' ? source.surface : {}) as Partial<ThemeProfile['surface']>;
    const icons = (source.icons && typeof source.icons === 'object' ? source.icons : {}) as Partial<ThemeProfile['icons']>;

    return {
        name: sanitizeString(source.name, DEFAULT_THEME_PROFILE.name, 60),
        colors: sanitizeColorSet(source.colors, DEFAULT_THEME_PROFILE.colors),
        // Older profiles (version 1) have no light palette; they get the default
        // light colors, which is what makes light mode actually light.
        lightColors: sanitizeColorSet(source.lightColors, DEFAULT_LIGHT_COLORS),
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
            delete: sanitizeThemeIcon(icons.delete, DEFAULT_THEME_PROFILE.icons.delete),
            pin: sanitizeThemeIcon(icons.pin, DEFAULT_THEME_PROFILE.icons.pin),
            pinFilled: sanitizeThemeIcon(icons.pinFilled, DEFAULT_THEME_PROFILE.icons.pinFilled),
            settings: sanitizeThemeIcon(icons.settings, DEFAULT_THEME_PROFILE.icons.settings),
            close: sanitizeThemeIcon(icons.close, DEFAULT_THEME_PROFILE.icons.close),
            search: sanitizeThemeIcon(icons.search, DEFAULT_THEME_PROFILE.icons.search),
            confirm: sanitizeThemeIcon(icons.confirm, DEFAULT_THEME_PROFILE.icons.confirm),
            clipboard: sanitizeThemeIcon(icons.clipboard, DEFAULT_THEME_PROFILE.icons.clipboard),
        },
    };
}

function sanitizeThemeIcon(value: unknown, fallback: string) {
    const sanitized = sanitizeIcon(value, fallback);
    // Old emoji defaults saved in existing theme files become the equivalent
    // Material Symbols token; genuinely custom icons pass through unchanged.
    return LEGACY_ICON_MIGRATION[sanitized] ?? sanitized;
}

export function createDefaultThemeConfig(): ThemeConfig {
    return {
        version: THEME_CONFIG_VERSION,
        mode: 'dark',
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
    const rawKeysByNormalizedKey: Record<string, string> = {};
    for (const [rawKey, profile] of Object.entries(sourceProfiles)) {
        const key = normalizeThemeProfileKey(rawKey);
        if (nextProfiles[key]) {
            console.warn(
                `[theme-config] Duplicate theme profile key after normalization: "${rawKey}" conflicts with "${rawKeysByNormalizedKey[key]}". Keeping the first entry for key "${key}".`,
            );
            continue;
        }

        rawKeysByNormalizedKey[key] = rawKey;
        nextProfiles[key] = sanitizeThemeProfile(profile);
    }

    if (Object.keys(nextProfiles).length === 0) {
        nextProfiles[DEFAULT_THEME_PROFILE_KEY] = fallback.profiles[DEFAULT_THEME_PROFILE_KEY];
    }

    const requestedProfile = normalizeThemeProfileKey(String(source.activeProfile || fallback.activeProfile));
    const activeProfile = nextProfiles[requestedProfile] ? requestedProfile : Object.keys(nextProfiles)[0];
    const mode: ThemeMode = source.mode === 'light' || source.mode === 'system' || source.mode === 'dark'
        ? source.mode
        : 'dark';

    return {
        version: THEME_CONFIG_VERSION,
        mode,
        activeProfile,
        profiles: nextProfiles,
    };
}

function createThemeColorSchema(defaultValue: string, description: string) {
    return {
        type: 'string',
        description: `${description} CSS color value. Supported formats include hex, rgb(a), hsl(a), named colors, CSS variables, and keywords like transparent/currentColor.`,
        default: defaultValue,
    };
}

function createThemeNumberSchema(defaultValue: number, minimum: number, maximum: number, description: string) {
    return {
        type: 'number',
        minimum,
        maximum,
        description,
        default: defaultValue,
    };
}

function createThemeStringSchema(defaultValue: string, description: string, maxLength = 200) {
    return {
        type: 'string',
        maxLength,
        description,
        default: defaultValue,
    };
}

export function getThemeSchema() {
    const colorDescriptions: Record<keyof ThemeProfile['colors'], string> = {
        appBackground: 'Main app background.',
        panelBackground: 'Settings/theme panel background.',
        overlayBackground: 'Modal overlay background.',
        itemBackground: 'Clipboard item background.',
        itemHoverBackground: 'Clipboard item hover background.',
        inputBackground: 'Input field background.',
        inputBorder: 'Input field border color.',
        border: 'General border color.',
        textPrimary: 'Primary text color.',
        textSecondary: 'Secondary text color.',
        textMuted: 'Muted text color.',
        accent: 'Accent color used for highlights and buttons.',
        danger: 'Danger/error color.',
        warning: 'Warning color.',
        success: 'Success color.',
        scrollbarThumb: 'Scrollbar thumb color.',
        scrollbarTrack: 'Scrollbar track color.',
    };

    const colorProperties = Object.fromEntries(
        Object.entries(DEFAULT_THEME_PROFILE.colors).map(([key, defaultValue]) => [
            key,
            createThemeColorSchema(defaultValue, colorDescriptions[key as keyof ThemeProfile['colors']]),
        ])
    );

    const lightColorProperties = Object.fromEntries(
        Object.entries(DEFAULT_LIGHT_COLORS).map(([key, defaultValue]) => [
            key,
            createThemeColorSchema(defaultValue, `${colorDescriptions[key as keyof ThemeColors]} (light mode)`),
        ])
    );

    const typographyProperties = {
        fontFamily: createThemeStringSchema(DEFAULT_THEME_PROFILE.typography.fontFamily, 'Primary UI font family.', 200),
        monoFontFamily: createThemeStringSchema(DEFAULT_THEME_PROFILE.typography.monoFontFamily, 'Monospace font family for code or fixed-width text.', 200),
        baseFontSize: createThemeNumberSchema(DEFAULT_THEME_PROFILE.typography.baseFontSize, 11, 24, 'Base UI font size.'),
        titleFontSize: createThemeNumberSchema(DEFAULT_THEME_PROFILE.typography.titleFontSize, 13, 40, 'Title font size.'),
        fontWeightNormal: createThemeNumberSchema(DEFAULT_THEME_PROFILE.typography.fontWeightNormal, 300, 700, 'Normal font weight.'),
        fontWeightMedium: createThemeNumberSchema(DEFAULT_THEME_PROFILE.typography.fontWeightMedium, 300, 800, 'Medium font weight.'),
        fontWeightBold: createThemeNumberSchema(DEFAULT_THEME_PROFILE.typography.fontWeightBold, 400, 900, 'Bold font weight.'),
    };

    const surfaceProperties = {
        borderRadius: createThemeNumberSchema(DEFAULT_THEME_PROFILE.surface.borderRadius, 0, 32, 'Window border radius.'),
        itemRadius: createThemeNumberSchema(DEFAULT_THEME_PROFILE.surface.itemRadius, 0, 24, 'Clipboard item corner radius.'),
        transparency: createThemeNumberSchema(DEFAULT_THEME_PROFILE.surface.transparency, 0.35, 1, 'Surface transparency. 1 is fully opaque.'),
        backdropBlur: createThemeNumberSchema(DEFAULT_THEME_PROFILE.surface.backdropBlur, 0, 30, 'Backdrop blur amount in pixels.'),
        panelBorderWidth: createThemeNumberSchema(DEFAULT_THEME_PROFILE.surface.panelBorderWidth, 0, 4, 'Panel border width in pixels.'),
    };

    const iconDescriptions: Record<keyof ThemeProfile['icons'], string> = {
        delete: 'Delete icon value.',
        pin: 'Pin icon value.',
        pinFilled: 'Filled pin icon value.',
        settings: 'Settings icon value.',
        close: 'Close icon value.',
        search: 'Search icon value.',
        confirm: 'Confirm icon value.',
        clipboard: 'Clipboard icon value.',
    };

    const iconProperties = Object.fromEntries(
        Object.entries(DEFAULT_THEME_PROFILE.icons).map(([key, defaultValue]) => [
            key,
            createThemeStringSchema(defaultValue, iconDescriptions[key as keyof ThemeProfile['icons']], 12000),
        ])
    );

    return {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: THEME_SCHEMA_ID,
        title: 'Clip theme config',
        description: 'Theme profile configuration for Clip.',
        type: 'object',
        additionalProperties: false,
        required: ['version', 'activeProfile', 'profiles'],
        properties: {
            $schema: {
                type: 'string',
                description: 'Schema location used by IDEs for IntelliSense.',
                default: THEME_SCHEMA_ID,
            },
            version: {
                type: 'integer',
                const: THEME_CONFIG_VERSION,
                description: 'Theme file version.',
            },
            mode: {
                type: 'string',
                enum: ['dark', 'light', 'system'],
                default: 'dark',
                description: 'Color mode: dark, light, or follow the OS setting.',
            },
            activeProfile: {
                type: 'string',
                description: 'The currently active theme profile key.',
                default: DEFAULT_THEME_PROFILE_KEY,
            },
            profiles: {
                type: 'object',
                description: 'Map of profile keys to theme profiles.',
                minProperties: 1,
                additionalProperties: {
                    $ref: '#/$defs/themeProfile',
                },
            },
        },
        $defs: {
            themeProfile: {
                type: 'object',
                additionalProperties: false,
                required: ['name', 'colors', 'typography', 'surface', 'icons'],
                properties: {
                    name: createThemeStringSchema(DEFAULT_THEME_PROFILE.name, 'Display name for the profile.', 60),
                    colors: {
                        type: 'object',
                        additionalProperties: false,
                        required: Object.keys(DEFAULT_THEME_PROFILE.colors),
                        properties: colorProperties,
                    },
                    lightColors: {
                        type: 'object',
                        description: 'Palette used when the app is in light mode.',
                        additionalProperties: false,
                        properties: lightColorProperties,
                    },
                    typography: {
                        type: 'object',
                        additionalProperties: false,
                        required: Object.keys(DEFAULT_THEME_PROFILE.typography),
                        properties: typographyProperties,
                    },
                    surface: {
                        type: 'object',
                        additionalProperties: false,
                        required: Object.keys(DEFAULT_THEME_PROFILE.surface),
                        properties: surfaceProperties,
                    },
                    icons: {
                        type: 'object',
                        additionalProperties: false,
                        required: Object.keys(DEFAULT_THEME_PROFILE.icons),
                        properties: iconProperties,
                    },
                },
            },
        },
        examples: [createDefaultThemeConfig()],
    };
}
