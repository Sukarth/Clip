import * as React from 'react';
import type { ClipboardItem, Settings } from '../app-types';

type ToastFn = (type: 'success' | 'error' | 'info', message: string) => void;

type Logger = {
    renderer: (message: string, ...args: any[]) => void;
};

interface UseClipboardManagerArgs {
    settings: Settings;
    showToast: ToastFn;
    logger: Logger;
    onWindowWillShow?: () => void;
    onAfterClearAll?: () => void;
}

export function useClipboardManager({
    settings,
    showToast,
    logger,
    onWindowWillShow,
    onAfterClearAll,
}: UseClipboardManagerArgs) {
    const [items, setItems] = React.useState<ClipboardItem[]>([]);
    const [hasLoadedInitially, setHasLoadedInitially] = React.useState(false);
    const [isInitialLoading, setIsInitialLoading] = React.useState(true);

    const [itemsCache, setItemsCache] = React.useState<ClipboardItem[]>([]);
    const [isCacheLoaded, setIsCacheLoaded] = React.useState(false);
    const [lastCacheUpdate, setLastCacheUpdate] = React.useState(0);
    const cacheValidDuration = 30000;

    const [deleteTarget, setDeleteTarget] = React.useState<ClipboardItem | null>(null);
    const [isDeleteDialogClosing, setIsDeleteDialogClosing] = React.useState(false);

    const requestClipboardHistory = React.useCallback(() => {
        window.electronAPI?.requestClipboardHistory?.();
    }, []);

    const useCacheIfValid = React.useCallback(() => {
        const now = Date.now();
        const cacheAge = now - lastCacheUpdate;

        if (isCacheLoaded && cacheAge < cacheValidDuration && itemsCache.length > 0) {
            logger.renderer(`Cache: Using valid cache (${cacheAge}ms old, ${itemsCache.length} items)`);
            setItems(itemsCache);
            setHasLoadedInitially(true);
            return true;
        }

        return false;
    }, [isCacheLoaded, itemsCache, lastCacheUpdate, logger]);

    React.useEffect(() => {
        if (!window.electronAPI?.onForceRefresh) return;
        const handler = () => {
            requestClipboardHistory();
        };

        const dispose = window.electronAPI.onForceRefresh(handler);
        return () => {
            if (typeof dispose === 'function') dispose();
        };
    }, [requestClipboardHistory]);

    React.useEffect(() => {
        let isMounted = true;

        const handleHistory = (history: any[]) => {
            if (!isMounted) {
                return;
            }

            const processedItems = history.map((item: any) => ({ ...item, id: String(item.id) }));
            setItemsCache(processedItems);
            setLastCacheUpdate(Date.now());
            setIsCacheLoaded(true);
            setItems(processedItems);
            setHasLoadedInitially(true);
            setIsInitialLoading(false);

            logger.renderer(`Cache: Updated cache with ${processedItems.length} items`);
        };

        const dispose = window.electronAPI?.onClipboardHistory?.(handleHistory);

        const welcomeTimer = setTimeout(() => {
            showToast('info', 'Welcome to Clip! Your clipboard history is ready.');
        }, 1000);

        return () => {
            isMounted = false;
            clearTimeout(welcomeTimer);
            if (typeof dispose === 'function') dispose();
        };
    }, [logger, showToast]);

    React.useEffect(() => {
        const handler = () => {
            setLastCacheUpdate(0);
            requestClipboardHistory();
        };

        const dispose = window.electronAPI?.onClipboardItem?.(handler);
        return () => {
            if (typeof dispose === 'function') dispose();
        };
    }, [requestClipboardHistory]);

    React.useEffect(() => {
        if (!window.electronAPI?.onWindowWillShow) return;

        const handleWillShow = () => {
            onWindowWillShow?.();
            requestClipboardHistory();
        };

        const dispose = window.electronAPI.onWindowWillShow(handleWillShow);
        return () => {
            if (typeof dispose === 'function') dispose();
        };
    }, [onWindowWillShow, requestClipboardHistory]);

    const handleClearAll = React.useCallback(() => {
        setLastCacheUpdate(0);
        setItemsCache([]);
        setIsCacheLoaded(false);
        setItems([]);

        window.electronAPI?.clearClipboardHistory?.();
        onAfterClearAll?.();
        showToast('success', 'Clipboard history cleared successfully');
    }, [onAfterClearAll, showToast]);

    const handlePaste = React.useCallback(
        (item: ClipboardItem) => {
            logger.renderer('handlePaste called for item', item);
            window.electronAPI?.pasteClipboardItem(item);
        },
        [logger],
    );

    const handleTogglePin = React.useCallback((item: ClipboardItem) => {
        setLastCacheUpdate(0);

        const dbId = parseInt(item.id, 10);
        if (!isNaN(dbId)) {
            window.electronAPI?.toggleItemPinned?.(dbId, !item.pinned);
        }
    }, []);

    const confirmDelete = React.useCallback((item: ClipboardItem) => {
        setLastCacheUpdate(0);

        const dbId = parseInt(item.id, 10);
        if (!isNaN(dbId)) {
            window.electronAPI?.deleteClipboardItem?.(dbId);
        }

        setIsDeleteDialogClosing(true);
        setTimeout(() => {
            setIsDeleteDialogClosing(false);
            setDeleteTarget(null);
        }, 300);
    }, []);

    const handleDeleteItem = React.useCallback(
        (item: ClipboardItem) => {
            if (settings.deleteConfirm) {
                setDeleteTarget(item);
                setIsDeleteDialogClosing(false);
                return;
            }

            confirmDelete(item);
        },
        [confirmDelete, settings.deleteConfirm],
    );

    const handleDeleteDialogClose = React.useCallback(() => {
        setIsDeleteDialogClosing(true);
        setTimeout(() => {
            setDeleteTarget(null);
            setIsDeleteDialogClosing(false);
        }, 300);
    }, []);

    return {
        items,
        setItems,
        hasLoadedInitially,
        isInitialLoading,
        itemsCache,
        isCacheLoaded,
        lastCacheUpdate,
        setItemsCache,
        setIsCacheLoaded,
        setLastCacheUpdate,
        useCacheIfValid,
        requestClipboardHistory,
        deleteTarget,
        setDeleteTarget,
        isDeleteDialogClosing,
        setIsDeleteDialogClosing,
        handleClearAll,
        handlePaste,
        handleTogglePin,
        handleDeleteItem,
        confirmDelete,
        handleDeleteDialogClose,
    };
}
