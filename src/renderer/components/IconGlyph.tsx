import * as React from 'react';

export interface IconGlyphProps {
    value: string;
    fallback: string;
    size?: number;
    label: string;
    tint?: string;
}

function windowsPathToFileUrl(value: string): string {
    const normalized = value.replace(/\\/g, '/');
    const url = new URL('file://');
    const pathname = normalized.startsWith('/') ? normalized : `/${normalized}`;
    url.pathname = pathname
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
    return url.toString();
}

function posixPathToFileUrl(value: string): string {
    const url = new URL('file://');
    url.pathname = value
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
    return url.toString();
}

function withFileProtocolIfNeeded(value: string): string {
    if (/^(data:image\/|https?:\/\/|file:\/\/)/i.test(value)) {
        return value;
    }

    if (/^[a-zA-Z]:\\/.test(value)) {
        return windowsPathToFileUrl(value);
    }

    if (value.startsWith('/')) {
        return posixPathToFileUrl(value);
    }

    return value;
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
    return (
        <span title={label} style={{ fontSize: size, lineHeight: 1, color: tint || 'inherit' }}>
            {text}
        </span>
    );
};

export default React.memo(IconGlyph);
