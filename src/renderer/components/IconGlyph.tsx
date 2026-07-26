import * as React from 'react';

export interface IconGlyphProps {
    value: string;
    fallback: string;
    size?: number;
    label: string;
    tint?: string;
}

function sanitizeInlineSvg(svg: string): string | null {
    const trimmed = svg.trim();
    if (!/^<svg[\s>]/i.test(trimmed) || !/<\/svg>\s*$/i.test(trimmed)) {
        return null;
    }

    let sanitized = trimmed;
    sanitized = sanitized.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
    sanitized = sanitized.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    sanitized = sanitized.replace(/\s(?:href|xlink:href)\s*=\s*("|')\s*(?:javascript:|data:|https?:|file:)[\s\S]*?\1/gi, '');

    const normalized = sanitized.trim();
    if (!/^<svg[\s>]/i.test(normalized) || !/<\/svg>\s*$/i.test(normalized)) {
        return null;
    }

    return normalized;
}

function iconToImageSource(icon: string): string | null {
    const trimmed = icon.trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();

    if (trimmed.startsWith('<svg') && trimmed.endsWith('</svg>')) {
        const sanitized = sanitizeInlineSvg(trimmed);
        if (!sanitized) {
            return null;
        }

        return `data:image/svg+xml;utf8,${encodeURIComponent(sanitized)}`;
    }

    // Only inline data: image URIs may be rendered as an image source. Remote
    // (http/https), local (file://), protocol-relative, and filesystem-path
    // values are rejected here to prevent outbound beacons and local-file
    // probing; anything else falls through to safe text rendering.
    if (lower.startsWith('data:image/')) {
        return trimmed;
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
    const [imgErrored, setImgErrored] = React.useState(false);

    React.useEffect(() => {
        setImgErrored(false);
    }, [value]);

    const source = imgErrored ? null : iconToImageSource(value);
    if (source) {
        if (tint) {
            return (
                <span
                    role="img"
                    aria-label={label}
                    title={label}
                    style={{
                        display: 'inline-block',
                        width: size,
                        height: size,
                        backgroundColor: tint,
                        WebkitMaskImage: `url("${source}")`,
                        maskImage: `url("${source}")`,
                        WebkitMaskRepeat: 'no-repeat',
                        maskRepeat: 'no-repeat',
                        WebkitMaskPosition: 'center',
                        maskPosition: 'center',
                        WebkitMaskSize: 'contain',
                        maskSize: 'contain',
                    }}
                />
            );
        }

        return (
            <img
                src={source}
                alt={label}
                onError={() => setImgErrored(true)}
                style={{
                    width: size,
                    height: size,
                    objectFit: 'contain',
                }}
            />
        );
    }

    const text = value?.trim() || fallback;

    // Lowercase snake_case tokens are Material Symbols ligature names (the
    // default theme icons, e.g. "delete" or "content_paste"); anything else
    // (emoji, arbitrary text) renders as plain text.
    if (/^[a-z][a-z0-9_]{1,60}$/.test(text)) {
        return (
            <span
                className="material-symbols-outlined"
                role="img"
                aria-label={label}
                title={label}
                style={{ fontSize: size, lineHeight: 1, color: tint || 'inherit' }}
            >
                {text}
            </span>
        );
    }

    return (
        <span title={label} style={{ fontSize: size, lineHeight: 1, color: tint || 'inherit' }}>
            {text}
        </span>
    );
};

export default React.memo(IconGlyph);
