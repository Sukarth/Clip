import * as React from 'react';
import { sectionHeaderStyle } from '../app-constants';

interface SettingsDataSectionProps {
    handleExportSettings: () => void;
    handleImportSettings: () => void;
    showToast: (type: 'success' | 'error' | 'info', message: string) => void;
    logger: { error: (...args: any[]) => void };
}

const buttonStyle: React.CSSProperties = {
    background: '#23252a',
    border: '1px solid #444',
    borderRadius: 8,
    color: '#fff',
    padding: '7px 18px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 15,
    transition: 'background 0.2s, border 0.2s',
};

const SettingsDataSection: React.FC<SettingsDataSectionProps> = ({
    handleExportSettings,
    handleImportSettings,
    showToast,
    logger,
}) => {
    return (
        <div>
            <h2 style={sectionHeaderStyle}>Data</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20, marginTop: 21 }}>
                <button className="settings-button" style={buttonStyle} onClick={handleExportSettings}>
                    Export Settings
                </button>
                <button className="settings-button" style={buttonStyle} onClick={handleImportSettings}>
                    Import Settings
                </button>
                <button
                    className="settings-button"
                    style={buttonStyle}
                    onClick={async (e) => {
                        const button = e.currentTarget;
                        const originalText = button.textContent || 'Export Database';

                        try {
                            button.textContent = 'Exporting...';
                            button.style.opacity = '0.7';

                            const data = await window.electronAPI?.exportDb?.();
                            if (data) {
                                const blob = new Blob([data.buffer as ArrayBuffer], {
                                    type: 'application/octet-stream',
                                });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `clip-backup-${new Date().toISOString().substring(0, 10)}.db`;
                                a.click();
                                setTimeout(() => URL.revokeObjectURL(url), 1000);
                                showToast('success', 'Database exported successfully');
                            } else {
                                showToast('error', 'Failed to export database');
                            }
                        } catch (error) {
                            logger.error('Export error', error instanceof Error ? error.message : String(error));
                            showToast('error', `Export failed: ${error instanceof Error ? error.message : String(error)}`);
                        } finally {
                            button.textContent = originalText;
                            button.style.opacity = '1';
                        }
                    }}
                >
                    Export Database
                </button>
                <button
                    className="settings-button"
                    style={buttonStyle}
                    onClick={async (e) => {
                        const button = e.currentTarget;
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.db,application/octet-stream';
                        input.onchange = async (ev: any) => {
                            const file = ev.target.files[0];
                            if (!file) return;

                            const originalText = button.textContent || 'Import Database';
                            button.textContent = 'Importing...';
                            button.style.opacity = '0.7';

                            try {
                                const buffer = await file.arrayBuffer();
                                const success = await window.electronAPI?.importDb?.(buffer);
                                if (success) {
                                    showToast('success', 'Database imported successfully!');
                                } else {
                                    showToast('error', 'Failed to import database');
                                }
                            } catch (error) {
                                logger.error('Import error', error instanceof Error ? error.message : String(error));
                                showToast('error', `Import failed: ${error instanceof Error ? error.message : String(error)}`);
                            } finally {
                                button.textContent = originalText;
                                button.style.opacity = '1';
                            }
                        };
                        input.click();
                    }}
                >
                    Import Database
                </button>
            </div>
        </div>
    );
};

export default React.memo(SettingsDataSection);