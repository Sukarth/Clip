import * as React from 'react';

interface SettingsDataSectionProps {
    handleExportSettings: () => void;
    handleImportSettings: () => void;
    settingsPaths: { configPath: string; schemaPath: string } | null;
    copyTextToClipboard: (value: string, label: string) => void | Promise<void>;
    openSettingsConfigInSystem: () => void | Promise<void>;
    reloadSettingsFromDisk: () => void | Promise<void>;
    setDangerAction: React.Dispatch<React.SetStateAction<null | 'clear' | 'reset'>>;
    showToast: (type: 'success' | 'error' | 'info', message: string) => void;
    logger: { error: (...args: any[]) => void };
}

const SettingsDataSection: React.FC<SettingsDataSectionProps> = ({
    handleExportSettings,
    handleImportSettings,
    settingsPaths,
    copyTextToClipboard,
    openSettingsConfigInSystem,
    reloadSettingsFromDisk,
    setDangerAction,
    showToast,
    logger,
}) => {
    const getDisplayName = React.useCallback((value: string | null | undefined, fallback: string) => {
        if (!value) {
            return fallback;
        }

        const parts = value.split(/[\\/]/).filter(Boolean);
        return parts[parts.length - 1] || fallback;
    }, []);

    return (
        <div className="space-y-3 py-3">
            <div className="bg-surface-container-low p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary text-sm">settings_backup_restore</span>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Settings</span>
                </div>

                <div className="space-y-2">
                    <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-high transition-all group bg-transparent border-0" type="button" onClick={handleExportSettings}>
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-on-surface-variant">upload_file</span>
                            <span className="text-sm text-on-surface">Export Settings</span>
                        </div>
                        <span className="material-symbols-outlined text-on-surface-variant text-base group-hover:translate-x-1 transition-transform">chevron_right</span>
                    </button>

                    <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-high transition-all group bg-transparent border-0" type="button" onClick={handleImportSettings}>
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-on-surface-variant">download</span>
                            <span className="text-sm text-on-surface">Import Settings</span>
                        </div>
                        <span className="material-symbols-outlined text-on-surface-variant text-base group-hover:translate-x-1 transition-transform">chevron_right</span>
                    </button>
                </div>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary text-sm">database</span>
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Database</span>
                </div>

                <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-high transition-all group bg-transparent border-0" type="button" onClick={async () => {
                    try {
                        const result = await window.electronAPI?.exportDbDialog?.();
                        if (!result || result.canceled) return;
                        if (result.ok) {
                            showToast('success', 'Database exported successfully');
                        } else {
                            showToast('error', `Export failed: ${result.error ?? 'Unknown error'}`);
                        }
                    } catch (error) {
                        logger.error('Export error', error instanceof Error ? error.message : String(error));
                        showToast('error', 'Export failed');
                    }
                }}>
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-on-surface-variant" style={{ fontVariationSettings: "'FILL' 1" }}>database</span>
                        <span className="text-sm text-on-surface">Export Database</span>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant text-base group-hover:translate-x-1 transition-transform">chevron_right</span>
                </button>

                <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-high transition-all group bg-transparent border-0" type="button" onClick={async () => {
                    try {
                        const result = await window.electronAPI?.importDbDialog?.();
                        if (!result || result.canceled) return;
                        if (result.ok) {
                            showToast('success', 'Database imported successfully!');
                        } else {
                            showToast('error', result.error ?? 'Failed to import database');
                        }
                    } catch (error) {
                        logger.error('Import error', error instanceof Error ? error.message : String(error));
                        showToast('error', 'Import failed');
                    }
                }}>
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-on-surface-variant">system_update_alt</span>
                        <span className="text-sm text-on-surface">Import Database</span>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant text-base group-hover:translate-x-1 transition-transform">chevron_right</span>
                </button>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl space-y-3">
                <div className="json-file-card-header">
                    <div className="json-file-card-title">
                        <span className="material-symbols-outlined">article</span>
                        <div>
                            <h3>Settings JSON</h3>
                            <p>Open or reload the file that stores Clip&apos;s settings.</p>
                        </div>
                    </div>
                </div>

                <button className="json-file-pill" type="button" title="Click to copy" onClick={() => settingsPaths?.configPath && void copyTextToClipboard(settingsPaths.configPath, 'Settings file path')}>
                    <span className="json-file-pill-main">
                        <span className="material-symbols-outlined">description</span>
                        <span className="json-file-pill-text">
                            <strong>{getDisplayName(settingsPaths?.configPath, 'clip-settings.json')}</strong>
                            <span>Main settings file</span>
                        </span>
                    </span>
                    <span className="json-file-pill-copy material-symbols-outlined">content_copy</span>
                </button>

                <button className="json-file-pill" type="button" title="Click to copy" onClick={() => settingsPaths?.schemaPath && void copyTextToClipboard(settingsPaths.schemaPath, 'Settings schema path')}>
                    <span className="json-file-pill-main">
                        <span className="material-symbols-outlined">schema</span>
                        <span className="json-file-pill-text">
                            <strong>{getDisplayName(settingsPaths?.schemaPath, 'clip-settings.schema.json')}</strong>
                            <span>Schema and validation guide</span>
                        </span>
                    </span>
                    <span className="json-file-pill-copy material-symbols-outlined">content_copy</span>
                </button>

                <div className="json-actions-stack">
                    <button className="json-action-btn" type="button" onClick={() => { void openSettingsConfigInSystem(); }}>Open Settings JSON</button>
                    <button className="json-action-btn" type="button" onClick={() => { void reloadSettingsFromDisk(); }}>Reload From Disk</button>
                </div>
            </div>

            <div className="bg-surface-container-low p-4 rounded-xl border border-error/20 mt-2">
                <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-error text-sm">warning</span>
                    <span className="text-xs font-semibold text-error uppercase tracking-wider">Danger Zone</span>
                </div>
                <p className="text-[11px] text-on-surface-variant mb-3">These actions cannot be undone. Please be careful.</p>

                <div className="space-y-2">
                    <button className="w-full py-2 px-3 bg-error/10 border border-error/30 text-error rounded-lg text-xs font-medium hover:bg-error/20 transition-all flex items-center justify-center gap-2" style={{ minHeight: 41 }} type="button" onClick={() => setDangerAction('clear')}>
                        <span className="material-symbols-outlined text-sm">delete_sweep</span>
                        <span>Clear All Clipboard History</span>
                    </button>

                    <button className="w-full py-2 px-3 bg-warning/10 border border-warning/30 text-warning rounded-lg text-xs font-medium hover:bg-warning/20 transition-all flex items-center justify-center gap-2" style={{ minHeight: 41 }} type="button" onClick={() => setDangerAction('reset')}>
                        <span className="material-symbols-outlined text-sm">restart_alt</span>
                        <span>Reset All Settings to Default</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(SettingsDataSection);
