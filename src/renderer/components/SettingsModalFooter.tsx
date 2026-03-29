import * as React from 'react';
import type { Settings } from '../app-types';

interface SettingsModalFooterProps {
    settingsDraft: Settings | null;
    settings: Settings;
    onQuitRequest: () => void;
    onSave: () => void;
    onCancel: () => void;
}

const SettingsModalFooter: React.FC<SettingsModalFooterProps> = ({
    settingsDraft,
    settings,
    onQuitRequest,
    onSave,
    onCancel,
}) => {
    const accentColor = settingsDraft?.accentColor ?? settings.accentColor;

    return (
        <div
            style={{
                padding: '12px 24px',
                borderTop: '1px solid #333',
                flexShrink: 0,
                display: 'flex',
                gap: 12,
                justifyContent: 'flex-end',
                alignItems: 'center',
            }}
        >
            <button
                style={{
                    background: '#ff4136',
                    border: '1px solid #ff4136',
                    borderRadius: 8,
                    color: '#fff',
                    padding: '8px 18px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 15,
                    marginRight: 'auto',
                    transition: 'background 0.2s, border 0.2s',
                }}
                onClick={onQuitRequest}
            >
                Quit App
            </button>
            <button
                className="clip-settings-save-btn"
                style={{
                    background: accentColor,
                    border: `1px solid ${accentColor}`,
                    borderRadius: 8,
                    color: '#222',
                    padding: '8px 18px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 15,
                }}
                onClick={onSave}
            >
                Save
            </button>
            <button
                className="clip-settings-cancel-btn"
                style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid #444',
                    borderRadius: 8,
                    color: '#fff',
                    padding: '8px 18px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 15,
                }}
                onClick={onCancel}
            >
                Cancel
            </button>
        </div>
    );
};

export default React.memo(SettingsModalFooter);