import * as React from 'react';
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
    rowVirtualizer: any;
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
                paddingRight: (() => {
                    const padding = hasScrollbar ? 8 : 0;
                    logger.renderer(`Scrollbar: Applying paddingRight: ${padding} (hasScrollbar: ${hasScrollbar})`);
                    return padding;
                })(),
            }}
        >
            {isInitialLoading && (
                <>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div
                            key={`skeleton-${i}`}
                            className={`clip-item-skeleton ${isAnimatingList ? 'clip-item-animate' : ''}`}
                            style={{
                                background: 'rgba(255,255,255,0.02)',
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
                                    background: 'rgba(255,255,255,0.06)',
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
                                        background:
                                            'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
                                        animation: 'skeleton-shimmer 2s infinite',
                                    }}
                                />
                            </div>
                            <div
                                style={{
                                    width: 60,
                                    height: 12,
                                    background: 'rgba(255,255,255,0.04)',
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
                    {rowVirtualizer.getVirtualItems().map((virtualRow: any) => {
                        const item = filteredItems[virtualRow.index];
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
                                    className={`clip-item clip-item-${item.type} ${isAnimatingList ? 'clip-item-animate' : ''}`}
                                    onClick={() => handlePaste(item)}
                                    style={{
                                        background: themeColors.itemBackground,
                                        borderRadius: 12,
                                        margin: 0,
                                        padding: '2.5% 3%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                        transition:
                                            'background 0.2s, transform 0.25s cubic-bezier(.4,2,.6,1), box-shadow 0.25s cubic-bezier(.4,2,.6,1)',
                                        cursor: 'pointer',
                                        gap: 10,
                                        boxSizing: 'border-box',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = themeColors.itemHoverBackground)}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = themeColors.itemBackground)}
                                >
                                    {item.type === 'image' ? (
                                        <img
                                            className="clip-item-image"
                                            src={item.content}
                                            alt="clip"
                                            style={{
                                                width: '13%',
                                                minWidth: 36,
                                                maxWidth: 48,
                                                height: 'auto',
                                                aspectRatio: '1/1',
                                                borderRadius: 8,
                                                objectFit: 'cover',
                                                marginRight: '4%',
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
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', minWidth: 60 }}>
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
                                        {settings.pinFavoriteItems && (
                                            <button
                                                className="clip-pin-btn"
                                                tabIndex={-1}
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
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (settings.pinFavoriteItems) handleTogglePin(item);
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
                                        <button
                                            className="clip-delete-btn"
                                            tabIndex={-1}
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
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteItem(item);
                                            }}
                                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
                                        >
                                            <IconGlyph value={themeIcons.delete} fallback="🗑️" label="Delete" size={17} />
                                        </button>
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
