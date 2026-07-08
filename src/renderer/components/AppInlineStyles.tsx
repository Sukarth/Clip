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
    const styles = React.useMemo(
        () => `
                /* Global CSS for clean interface */
                body {
                    margin: 0;
                    font-family: 'Lexend', 'Segoe UI', Arial, sans-serif;
                    overflow: hidden;
                    -webkit-user-select: none;
                    user-select: none;
                }
                button,
                input,
                select,
                textarea {
                    font-family: 'Lexend', sans-serif;
                }
                .material-symbols-outlined {
                    font-family: 'Material Symbols Outlined';
                    font-weight: normal;
                    font-style: normal;
                    line-height: 1;
                    letter-spacing: normal;
                    text-transform: none;
                    display: inline-block;
                    white-space: nowrap;
                    word-wrap: normal;
                    direction: ltr;
                    -webkit-font-feature-settings: 'liga';
                    -webkit-font-smoothing: antialiased;
                    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
                }
                .group { }
                .flex { display: flex; }
                .grid { display: grid; }
                .block { display: block; }
                .w-8 { width: 2rem; }
                .w-full { width: 100%; }
                .h-8 { height: 2rem; }
                .flex-1 { flex: 1 1 0%; }
                .flex-shrink-0 { flex-shrink: 0; }
                .flex-wrap { flex-wrap: wrap; }
                .flex-col { flex-direction: column; }
                .items-center { align-items: center; }
                .items-start { align-items: flex-start; }
                .justify-around { justify-content: space-around; }
                .justify-between { justify-content: space-between; }
                .justify-center { justify-content: center; }
                .text-left { text-align: left; }
                .text-center { text-align: center; }
                .underline { text-decoration: underline; }
                .uppercase { text-transform: uppercase; }
                .italic { font-style: italic; }
                .font-medium { font-weight: 500; }
                .font-semibold { font-weight: 600; }
                .font-bold { font-weight: 700; }
                .tracking-wider { letter-spacing: 0.08em; }
                .tracking-tight { letter-spacing: -0.02em; }
                .rounded-full { border-radius: 9999px; }
                .rounded-lg { border-radius: 1.5rem; }
                .rounded-t-xl { border-top-left-radius: 2rem; border-top-right-radius: 2rem; }
                .rounded-xl { border-radius: 2rem; }
                .rounded-2xl { border-radius: 1rem; }
                .border { border-width: 1px; border-style: solid; }
                .border-0 { border: 0; }
                .border-t { border-top-width: 1px; border-top-style: solid; }
                .border-outline-variant\\/10 { border-color: rgba(67, 71, 79, 0.1); }
                .border-error\\/20 { border-color: rgba(255, 107, 107, 0.2); }
                .border-error\\/30 { border-color: rgba(255, 107, 107, 0.3); }
                .border-warning\\/30 { border-color: rgba(255, 193, 7, 0.3); }
                .bg-transparent { background: transparent; }
                .bg-surface { background: #131313; }
                .bg-surface-container { background: #202020; }
                .bg-surface-container\\/90 { background: rgba(32, 32, 32, 0.9); }
                .bg-surface-container-low { background: #1c1b1b; }
                .bg-surface-container-high { background: #2a2a2a; }
                .bg-surface-container-highest { background: #353534; }
                .bg-primary-container { background: #abccff; }
                .bg-primary-container\\/20 { background: rgba(171, 204, 255, 0.2); }
                .bg-warning\\/10 { background: rgba(255, 193, 7, 0.1); }
                .bg-warning\\/20 { background: rgba(255, 193, 7, 0.2); }
                .bg-error\\/10 { background: rgba(255, 107, 107, 0.1); }
                .bg-gradient-to-r { background-image: linear-gradient(to right, var(--tw-gradient-stops)); }
                .bg-gradient-to-br { background-image: linear-gradient(to bottom right, var(--tw-gradient-stops)); }
                .from-primary { --tw-gradient-from: #dae7ff; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(218, 231, 255, 0)); }
                .from-primary-container { --tw-gradient-from: #abccff; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(171, 204, 255, 0)); }
                .to-primary { --tw-gradient-to: #dae7ff; }
                .to-primary-container { --tw-gradient-to: #abccff; }
                .text-primary { color: #dae7ff !important; }
                .text-on-primary { color: #00315e !important; }
                .text-on-surface { color: #e5e2e1 !important; }
                .text-on-surface-variant { color: #c3c6d0 !important; }
                .text-error { color: #ff6b6b !important; }
                .text-warning { color: #ffc107 !important; }
                .text-success { color: #4caf50 !important; }
                .text-xs { font-size: 0.75rem; }
                .text-sm { font-size: 0.875rem; }
                .text-base { font-size: 1rem; }
                .text-lg { font-size: 1.125rem; }
                .text-xl { font-size: 1.25rem; }
                .text-2xl { font-size: 1.5rem; }
                .text-4xl { font-size: 2.25rem; }
                .text-\\[9px\\] { font-size: 9px; }
                .text-\\[10px\\] { font-size: 10px; }
                .text-\\[11px\\] { font-size: 11px; }
                .text-\\[11px\\]\\.text-on-surface-variant { color: #c3c6d0 !important; }
                .mb-1 { margin-bottom: 0.25rem; }
                .mb-2 { margin-bottom: 0.5rem; }
                .mb-3 { margin-bottom: 0.75rem; }
                .mt-1 { margin-top: 0.25rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-0\\.5 { margin-top: 0.125rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-1\\.5 { margin-top: 0.375rem; }
                .mt-2 { margin-top: 0.5rem; }
                .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
                .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
                .px-4 { padding-left: 1rem; padding-right: 1rem; }
                .px-5 { padding-left: 1.25rem; padding-right: 1.25rem; }
                .py-1\\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
                .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
                .py-2\\.5 { padding-top: 0.625rem; padding-bottom: 0.625rem; }
                .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
                .p-3 { padding: 0.75rem; }
                .p-4 { padding: 1rem; }
                .p-5 { padding: 1.25rem; }
                .pb-20 { padding-bottom: 5rem; }
                .gap-2 { gap: 0.5rem; }
                .gap-3 { gap: 0.75rem; }
                .gap-4 { gap: 1rem; }
                .gap-x-3 { column-gap: 0.75rem; }
                .gap-y-4 { row-gap: 1rem; }
                .space-y-2 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.5rem; }
                .space-y-1 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.25rem; }
                .space-y-3 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.75rem; }
                .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
                .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
                .grid-cols-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
                .transition-all { transition: all 0.2s ease; }
                .transition-colors { transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease; }
                .transition-transform { transition: transform 0.2s ease; }
                .group:hover .group-hover\\:translate-x-1 { transform: translateX(0.25rem); }
                .hover\\:text-primary:hover { color: #dae7ff !important; }
                .hover\\:text-on-surface:hover { color: #e5e2e1 !important; }
                .hover\\:text-error:hover { color: #ff6b6b !important; }
                .hover\\:text-warning:hover { color: #ffc107 !important; }
                .hover\\:bg-surface-container-high:hover { background: #2a2a2a; }
                .hover\\:bg-surface-container-highest:hover { background: #353534; }
                .hover\\:bg-error\\/20:hover { background: rgba(255, 107, 107, 0.2); }
                .hover\\:bg-warning\\/20:hover { background: rgba(255, 193, 7, 0.2); }
                .hover\\:bg-warning\\/30:hover { background: rgba(255, 193, 7, 0.3); }
                .hover\\:brightness-110:hover { filter: brightness(1.1); }
                .active\\:scale-95:active { transform: scale(0.95); }
                .active\\:scale-\\[0\\.98\\]:active { transform: scale(0.98); }
                .backdrop-blur-xl { backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); }
                .absolute { position: absolute; }
                .bottom-0 { bottom: 0; }
                .left-0 { left: 0; }
                .right-0 { right: 0; }
                .z-10 { z-index: 10; }
                .z-50 { z-index: 50; }
                .overflow-x-hidden { overflow-x: hidden; }
                .overflow-y-auto { overflow-y: auto; }

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
                    background: ${themeColors.panelBackground} !important;
                    color: ${themeColors.textPrimary} !important;
                }

                select option {
                    background: ${themeColors.panelBackground} !important;
                    color: ${themeColors.textPrimary} !important;
                }

                /* Theme-based styling */
                .theme-light .clip-root {
                    background: ${themeColors.appBackground};
                    color: ${themeColors.textPrimary};
                    backdrop-filter: blur(${themeSurface.backdropBlur}px);
                    -webkit-backdrop-filter: blur(${themeSurface.backdropBlur}px);
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
                    background: ${themeColors.panelBackground} !important;
                    color: ${themeColors.textPrimary} !important;
                }

                .theme-dark select option {
                    background: ${themeColors.panelBackground} !important;
                    color: ${themeColors.textPrimary} !important;
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
                    background: ${settings.accentColor} !important;
                    background: color-mix(in srgb, ${settings.accentColor} 85%, transparent) !important;
                    box-shadow: 0 2px 8px color-mix(in srgb, ${settings.accentColor} 30%, transparent) !important;
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
                .app-container,
                .clip-settings-page {
                    position: relative;
                    box-shadow: 0 20px 80px rgba(0, 0, 0, 0.5);
                    border-radius: 16px;
                    overflow: hidden;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #43474f;
                    border-radius: 10px;
                }
                #mainContainer {
                    background: #131313;
                    color: #e5e2e1;
                    font-family: 'Lexend', sans-serif;
                }
                #mainContainer button,
                #mainContainer input,
                #mainContainer select,
                #mainContainer textarea {
                    font-family: inherit;
                }
                #contentArea {
                    flex: 1;
                    overflow-y: auto;
                    overflow-x: hidden;
                    padding: 0 16px 80px;
                }
                #content-container {
                    animation: fadeSlideIn 0.2s ease-out;
                }
                #mainHeader h1,
                #mainHeader .close-btn .material-symbols-outlined {
                    transition: all 0.2s ease;
                }
                .close-btn {
                    border: none;
                    background: transparent;
                    cursor: pointer;
                    font: inherit;
                    -webkit-appearance: none;
                    appearance: none;
                }
                #mainContainer button {
                    font-family: inherit;
                    -webkit-appearance: none;
                    appearance: none;
                }
                .custom-select {
                    position: relative;
                    width: 100%;
                }
                .custom-select-trigger {
                    display: flex;
                    width: 100%;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 14px;
                    background: #2a2a2a;
                    border-radius: 10px;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                    color: #e5e2e1;
                    font: inherit;
                    font-size: 13px;
                }
                .custom-select-trigger:hover {
                    background: #353534;
                }
                .custom-select-trigger span {
                    color: #e5e2e1;
                    font-size: 13px;
                }
                .custom-select-trigger .material-symbols-outlined {
                    color: #c3c6d0;
                    font-size: 18px;
                    transition: transform 0.2s;
                }
                .custom-select.open .custom-select-trigger .material-symbols-outlined {
                    transform: rotate(180deg);
                }
                .custom-select-options {
                    position: absolute;
                    top: calc(100% + 4px);
                    left: 0;
                    right: 0;
                    background: #2a2a2a;
                    border-radius: 10px;
                    overflow-y: auto;
                    z-index: 100;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
                    max-height: 200px;
                    padding-right: 2px;
                    opacity: 0;
                    visibility: hidden;
                    transform: translateY(-8px) scale(0.98);
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    overflow-x: hidden;
                }
                .custom-select-options::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-select-options::-webkit-scrollbar-track {
                    background: transparent;
                    margin: 4px 0;
                }
                .custom-select-options::-webkit-scrollbar-thumb {
                    background: #43474f;
                    border-radius: 10px;
                    border: 1px solid #2a2a2a;
                }
                .custom-select-options::-webkit-scrollbar-thumb:hover {
                    background: #5a5f6a;
                }
                .custom-select.open .custom-select-options {
                    opacity: 1;
                    visibility: visible;
                    transform: translateY(0) scale(1);
                }
                .custom-select-option {
                    display: block;
                    width: 100%;
                    text-align: left;
                    padding: 10px 14px;
                    color: #c3c6d0;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.15s;
                    background: transparent;
                    border: none;
                    font: inherit;
                }
                .custom-select-option:hover {
                    background: #353534;
                    color: #e5e2e1;
                }
                .custom-select-option.selected {
                    background: rgba(171, 204, 255, 0.15);
                    color: #abccff;
                }
                .toggle-switch {
                    position: relative;
                    width: 44px;
                    height: 24px;
                    flex-shrink: 0;
                    display: inline-block;
                }
                .toggle-switch input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }
                .toggle-slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #353534;
                    transition: 0.3s;
                    border-radius: 24px;
                }
                .toggle-slider:before {
                    position: absolute;
                    content: "";
                    height: 18px;
                    width: 18px;
                    left: 3px;
                    bottom: 3px;
                    background-color: #c3c6d0;
                    transition: 0.3s;
                    border-radius: 50%;
                }
                .toggle-switch input:checked + .toggle-slider {
                    background-color: #abccff;
                }
                .toggle-switch input:checked + .toggle-slider:before {
                    transform: translateX(20px);
                    background-color: #00315e;
                }
                .number-input-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    background: #2a2a2a;
                    border-radius: 10px;
                    padding: 9px;
                }
                .number-input-wrapper input {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    color: #e5e2e1 !important;
                    font-size: 14px;
                    font-weight: 600;
                    text-align: center;
                    width: 50px;
                    outline: none;
                    font-family: 'Lexend', sans-serif;
                    -moz-appearance: textfield;
                    -webkit-appearance: none;
                    appearance: textfield;
                    padding: 0 !important;
                    margin: 0;
                    line-height: 1;
                }
                .number-input-wrapper input::-webkit-outer-spin-button,
                .number-input-wrapper input::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    appearance: none;
                    margin: 0;
                    display: none;
                }
                .number-input-wrapper button {
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    background: #353534;
                    border: none;
                    color: #c3c6d0;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s;
                    flex-shrink: 0;
                }
                .number-input-wrapper button:hover {
                    background: #43474f;
                    color: #e5e2e1;
                }
                input[type="number"] {
                    -moz-appearance: textfield;
                    -webkit-appearance: none;
                    appearance: textfield;
                }
                input[type="number"]::-webkit-outer-spin-button,
                input[type="number"]::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    appearance: none;
                    margin: 0;
                    display: none;
                }
                .input-field {
                    background: #2a2a2a !important;
                    border: none !important;
                    border-radius: 10px;
                    padding: 10px 14px;
                    color: #e5e2e1 !important;
                    font-size: 13px;
                    outline: none;
                    transition: all 0.2s;
                    font-family: 'Lexend', sans-serif;
                    box-sizing: border-box;
                }
                .input-field:focus {
                    background: #353534 !important;
                    box-shadow: 0 0 0 2px rgba(171, 204, 255, 0.3) !important;
                }
                .input-field::placeholder {
                    color: #8c919c !important;
                }
                .shortcut-modifier-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    padding: 8px 10px;
                    background: #2a2a2a;
                    border: 1px solid #43474f;
                    border-radius: 8px;
                    color: #c3c6d0;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-family: 'Lexend', sans-serif;
                }
                .shortcut-modifier-btn:hover {
                    background: #353534;
                    border-color: #8c919c;
                }
                .shortcut-modifier-btn .material-symbols-outlined {
                    display: none;
                    font-size: 14px;
                }
                .shortcut-modifier-btn.active {
                    background: #abccff;
                    border-color: #abccff;
                    color: #00315e;
                }
                .shortcut-modifier-btn.active .material-symbols-outlined {
                    display: inline;
                }
                #shortcutPreview kbd {
                    padding: 12px 18px;
                    background: linear-gradient(145deg, #3d4555 0%, #2a3040 100%);
                    border-radius: 12px;
                    font-size: 14px;
                    font-weight: 600;
                    font-family: 'Lexend', sans-serif;
                    color: #dae7ff;
                    border: 1px solid rgba(171, 204, 255, 0.5);
                    box-shadow: 0 4px 0 #151a24, 0 8px 16px rgba(0, 0, 0, 0.5), 0 0 24px rgba(171, 204, 255, 0.15), inset 0 1px 0 rgba(171, 204, 255, 0.1);
                    display: inline-block;
                    min-width: 50px;
                    text-align: center;
                    position: relative;
                    top: 0;
                    transition: all 0.1s ease;
                }
                #shortcutPreview kbd:hover {
                    top: 2px;
                    background: linear-gradient(145deg, #4a5568 0%, #343d4d 100%);
                    border-color: rgba(171, 204, 255, 0.7);
                    color: #fff;
                    box-shadow: 0 2px 0 #151a24, 0 6px 12px rgba(0, 0, 0, 0.4), 0 0 28px rgba(171, 204, 255, 0.25), inset 0 1px 0 rgba(171, 204, 255, 0.15);
                }
                #shortcutPreview kbd:active {
                    top: 4px;
                    background: linear-gradient(145deg, #4a5568 0%, #3a4455 100%);
                    box-shadow: 0 0 0 #151a24, 0 2px 4px rgba(0, 0, 0, 0.3), 0 0 20px rgba(171, 204, 255, 0.2);
                }
                #shortcutPreview .key-separator {
                    color: #abccff;
                    font-size: 18px;
                    font-weight: 500;
                }
                .shortcut-warning {
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    opacity: 1;
                    transform: translateY(0);
                    max-height: 400px;
                    overflow: hidden;
                }
                .shortcut-warning.hidden {
                    opacity: 0;
                    transform: translateY(-8px);
                    max-height: 0;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                #shortcutInfoBox.hidden {
                    opacity: 0;
                    transform: translateY(-4px);
                    max-height: 0;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: hidden;
                }
                .view-toggle-container {
                    position: relative;
                    display: flex;
                    align-items: center;
                    background: #2a2a2a;
                    border-radius: 20px;
                    padding: 3px;
                }
                .view-toggle-indicator {
                    position: absolute;
                    top: 3px;
                    left: 3px;
                    height: calc(100% - 6px);
                    background: #3d4555;
                    border-radius: 16px;
                    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    z-index: 0;
                }
                .view-toggle-btn {
                    position: relative;
                    z-index: 1;
                    padding: 5px 12px;
                    font-size: 11px;
                    font-weight: 500;
                    border: none;
                    background: transparent;
                    border-radius: 16px;
                    cursor: pointer;
                    transition: color 0.2s ease;
                    font-family: 'Lexend', sans-serif;
                    white-space: nowrap;
                    color: #8c919c;
                }
                .view-toggle-btn.active {
                    color: #e5e2e1;
                }
                .view-toggle-btn:not(.active) {
                    color: #8c919c;
                }
                .view-toggle-btn:not(.active):hover {
                    color: #c3c6d0;
                }
                .color-swatch {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                }
                .color-swatch input[type="color"] {
                    -webkit-appearance: none;
                    width: 100%;
                    height: 40px;
                    border: none;
                    padding: 0;
                    background: transparent;
                    cursor: pointer;
                }
                .color-swatch input[type="color"]::-webkit-color-swatch-wrapper {
                    padding: 0;
                    border-radius: 10px;
                    overflow: hidden;
                }
                .color-swatch input[type="color"]::-webkit-color-swatch {
                    border: 2px solid rgba(67, 71, 79, 0.5);
                    border-radius: 10px;
                }
                .color-swatch input[type="color"]:hover::-webkit-color-swatch {
                    border-color: rgba(171, 204, 255, 0.5);
                }
                .color-swatch input[type="color"] {
                    transition: transform 0.15s ease;
                }
                .color-swatch input[type="color"]:hover {
                    transform: scale(1.08);
                }
                .color-swatch input[type="color"]:active {
                    transform: scale(0.95);
                }
                .color-swatch-label {
                    text-align: center;
                    font-size: 10px;
                    color: #8c919c;
                    font-weight: 500;
                }
                .json-file-card-header {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 12px;
                    margin-bottom: 12px;
                }
                .json-file-card-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    min-width: 0;
                }
                .json-file-card-title .material-symbols-outlined {
                    color: #abccff;
                    font-size: 18px;
                }
                .json-file-card-title h3 {
                    margin: 0;
                    color: #e5e2e1;
                    font-size: 14px;
                    font-weight: 700;
                }
                .json-file-card-title p {
                    margin: 2px 0 0;
                    color: #8c919c;
                    font-size: 11px;
                    line-height: 1.45;
                }
                .json-file-pill {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 12px 14px;
                    border-radius: 14px;
                    border: 1px solid #43474f;
                    background: linear-gradient(180deg, rgba(42, 42, 42, 0.9) 0%, rgba(28, 28, 28, 0.95) 100%) !important;
                    cursor: pointer;
                }
                .json-file-pill-main {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    min-width: 0;
                }
                .json-file-pill-main .material-symbols-outlined {
                    color: #abccff;
                    font-size: 18px;
                }
                .json-file-pill-text {
                    display: flex;
                    flex-direction: column;
                    min-width: 0;
                    text-align: left;
                }
                .json-file-pill-text strong {
                    color: #e5e2e1;
                    font-size: 12px;
                    font-weight: 700;
                    word-break: break-all;
                }
                .json-file-pill-text span {
                    color: #8c919c !important;
                    font-size: 10px;
                }
                .json-file-pill-copy {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    flex-shrink: 0;
                    border-radius: 9999px;
                    background: rgba(171, 204, 255, 0.12);
                    color: #abccff;
                    opacity: 0;
                    transform: translateX(6px) scale(0.92);
                    transition: all 0.18s ease;
                }
                .json-file-pill:hover .json-file-pill-copy {
                    opacity: 1;
                    transform: translateX(0) scale(1);
                }
                .json-actions-stack {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .json-action-btn {
                    width: 100%;
                    padding: 10px 12px;
                    border-radius: 12px;
                    background: #2a2a2a;
                    border: 1px solid #43474f;
                    color: #e5e2e1;
                    font-size: 12px;
                    font-weight: 700;
                    transition: all 0.2s ease;
                    font-family: inherit;
                    cursor: pointer;
                }
                .json-action-btn:hover {
                    background: #353534;
                    border-color: #8c919c;
                    color: #ffffff;
                }
                .bg-surface-container-high {
                    transition: background-color 0.15s ease, transform 0.15s ease;
                }
                #backupsList .bg-surface-container-high:hover {
                    background-color: #393939;
                    transform: translateX(2px);
                }
                .nav-btn {
                    border: none;
                    cursor: pointer;
                    font: inherit;
                    -webkit-appearance: none;
                    appearance: none;
                    background: transparent;
                    background-color: transparent;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    height: stretch;
                }
                .nav-btn.bg-primary-container\\/20 {
                    background: rgba(171, 204, 255, 0.2) !important;
                    background-color: rgba(171, 204, 255, 0.2) !important;
                }
                nav.absolute.bottom-0.left-0.right-0.z-50 {
                    min-height: 50px;
                }
                .nav-btn .material-symbols-outlined {
                    transition: font-variation-settings 0.2s ease;
                }
                .border-error\\/20 button {
                    transition: all 0.2s ease;
                }
                .border-error\\/20 button:active {
                    transform: scale(0.98);
                }
                button:active {
                    transform: scale(0.97);
                }
                .toggle-switch:active,
                .toggle-slider:active,
                .shortcut-modifier-btn:active,
                .number-input-wrapper button:active,
                .view-toggle-btn:active {
                    transform: none;
                }
                .number-input-wrapper button:active {
                    transform: scale(0.9);
                    background: #353534;
                }
                .shortcut-modifier-btn:active {
                    transform: scale(0.95);
                }
                .clip-settings-nav-btn {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 2px;
                    padding: 6px 12px;
                    border: none;
                    border-radius: 0.75rem;
                    background: transparent;
                    color: #8c919c;
                    cursor: pointer;
                    font: inherit;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .clip-settings-nav-btn:hover {
                    color: #e5e2e1;
                }
                .clip-settings-nav-btn.is-active {
                    color: #dae7ff;
                    background: rgba(171, 204, 255, 0.12);
                }
                .clip-settings-nav-btn:active {
                    transform: scale(0.96);
                }
                .clip-settings-nav-icon {
                    font-size: 16px;
                    line-height: 1;
                }
                .clip-settings-nav-label {
                    font-size: 9px;
                    font-weight: 500;
                }
                .w-20 { width: 5rem; }
                .h-20 { height: 5rem; }
                .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
                .leading-relaxed { line-height: 1.625; }
                .settings-section-layout {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding-bottom: 8px;
                }
                .settings-card {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 16px;
                    border-radius: 20px;
                    border: 1px solid #2f3238;
                    background: linear-gradient(180deg, rgba(32, 32, 32, 0.98) 0%, rgba(28, 27, 27, 0.98) 100%);
                    box-shadow: 0 14px 30px rgba(0, 0, 0, 0.24);
                }
                .settings-card-button {
                    flex-direction: row;
                    align-items: center;
                    justify-content: space-between;
                    cursor: pointer;
                    transition: transform 0.16s ease, background 0.2s ease;
                }
                .settings-card-button:hover {
                    transform: translateX(2px);
                    background: linear-gradient(180deg, rgba(42, 42, 42, 0.98) 0%, rgba(32, 32, 32, 0.98) 100%);
                }
                .settings-card-header {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 12px;
                }
                .settings-card-kicker {
                    display: inline-block;
                    margin-bottom: 4px;
                    color: #abccff;
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                }
                .settings-card-title {
                    margin: 0;
                    font-size: 15px;
                    font-weight: 700;
                    color: #e5e2e1;
                }
                .settings-item-title {
                    margin: 0 0 3px;
                    font-size: 14px;
                    font-weight: 500;
                    color: #e5e2e1;
                }
                .settings-item-description {
                    margin: 0;
                    font-size: 11px;
                    line-height: 1.45;
                    color: #a8abb4;
                }
                .settings-row,
                .settings-toggle-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 14px;
                }
                .settings-toggle-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .settings-field {
                    display: flex;
                    flex-direction: column;
                    gap: 7px;
                    min-width: 0;
                }
                .settings-field-label {
                    color: #c3c6d0;
                    font-size: 12px;
                    font-weight: 500;
                }
                .settings-input-ui,
                .settings-select-ui {
                    width: 100%;
                    box-sizing: border-box;
                    padding: 11px 14px;
                    border-radius: 12px;
                    border: 1px solid #3a3d44 !important;
                    background: #2a2a2a !important;
                    color: #e5e2e1 !important;
                    font: inherit;
                    font-size: 13px;
                    outline: none;
                    transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
                    box-shadow: none !important;
                }
                .settings-input-ui:focus,
                .settings-select-ui:focus {
                    border-color: #6f8fbf;
                    background: #353534;
                    box-shadow: 0 0 0 2px rgba(171, 204, 255, 0.2);
                }
                .settings-grid-two {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 10px;
                }
                .settings-grid-three {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 10px;
                }
                .settings-color-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 10px;
                }
                .settings-number-input {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 8px;
                    border-radius: 12px;
                    background: #2a2a2a;
                    min-width: 132px;
                }
                .settings-number-input input {
                    width: 100%;
                    min-width: 0;
                    text-align: center;
                    padding: 0;
                    border: none !important;
                    background: transparent !important;
                    box-shadow: none !important;
                    color: #e5e2e1 !important;
                    font-weight: 600;
                }
                .settings-number-input button {
                    width: 28px;
                    height: 28px;
                    border: none;
                    border-radius: 8px;
                    background: #353534;
                    color: #c3c6d0;
                    cursor: pointer;
                    transition: background 0.16s ease, color 0.16s ease, transform 0.14s ease;
                }
                .settings-number-input button:hover:not(:disabled) {
                    background: #43474f;
                    color: #fff;
                }
                .settings-number-input button:active:not(:disabled) {
                    transform: scale(0.92);
                }
                .settings-number-input button:disabled {
                    opacity: 0.45;
                    cursor: not-allowed;
                }
                .settings-inline-note-row,
                .settings-action-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    flex-wrap: wrap;
                }
                .settings-inline-note {
                    margin: 0;
                    color: #8c919c;
                    font-size: 11px;
                    line-height: 1.45;
                    flex: 1;
                }
                .settings-inline-note.is-error {
                    color: #ff8f8f;
                }
                .settings-chip-button,
                .settings-icon-button,
                .settings-secondary-button,
                .settings-primary-button,
                .settings-warning-button,
                .settings-danger-button {
                    border: none;
                    border-radius: 12px;
                    padding: 10px 14px;
                    font: inherit;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.15s ease, filter 0.2s ease, background 0.2s ease;
                }
                .settings-chip-button,
                .settings-icon-button,
                .settings-secondary-button {
                    background: #2a2a2a !important;
                    color: #e5e2e1 !important;
                }
                .settings-primary-button {
                    background: #abccff !important;
                    color: #00315e !important;
                }
                .settings-warning-button {
                    background: rgba(255, 193, 7, 0.18) !important;
                    color: #ffd666 !important;
                }
                .settings-danger-button {
                    background: rgba(255, 107, 107, 0.18) !important;
                    color: #ff8f8f !important;
                }
                .settings-secondary-button:hover,
                .settings-primary-button:hover,
                .settings-warning-button:hover,
                .settings-danger-button:hover,
                .settings-chip-button:hover,
                .settings-icon-button:hover {
                    filter: brightness(1.08);
                }
                .settings-secondary-button:active,
                .settings-primary-button:active,
                .settings-warning-button:active,
                .settings-danger-button:active,
                .settings-chip-button:active,
                .settings-icon-button:active {
                    transform: scale(0.97);
                }
                .settings-shortcut-modifiers {
                    display: grid;
                    grid-template-columns: repeat(4, minmax(0, 1fr));
                    gap: 8px;
                }
                .settings-shortcut-button {
                    padding: 9px 10px;
                    border: 1px solid #43474f;
                    border-radius: 10px;
                    background: #2a2a2a;
                    color: #c3c6d0;
                    font: inherit;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
                }
                .settings-shortcut-button.is-active {
                    background: #abccff;
                    border-color: #abccff;
                    color: #00315e;
                }
                .settings-shortcut-preview {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    min-height: 64px;
                    padding: 12px;
                    border-radius: 18px;
                    background: linear-gradient(145deg, #232833 0%, #1a1f28 100%);
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 20px rgba(0, 0, 0, 0.25);
                }
                .settings-shortcut-preview kbd {
                    display: inline-block;
                    min-width: 46px;
                    padding: 11px 14px;
                    border-radius: 12px;
                    background: linear-gradient(145deg, #3d4555 0%, #2a3040 100%);
                    color: #dae7ff;
                    border: 1px solid rgba(171, 204, 255, 0.5);
                    box-shadow: 0 4px 0 #151a24, 0 8px 16px rgba(0, 0, 0, 0.45);
                    text-align: center;
                    font-size: 13px;
                    font-weight: 700;
                }
                .settings-shortcut-separator {
                    color: #abccff;
                    font-size: 16px;
                    font-weight: 700;
                }
                .settings-shortcut-empty {
                    color: #a8abb4;
                    font-size: 12px;
                    font-style: italic;
                }
                .settings-warning-box,
                .settings-info-box {
                    padding: 12px 14px;
                    border-radius: 14px;
                    font-size: 12px;
                    line-height: 1.5;
                }
                .settings-warning-box {
                    background: rgba(255, 193, 7, 0.12);
                    color: #ffd666;
                    border: 1px solid rgba(255, 193, 7, 0.18);
                }
                .settings-warning-box p {
                    margin: 0 0 6px;
                }
                .settings-info-box {
                    background: #23252a;
                    color: #c3c6d0;
                    border: 1px solid #343943;
                }
                .settings-link-button {
                    border: none;
                    background: transparent;
                    padding: 0;
                    color: #dae7ff;
                    font: inherit;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                }
                .settings-chevron {
                    color: #abccff;
                    font-size: 20px;
                    line-height: 1;
                }
                .settings-action-stack {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .settings-list-action {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    width: 100%;
                    padding: 14px;
                    border: none;
                    border-radius: 14px;
                    background: #242424 !important;
                    color: #e5e2e1 !important;
                    font: inherit;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.18s ease, transform 0.16s ease;
                }
                .settings-list-action:hover {
                    background: #2d2d2d;
                    transform: translateX(2px);
                }
                .settings-json-pill {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    width: 100%;
                    padding: 14px;
                    border-radius: 14px;
                    border: 1px solid #43474f !important;
                    background: linear-gradient(180deg, rgba(42, 42, 42, 0.9) 0%, rgba(28, 28, 28, 0.95) 100%) !important;
                    color: #e5e2e1 !important;
                    text-align: left;
                    cursor: pointer;
                }
                .settings-json-pill strong {
                    font-size: 12px;
                    word-break: break-all;
                }
                .settings-json-pill-label {
                    color: #abccff;
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.12em;
                }
                .settings-inline-form {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 8px;
                }
                .settings-status-text {
                    color: #8c919c;
                    font-size: 11px;
                    font-weight: 600;
                }
                .settings-segmented-toggle {
                    display: flex;
                    padding: 3px;
                    border-radius: 999px;
                    background: #2a2a2a;
                }
                .settings-segmented-toggle button {
                    border: none;
                    border-radius: 999px;
                    padding: 6px 12px;
                    background: transparent;
                    color: #8c919c;
                    font: inherit;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                }
                .settings-segmented-toggle button.is-active {
                    background: #3d4555;
                    color: #e5e2e1;
                }
                .settings-danger-card {
                    border-width: 1px;
                }
                .settings-danger-kicker {
                    color: #ff8f8f;
                }
                .settings-danger-title {
                    color: #fff2f2;
                }
                .settings-danger-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                .is-disabled {
                    opacity: 0.55;
                }
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(6px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes settings-content-in {
                    from { opacity: 0; transform: translateY(6px); }
                    to { opacity: 1; transform: translateY(0); }
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
                    overflow-y: auto;
                    scrollbar-gutter: auto;
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

                *:focus-visible {
                    outline: none !important;
                    box-shadow: inset 0 0 0 2px ${themeColors.accent} !important;
                }

                .clip-item:focus,
                .clip-item:focus-visible {
                    outline: none !important;
                    box-shadow: inset 0 0 0 2px ${themeColors.accent} !important;
                }
            `,
        [effectiveBorderRadius, settings, themeColors, themeSurface, themeTypography],
    );

    return <style>{styles}</style>;
};

export default React.memo(AppInlineStyles);
