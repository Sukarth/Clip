import * as React from 'react';
import type { Settings } from '../../app-types';
import type { ThemeProfile } from '../../../theme-config';

interface ThemeProfileDialogProps {
    settings: Settings;
    themeColors: ThemeProfile['colors'];
    mode: 'reset' | 'delete';
    activeThemeProfileName?: string;
    isClosing: boolean;
    dialogRef: React.RefObject<HTMLDivElement | null>;
    onConfirm: () => void;
    onCancel: () => void;
}

const ThemeProfileDialog: React.FC<ThemeProfileDialogProps> = ({
    settings,
    themeColors,
    mode,
    activeThemeProfileName,
    isClosing,
    dialogRef,
    onConfirm,
    onCancel,
}) => {
    const isReset = mode === 'reset';

    return (
        <div
            className={`fade-opacity-${isClosing ? 'out' : 'in'}`}
            style={{
                position: 'fixed',
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: isReset ? 2350 : 2351,
                borderRadius: settings.borderRadius,
            }}
        >
            <div
                ref={dialogRef}
                className={`${isClosing ? 'fade-out' : 'fade-in'}`}
                role="dialog"
                aria-modal="true"
                aria-label={isReset ? 'Theme profile reset confirmation' : 'Theme profile delete confirmation'}
                tabIndex={-1}
                style={{
                    background: themeColors.panelBackground,
                    borderRadius: 10,
                    padding: 24,
                    minWidth: 340,
                    maxWidth: 460,
                    textAlign: 'center',
                    boxShadow: '0 2px 12px #0008',
                    border: `1px solid ${themeColors.border}`,
                }}
            >
                <div
                    style={{
                        marginBottom: 18,
                        color: isReset ? themeColors.warning : themeColors.danger,
                        fontWeight: 700,
                        fontSize: 17,
                        lineHeight: 1.4,
                    }}
                >
                    {isReset ? 'Reset this profile\'s theme to default?' : 'Delete this theme profile?'}
                </div>
                <div
                    style={{
                        fontSize: 14,
                        color: themeColors.textSecondary,
                        marginBottom: 18,
                        lineHeight: 1.55,
                        textAlign: 'left',
                    }}
                >
                    {isReset ? (
                        <>
                            This will overwrite the selected profile's colors, typography, surface settings, and icons with
                            Clip's default theme values.
                            <br />
                            <br />
                            The profile name will stay the same.
                            <br />
                            <br />
                            <strong style={{ color: themeColors.danger }}>This cannot be undone.</strong>
                        </>
                    ) : (
                        <>
                            This will permanently delete the active profile{' '}
                            <strong style={{ color: themeColors.textPrimary }}>{activeThemeProfileName}</strong>.
                            <br />
                            <br />
                            If you delete the current profile, Clip will switch to another available profile.
                            <br />
                            <br />
                            <strong style={{ color: themeColors.danger }}>This cannot be undone.</strong>
                        </>
                    )}
                </div>
                <button
                    style={{
                        background: isReset ? themeColors.warning : themeColors.danger,
                        color: isReset ? '#222' : '#fff',
                        border: `1px solid ${isReset ? themeColors.warning : themeColors.danger}`,
                        borderRadius: 6,
                        padding: '8px 18px',
                        marginRight: 10,
                        marginBottom: 8,
                        fontWeight: 700,
                        cursor: 'pointer',
                    }}
                    onClick={onConfirm}
                >
                    {isReset ? 'Yes, Reset Profile' : 'Yes, Delete Profile'}
                </button>
                <button
                    data-dialog-autofocus
                    style={{
                        background: '#222',
                        color: '#fff',
                        border: `1px solid ${themeColors.border}`,
                        borderRadius: 6,
                        padding: '8px 18px',
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                    onClick={onCancel}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default React.memo(ThemeProfileDialog);
