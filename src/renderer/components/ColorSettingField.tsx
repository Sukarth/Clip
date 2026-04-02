import * as React from 'react';

type ParsedColor = {
    r: number;
    g: number;
    b: number;
    a: number;
};

interface ColorSettingFieldProps {
    label: string;
    value: string;
    onChange: (nextValue: string) => void;
}

function clampColorChannel(value: number) {
    return Math.min(255, Math.max(0, Math.round(value)));
}

function parseHexColor(value: string): ParsedColor | null {
    const match = value.trim().match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (!match) return null;

    const hex = match[1];
    if (hex.length === 3 || hex.length === 4) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
        return { r, g, b, a };
    }

    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
}

function parseRgbColor(value: string): ParsedColor | null {
    const match = value
        .trim()
        .match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([0-9.]+)\s*)?\)$/i);
    if (!match) return null;

    return {
        r: clampColorChannel(Number(match[1])),
        g: clampColorChannel(Number(match[2])),
        b: clampColorChannel(Number(match[3])),
        a: match[4] !== undefined ? Math.min(1, Math.max(0, Number(match[4]))) : 1,
    };
}

function parseColorValue(value: string): ParsedColor | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const hex = parseHexColor(trimmed);
    if (hex) return hex;

    const rgb = parseRgbColor(trimmed);
    if (rgb) return rgb;

    if (typeof document !== 'undefined') {
        const probe = document.createElement('span');
        probe.style.color = trimmed;
        probe.style.position = 'fixed';
        probe.style.left = '-9999px';
        probe.style.top = '-9999px';
        probe.style.visibility = 'hidden';
        document.body.appendChild(probe);
        const computed = getComputedStyle(probe).color;
        document.body.removeChild(probe);
        return parseRgbColor(computed);
    }

    return null;
}

function colorValueToPickerValue(value: string, fallback = '#4682b4'): string {
    const parsed = parseColorValue(value);
    if (!parsed) return fallback;
    return `#${clampColorChannel(parsed.r).toString(16).padStart(2, '0')}${clampColorChannel(parsed.g)
        .toString(16)
        .padStart(2, '0')}${clampColorChannel(parsed.b).toString(16).padStart(2, '0')}`;
}

function pickerValueToColorValue(nextValue: string, currentValue: string): string {
    const picked = parseColorValue(nextValue);
    if (!picked) return currentValue;

    const current = parseColorValue(currentValue);
    if (current && current.a < 1) {
        const alpha = Math.round(current.a * 1000) / 1000;
        return `rgba(${picked.r}, ${picked.g}, ${picked.b}, ${alpha})`;
    }

    return nextValue;
}

const ColorSettingField: React.FC<ColorSettingFieldProps> = ({ label, value, onChange }) => {
    const pickerValue = React.useMemo(() => colorValueToPickerValue(value), [value]);

    return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <span style={{ fontSize: 12, color: '#aaa' }}>{label}</span>
            <div style={{ display: 'flex', gap: 8, minWidth: 0, alignItems: 'center' }}>
                <input
                    aria-label={label}
                    className="settings-input"
                    type="color"
                    value={pickerValue}
                    onChange={(e) => onChange(pickerValueToColorValue(e.target.value, value))}
                    style={{
                        width: 38,
                        height: 32,
                        border: '1px solid #444',
                        borderRadius: 8,
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: 0,
                        flexShrink: 0,
                    }}
                />
                <input
                    className="settings-input"
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    style={{
                        flex: 1,
                        minWidth: 0,
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#fff',
                        padding: '8px 10px',
                        fontSize: 12,
                        outline: 'none',
                    }}
                />
            </div>
        </label>
    );
};

export default React.memo(ColorSettingField);
