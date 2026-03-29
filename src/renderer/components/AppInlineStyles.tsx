import * as React from 'react';
import type { ThemeProfile } from '../../theme-config';
import type { Settings } from '../app-types';
import { getSliderStyles } from '../theme-utils';

interface AppInlineStylesProps {
    settings: Settings;
    themeColors: ThemeProfile['colors'];
    themeTypography: ThemeProfile['typography'];
    themeSurface: ThemeProfile['surface'];
    effectiveBorderRadius: number;
}

const AppInlineStyles: React.FC<AppInlineStylesProps> = ({
    settings,
    themeColors,
    themeTypography,
    themeSurface,
    effectiveBorderRadius,
}) => {
    return (
        <style>{`
                /* Global CSS for clean interface */
                body {
                    margin: 0;
                    font-family: 'Segoe UI', Arial, sans-serif;
                    overflow: hidden;
                    -webkit-user-select: none;
                    user-select: none;
                }

                /* Custom slider styles */
                ${getSliderStyles(settings.accentColor)}

                /* Light theme slider styles */
                .theme-light input[type="range"]::-webkit-slider-runnable-track {
                    background: #ccc !important;
                }
                .theme-light input[type="range"]::-moz-range-track {
                    background: #ccc !important;
                }
                .clip-root {
                    background: ${themeColors.appBackground};
                    border-radius: ${effectiveBorderRadius}px;
                    padding: 3%;
                    height: ${settings.windowHeight}px;
                    width: ${settings.windowWidth}px;
                    color: ${themeColors.textPrimary};
                    font-family: ${themeTypography.fontFamily};
                    transition: box-shadow 0.2s, border-radius 0.3s, background 0.3s;
                    position: relative;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box; /* Include padding in dimensions */
                    padding-bottom: 7px;
                    backdrop-filter: blur(${themeSurface.backdropBlur}px);
                    -webkit-backdrop-filter: blur(${themeSurface.backdropBlur}px);
                }

                /* Dark mode option styling */
                option {
                    background: #23252a !important;
                    color: #fff !important;
                }

                select option {
                    background: #23252a !important;
                    color: #fff !important;
                }

                /* Theme-based styling */
                .theme-light .clip-root {
                    background: ${themeColors.appBackground};
                    color: ${themeColors.textPrimary};
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                }

                .theme-light .clip-item {
                    background: ${themeColors.itemBackground} !important;
                    color: ${themeColors.textPrimary};
                    border: 1px solid ${themeColors.border} !important;
                }

                .theme-light .clip-item:hover {
                    background: ${themeColors.itemHoverBackground} !important;
                    border: 1px solid ${themeColors.border} !important;
                }

                .theme-light .clip-settings-page {
                    background: ${themeColors.panelBackground} !important;
                    color: ${themeColors.textPrimary};
                }


                .theme-light .clip-settings-scroll::-webkit-scrollbar-thumb {
                    background: ${themeColors.scrollbarThumb};
                    border: 2px solid ${themeColors.scrollbarTrack};
                    max-height: 90%;
                }

                .theme-light .clip-settings-scroll::-webkit-scrollbar-thumb:hover {
                    background: ${themeColors.accent};
                }

                .theme-light input, .theme-light select {
                    background: ${themeColors.inputBackground} !important;
                    color: ${themeColors.textPrimary} !important;
                    border: 1px solid ${themeColors.inputBorder} !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
                }

                /* Only apply input-like styling to labels that have background styling (container labels) */
                .theme-light label[style*="background: rgba(255,255,255,0.03)"],
                .theme-light label[style*="background: rgba(255,255,255,0.05)"],
                .theme-light label[style*="background: rgba(255,255,255,0.08)"] {
                    background: rgba(255,255,255,0.9) !important;
                    border: 1px solid #e5e7eb !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important;
                }

                .theme-light input:focus, .theme-light select:focus {
                    border-color: ${themeColors.accent} !important;
                    box-shadow: 0 0 0 3px rgba(70, 130, 180, 0.1) !important;
                    outline: none !important;
                }

                .theme-light option {
                    background: ${themeColors.panelBackground} !important;
                    color: ${themeColors.textPrimary} !important;
                }

                /* Dark mode theme-specific option styling */
                .theme-dark option {
                    background: #23252a !important;
                    color: #fff !important;
                }

                .theme-dark select option {
                    background: #23252a !important;
                    color: #fff !important;
                }

                .theme-light button:not(.no-btn, .clip-pin-btn, .clip-delete-btn) {
                    color: ${themeColors.textSecondary} !important;
                    border: 1px solid ${themeColors.inputBorder} !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
                    transition: all 0.2s ease !important;
                }

                .theme-light button:hover:not(.clip-pin-btn, .clip-delete-btn) {
                    border-color: ${themeColors.accent} !important;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.15) !important;
                }

                .theme-light button.clip-settings-save-btn {
                    background: ${settings.accentColor} !important;
                    color: #fff !important;
                    border-color: ${settings.accentColor} !important;
                }

                .theme-light button.clip-settings-save-btn:hover {
                    background: ${settings.accentColor}dd !important;
                    box-shadow: 0 2px 8px rgba(70, 130, 180, 0.3) !important;
                }

                .theme-light h2 {
                    color: ${themeColors.textPrimary} !important;
                    border-bottom-color: ${themeColors.border} !important;
                }

                .theme-light h3 {
                    color: ${themeColors.textSecondary} !important;
                }

                .theme-light span:not(.toast-message>span) {
                    color: ${themeColors.textMuted} !important;
                }

                /* Light mode text labels - only for text labels, not container labels */
                .theme-light label:not([style*="background:"]) {
                    color: ${themeColors.textSecondary} !important;
                }

                /* Light mode simple class-based styling */

                /* Settings inputs and selects */
                .theme-light .settings-input,
                .theme-light .settings-select {
                    background: rgba(255,255,255,0.95) !important;
                    color: #2c3e50 !important;
                    border: 1px solid #d1d5db !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
                }

                #danger-area {
                    color: ${themeColors.danger} !important;
                }

                .theme-light #reset-settings-warning {
                    color: ${themeColors.warning} !important;
                }

                .theme-light .settings-input:focus,
                .theme-light .settings-select:focus {
                    border-color: ${settings.accentColor} !important;
                    box-shadow: 0 0 0 3px rgba(70, 130, 180, 0.1) !important;
                }

                /* Settings container labels (switch containers) */
                .theme-light .settings-container {
                    background: rgba(255,255,255,0.9) !important;
                    border: 1px solid #e5e7eb !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important;
                }

                /* Settings buttons */
                .theme-light .settings-button {
                    background: rgba(255,255,255,0.9) !important;
                    border: 1px solid #d1d5db !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
                }

                .theme-light .settings-button:hover {
                    border-color: #9ca3af !important;
                }

                /* Settings display boxes (shortcut display, backup list, etc.) */
                .theme-light .settings-display-box {
                    background: rgba(255,255,255,0.9) !important;
                    color: #374151 !important;
                    border: 1px solid #e5e7eb !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important;
                }

                /* Danger zone styling for light mode */
                .theme-light div[style*="background: rgba(255,65,54,0.08)"] {
                    background: rgba(120,120,120,0.15) !important;
                }

                .theme-light div[style*="color: #ffb300"] {
                    color: #ff4136 !important;
                }

                /* Shortcut modifier buttons */
                .theme-light .settings-modifier-button {
                    background: rgba(255,255,255,0.9) !important;
                    color: #2c3e50 !important;
                    border: 1px solid #d1d5db !important;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
                }
                    
                .theme-light #settings-title {
                    color: #575f6c !important;
                }

                .theme-light .settings-modifier-button:hover {
                    background: rgba(255,255,255,1) !important;
                    border-color: #9ca3af !important;
                }

                /* Light mode section backgrounds */
                .theme-light div[style*="background: rgba(255,255,255,0.03)"] {
                    background: rgba(255,255,255,0.7) !important;
                    border: 1px solid #e5e7eb !important;
                }

                .theme-light div[style*="background: rgba(255,255,255,0.05)"] {
                    background: rgba(255,255,255,0.8) !important;
                    border: 1px solid #e5e7eb !important;
                }

                .theme-light div[style*="background: rgba(255,255,255,0.08)"] {
                    background: rgba(255,255,255,0.9) !important;
                    border: 1px solid #d1d5db !important;
                }

                @keyframes clip-fadein {
                    from { opacity: 0; transform: translateY(16px) scale(0.98); }
                    to { opacity: 1; transform: none; }
                }
                @keyframes clip-fadeout {
                from { opacity: 1; transform: none; }
                to { opacity: 0; transform: translateY(16px) scale(0.98); }
                }
                @keyframes clip-item-slide-in {
                    from {
                        opacity: 0;
                        transform: translateY(20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                .clip-item-animate {
                    animation: clip-item-slide-in 0.4s ease-out forwards;
                }
                .fade-in { animation: clip-fadein 0.3s forwards; }
                .fade-out { animation: clip-fadeout 0.3s forwards; }
                .fade-opacity-in { opacity: 1; transition: opacity 0.3s; }
                .fade-opacity-out { opacity: 0; transition: opacity 0.3s; }

                /* Toast notifications */
                @keyframes toast-in {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes toast-out {
                    from { opacity: 1; transform: translateY(0); }
                    to { opacity: 0; transform: translateY(20px); }
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes skeleton-shimmer {
                    0% { left: -100%; }
                    100% { left: 100%; }
                }
                .toast-message {
                    animation: toast-in 0.3s ease-out forwards;
                }
                .toast-message.removing {
                    animation: toast-out 0.3s ease-in forwards;
                }

                /* Other elements */
                .clip-item {
                    will-change: transform, opacity;
                    border-radius: ${themeSurface.itemRadius}px !important;
                }
                .clip-item:active {
                    transform: scale(0.97);
                    box-shadow: 0 2px 16px 0 #ffb30044;
                }
                .clip-settings-page {
                    overflow: hidden;
                }
                .clip-settings-scroll {
                    scrollbar-width: thin;
                    scrollbar-color: #444 #23252a;
                }
                .clip-settings-scroll::-webkit-scrollbar {
                    width: 8px;
                    background: transparent;
                    transition: opacity 0.2s;
                    opacity: 0;
                    position: absolute;
                    right: 0;
                    z-index: 10;
                }
                .clip-settings-scroll:hover::-webkit-scrollbar {
                    opacity: 1;
                }
                .clip-settings-scroll::-webkit-scrollbar-thumb {
                    background: #444;
                    border-radius: 6px;
                    border: 2px solid #23252a;
                    min-height: 40px;
                    transition: background 0.2s;
                    max-height: 90%;
                }
                .clip-settings-scroll::-webkit-scrollbar-thumb:hover {
                    background: #2ecc40;
                }
                /* Clipboard list scrollbar styling */
                .clip-list {
                    overflow-y: overlay;
                    scrollbar-width: thin;
                    scrollbar-color: #444 #23252a;
                }
                .clip-list::-webkit-scrollbar {
                    width: 8px;
                    background: transparent;
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                .clip-list:hover::-webkit-scrollbar {
                    opacity: 1;
                }
                .clip-list::-webkit-scrollbar-thumb {
                    background: ${themeColors.scrollbarThumb};
                    border-radius: 6px;
                    border: 2px solid ${themeColors.scrollbarTrack};
                    min-height: 20px !important;
                    transition: background 0.2s;
                }
                .clip-list::-webkit-scrollbar-thumb:hover {
                    background: ${themeColors.accent};
                }

                /* Backup list scrollbar styling */
                .clip-settings-scroll div[style*="overflowY"]::-webkit-scrollbar {
                    width: 6px;
                    background: transparent;
                }
                .clip-settings-scroll div[style*="overflowY"]::-webkit-scrollbar-thumb {
                    background: #444;
                    border-radius: 3px;
                    transition: background 0.2s;
                }
                .clip-settings-scroll div[style*="overflowY"]::-webkit-scrollbar-thumb:hover {
                    background: ${settings.accentColor};
                }
            `}</style>
    );
};

export default React.memo(AppInlineStyles);
