import * as React from 'react';

export interface IconGlyphProps {
    value: string;
    fallback: string;
    size?: number;
    label: string;
    tint?: string;
}

function withFileProtocolIfNeeded(value: string): string {
    if (/^(data:image\/|https?:\/\/|file:\/\/)/i.test(value)) {
        return value;
    }

    if (/^[a-zA-Z]:\\/.test(value)) {
        return `file:///${value.replace(/\\/g, '/')}`;
    }

    return value;
}

function iconToImageSource(icon: string): string | null {
    const trimmed = icon.trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();

    if (trimmed.startsWith('<svg') && trimmed.endsWith('</svg>')) {
        return `data:image/svg+xml;utf8,${encodeURIComponent(trimmed)}`;
    }

    if (
        lower.startsWith('data:image/') ||
        lower.startsWith('http://') ||
        lower.startsWith('https://') ||
        lower.startsWith('file://') ||
        trimmed.startsWith('./') ||
        trimmed.startsWith('../') ||
        trimmed.startsWith('/') ||
        /^[a-zA-Z]:\\/.test(trimmed)
    ) {
        return withFileProtocolIfNeeded(trimmed);
    }

    if (/\.(svg|png|jpg|jpeg|webp|ico)(\?.*)?$/i.test(trimmed)) {
        return withFileProtocolIfNeeded(trimmed);
    }

    return null;
}

const IconGlyph: React.FC<IconGlyphProps> = ({
    value,
    fallback,
    size = 16,
    label,
    tint,
}) => {
    const source = iconToImageSource(value);
    if (source) {
        return (
            <img
                src={source}
                alt={label}
                style={{
                    width: size,
                    height: size,
                    objectFit: 'contain',
                    filter: tint ? `drop-shadow(0 0 0 ${tint})` : undefined,
                }}
            />
        );
    }

    const text = value?.trim() || fallback;
    return (
        <span title={label} style={{ fontSize: size, lineHeight: 1, color: tint || 'inherit' }}>
            {text}
        </span>
    );
};

export default React.memo(IconGlyph);
