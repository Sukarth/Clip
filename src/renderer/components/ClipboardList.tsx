import * as React from 'react';
import type { VirtualItem, Virtualizer } from '@tanstack/react-virtual';
import IconGlyph from './IconGlyph';
import type { ClipboardItem } from '../app-types';

interface ClipboardListProps {
    listRef: React.RefObject<HTMLDivElement | null>;
    settings: { theme: 'dark' | 'light' | 'system'; pinFavoriteItems: boolean };
    hasScrollbar: boolean;
    logger: { renderer: (message: string, ...args: any[]) => void };
    isInitialLoading: boolean;
    isAnimatingList: boolean;
    filteredItems: ClipboardItem[];
    search: string;
    filteredType: 'all' | 'text' | 'image';
    rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
    listForceKey: number;
    themeColors: {
        itemBackground: string;
        itemHoverBackground: string;
        textPrimary: string;
        textMuted: string;
    };
    themeIcons: {
        pin: string;
        pinFilled: string;
        delete: string;
    };
    handlePaste: (item: ClipboardItem) => void;
    handleTogglePin: (item: ClipboardItem) => void;
    handleDeleteItem: (item: ClipboardItem) => void;
}

const ClipboardList: React.FC<ClipboardListProps> = ({
    listRef,
    settings,
    hasScrollbar,
    logger,
    isInitialLoading,
    isAnimatingList,
    filteredItems,
    search,
    filteredType,
    rowVirtualizer,
    listForceKey,
    themeColors,
    themeIcons,
    handlePaste,
    handleTogglePin,
    handleDeleteItem,
}) => {
    const scrollbarPadding = hasScrollbar ? 8 : 0;
    const isLightTheme = settings.theme === 'light';
    const skeletonCardBackground = isLightTheme ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.02)';
    const skeletonBarBackground = isLightTheme ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.06)';
    const skeletonShimmer = isLightTheme
        ? 'linear-gradient(90deg, transparent, rgba(15,23,42,0.12), transparent)'
        : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)';
    const skeletonMetaBackground = isLightTheme ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.04)';

    React.useEffect(() => {
        logger.renderer(`Scrollbar: Applying paddingRight: ${scrollbarPadding} (hasScrollbar: ${hasScrollbar})`);
    }, [hasScrollbar, scrollbarPadding, logger]);

    return (
        <div
            ref={listRef}
            className="clip-list"
            style={{
                overflowY: 'auto',
                overflowX: 'hidden',
                marginTop: 0,
                paddingTop: 0,
                paddingBottom: 1,
                position: 'relative',
                display: 'block',
                flex: 1,
                scrollbarWidth: 'thin',
                scrollbarColor: settings.theme === 'light' ? '#ccc #f0f0f0' : '#444 #23252a',
                paddingRight: scrollbarPadding,
            }}
        >
            {isInitialLoading && (
                <>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div
                            key={`skeleton-${i}`}
                            className={`clip-item-skeleton ${isAnimatingList ? 'clip-item-animate' : ''}`}
                            style={{
                                background: skeletonCardBackground,
                                borderRadius: 12,
                                margin: 0,
                                padding: '2.5% 3%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                height: 60,
                                animationDelay: `${i * 50}ms`,
                            }}
                        >
                            <div
                                style={{
                                    flex: 1,
                                    height: 16,
                                    background: skeletonBarBackground,
                                    borderRadius: 4,
                                    position: 'relative',
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: '-100%',
                                        width: '100%',
                                        height: '100%',
                                        background: skeletonShimmer,
                                        animation: 'skeleton-shimmer 2s infinite',
                                    }}
                                />
                            </div>
                            <div
                                style={{
                                    width: 60,
                                    height: 12,
                                    background: skeletonMetaBackground,
                                    borderRadius: 4,
                                }}
                            />
                        </div>
                    ))}
                </>
            )}

            {filteredItems.length === 0 && !isInitialLoading && (
                <div
                    className="clip-empty"
                    style={{ opacity: 0.7, textAlign: 'center', marginTop: '10%', color: themeColors.textMuted }}
                >
                    {search.trim().length > 0
                        ? 'No results found.'
                        : filteredType === 'text'
                            ? 'No text found.'
                            : filteredType === 'image'
                                ? 'No images found.'
                                : 'No clipboard items found.'}
                </div>
            )}

            {filteredItems.length > 0 && !isInitialLoading && (
                <div
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                    }}
                >
                    {rowVirtualizer.getVirtualItems().map((virtualRow: VirtualItem) => {
                        const item = filteredItems[virtualRow.index];
                        if (!item) return null;
                        const isTemporary = !!item.isTemporary;
                        const itemBackground = isTemporary
                            ? 'linear-gradient(135deg, rgba(255, 183, 0, 0.18), rgba(255,255,255,0.03))'
                            : themeColors.itemBackground;
                        const itemHoverBackground = isTemporary
                            ? 'linear-gradient(135deg, rgba(255, 183, 0, 0.24), rgba(255,255,255,0.05))'
                            : themeColors.itemHoverBackground;
                        return (
                            <div
                                key={`${item.id}-${listForceKey}`}
                                data-index={virtualRow.index}
                                ref={rowVirtualizer.measureElement}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    transform: `translateY(${virtualRow.start}px)`,
                                    paddingBottom: '10px',
                                    boxSizing: 'border-box',
                                }}
                            >
                                <div
                                    className={`clip-item clip-item-${item.type} ${isTemporary ? 'clip-item-temporary' : ''} ${isAnimatingList ? 'clip-item-animate' : ''}`}
                                    tabIndex={0}
                                    role="button"
                                    aria-label={`Clipboard item: ${item.type === 'image' ? 'Image' : `${item.content.slice(0, 50)}${item.content.length > 50 ? '...' : ''}`}`}
                                    onClick={() => handlePaste(item)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handlePaste(item);
                                        }
                                    }}
                                    style={{
                                        background: itemBackground,
                                        borderRadius: 12,
                                        margin: 0,
                                        padding: '2.5% 3%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        boxShadow: isTemporary ? '0 2px 12px rgba(255,183,0,0.12)' : '0 2px 8px rgba(0,0,0,0.08)',
                                        transition:
                                            'background 0.2s, transform 0.25s cubic-bezier(.4,2,.6,1), box-shadow 0.25s cubic-bezier(.4,2,.6,1)',
                                        cursor: 'pointer',
                                        gap: 10,
                                        boxSizing: 'border-box',
                                        border: isTemporary ? '1px dashed rgba(255, 183, 0, 0.6)' : '1px solid transparent',
                                        opacity: isTemporary ? 0.98 : 1,
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = itemHoverBackground)}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = itemBackground)}
                                >
                                    {item.type === 'image' ? (
                                        <img
                                            className="clip-item-image"
                                            src={item.content}
                                            alt={`Clipboard image: ${item.timestamp ? new Date(item.timestamp).toLocaleString() : 'saved'}${isTemporary ? ' (temporary)' : ''}`}
                                            style={{
                                                width: '13%',
                                                minWidth: 36,
                                                maxWidth: 48,
                                                height: 'auto',
                                                aspectRatio: '1/1',
                                                borderRadius: 8,
                                                objectFit: 'cover',
                                                marginRight: '4%',
                                                filter: isTemporary ? 'saturate(0.95) contrast(1.02)' : 'none',
                                            }}
                                        />
                                    ) : (
                                        <div
                                            className="clip-item-text"
                                            style={{
                                                flex: 1,
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                                fontSize: '1rem',
                                                lineHeight: 1.4,
                                                color: themeColors.textPrimary,
                                            }}
                                        >
                                            {item.content.length > 120 ? item.content.slice(0, 120) + '…' : item.content}
                                        </div>
                                    )}
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: isTemporary ? 'flex-end' : 'center',
                                            flexDirection: isTemporary ? 'column' : 'row',
                                            gap: 4,
                                            marginLeft: 'auto',
                                            minWidth: isTemporary ? 88 : 60,
                                        }}
                                    >
                                        <span
                                            className="clip-item-time"
                                            style={{
                                                color: themeColors.textMuted,
                                                fontSize: '0.85rem',
                                                textAlign: 'right',
                                                fontVariantNumeric: 'tabular-nums',
                                            }}
                                        >
                                            {new Date(item.timestamp).toLocaleTimeString()}
                                        </span>
                                        {isTemporary ? (
                                            <span
                                                style={{
                                                    fontSize: 10,
                                                    lineHeight: 1,
                                                    color: '#ffb300',
                                                    background: 'rgba(255, 183, 0, 0.12)',
                                                    border: '1px solid rgba(255, 183, 0, 0.28)',
                                                    borderRadius: 999,
                                                    padding: '4px 8px',
                                                    fontWeight: 700,
                                                    letterSpacing: '0.03em',
                                                    textTransform: 'uppercase',
                                                }}
                                            >
                                                Temporary
                                            </span>
                                        ) : null}
                                        {!isTemporary && settings.pinFavoriteItems && (
                                            <button
                                                type="button"
                                                className="clip-pin-btn"
                                                tabIndex={0}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: 0,
                                                    marginLeft: 2,
                                                    marginTop: 2,
                                                    cursor: 'pointer',
                                                    outline: 'none',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    opacity: item.pinned ? 1 : 0.6,
                                                    transition: 'opacity 0.2s',
                                                    height: 25,
                                                    width: 25,
                                                }}
                                                title={item.pinned ? 'Unpin' : 'Pin'}
                                                aria-label={item.pinned ? 'Unpin item' : 'Pin item'}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (settings.pinFavoriteItems) handleTogglePin(item);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (settings.pinFavoriteItems) handleTogglePin(item);
                                                    }
                                                }}
                                                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                                onMouseLeave={(e) =>
                                                    (e.currentTarget.style.opacity = item.pinned ? '1' : '0.6')
                                                }
                                            >
                                                <IconGlyph
                                                    value={item.pinned ? themeIcons.pinFilled : themeIcons.pin}
                                                    fallback={item.pinned ? '📍' : '📌'}
                                                    label={item.pinned ? 'Pinned' : 'Pin'}
                                                    size={17}
                                                />
                                            </button>
                                        )}
                                        {!isTemporary && (
                                            <button
                                                type="button"
                                                className="clip-delete-btn"
                                                tabIndex={0}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: 0,
                                                    marginLeft: 2,
                                                    marginTop: 2,
                                                    cursor: 'pointer',
                                                    outline: 'none',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    opacity: 0.7,
                                                    transition: 'opacity 0.2s',
                                                    height: 25,
                                                    width: 25,
                                                }}
                                                title="Delete"
                                                aria-label="Delete item"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteItem(item);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleDeleteItem(item);
                                                    }
                                                }}
                                                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
                                            >
                                                <IconGlyph value={themeIcons.delete} fallback="🗑️" label="Delete" size={17} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default React.memo(ClipboardList);
