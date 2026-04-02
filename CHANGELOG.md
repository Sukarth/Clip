# Changelog

All notable changes to Clip will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-03-30

### 🎨 Theming & Customization

#### JSON Theme System
- **Theme Configuration Files**: Full support for JSON-based theme profiles with proper validation
- **JSON Schema Support**: Comprehensive JSON Schema (draft 2020-12) for theme configuration with IntelliSense
- **Theme File APIs**: IPC methods to access theme and settings file paths and open them in external editors
- **Reload on Disk Changes**: Ability to reload theme and settings configuration from disk without restart

#### Visual Enhancements
- **Draggable Window**: Make window draggable by the title bar or any custom drag handle
- **Window Size Controls**: Add min/max window size constraints and user-resizable window bounds
- **Theme Profiles**: Support for multiple theme profiles that users can switch between

### ⚡ Performance Improvements

#### Build & Runtime Optimization
- **Vite Migration**: Migrated renderer build system from Webpack to Vite for significantly faster builds
- **Optimized Polling**: Reduced CPU usage by optimizing clipboard polling intervals and efficiency
- **Virtual Scroller Fixes**: Resolved useVirtualizer cache staleness issues that caused rendering glitches and spacing problems

### 🐛 Bug Fixes

#### Window & Focus Management
- **Win+V Reliability**: Fixed Win+V keyboard shortcut to reliably show the window even in edge cases
- **Focus Restoration**: Improved automatic focus restoration after pasting operations

- Also Solved [#1](https://github.com/Sukarth/Clip/issues/1) and [#2](https://github.com/Sukarth/Clip/issues/2)

### ♻️ Code Refactoring & Architecture

#### Component Modularization
- **App.tsx Refactor**: Split monolithic App.tsx into focused, reusable components for better maintainability:
  - `ClipboardList.tsx`: Clipboard history display with virtualization
  - `AppDialogs.tsx`: Dialog management and modal components
  - `SettingsGeneralSection.tsx`: General application settings
  - `SettingsBehaviorSection.tsx`: Behavior and interaction settings
  - `SettingsThemeSection.tsx`: Theme configuration and color customization
  - `SettingsDataSection.tsx`: Data management and cache settings
  - `SettingsBackupsSection.tsx`: Backup and restore functionality
  - `SettingsModalFooter.tsx`: Settings modal footer controls
  - `ColorSettingField.tsx`: Reusable color picker component
  - `IconGlyph.tsx`: Icon rendering utilities
  - `ToastContainer.tsx`: Toast notification system
  - `Switch.tsx`: Reusable toggle switch component
  - `AppInlineStyles.tsx`: Inline style management

#### Custom Hooks
- **useThemeConfigManager**: Manages theme configuration state and persistence
- **useToastManager**: Handles toast notifications and message queuing
- **useShortcutDraft**: Manages keyboard shortcut input and validation during configuration

### 📦 Dependencies

- **Upgraded Dependencies**: Updated all major dependencies for improved stability and compatibility
- **Build Tools**: Updated build tools and development dependencies

### 🏢 Technical Improvements

- **Type Safety**: Enhanced TypeScript type definitions and global type utilities
- **HTML Structure**: Optimized HTML structure and meta tags for better compatibility
- **Configuration**: Added centralized app constants and type definitions for cross-module consistency

## [1.0.0-beta] - 2025-05-30

### 🎉 Initial Beta Release

This is the first public beta release of Clip, a modern Windows clipboard manager built with Electron, React, and TypeScript.

### ✨ Features

#### Core Functionality
- **Clipboard History**: Store up to 100 clipboard items (configurable)
- **Text & Image Support**: Full support for both text and image clipboard content
- **Fast Search**: Instant search through clipboard history with fuzzy matching
- **Pin Items**: Pin important clipboard items to keep them at the top
- **Local Storage**: All data stored locally with SQLite database

#### User Interface
- **Modern Design**: Clean, modern UI with rounded corners and smooth animations
- **Dark/Light Mode**: Automatic system theme detection with manual override
- **Transparency**: Adjustable window transparency (95% default)
- **Customizable**: Adjustable border radius, accent colors, and visual settings
- **Responsive**: Optimized for fast loading and smooth interactions

#### Keyboard & Shortcuts
- **Global Hotkey**: Default Ctrl+Shift+V to open (fully customizable)
- **Windows Key Support**: Native Windows key combinations via AutoHotkey integration
- **ESC to Close**: Quick escape key to hide the window
- **Focus Restoration**: Automatically restores focus to previous window after pasting

#### Window Management
- **Hide Mode**: Window disappears completely when closed
- **System Tray Mode**: Minimize to system tray with context menu
- **Taskbar Control**: Show/hide in taskbar (configurable)
- **Always on Top**: Temporary always-on-top when activated
- **Single Instance**: Prevents multiple instances from running

#### Data Management
- **Automatic Backups**: Configurable automatic database backups (5min to 1 day intervals)
- **Manual Backup/Restore**: Create and restore backups manually
- **Import/Export**: Full database import/export functionality
- **Data Persistence**: Reliable data storage with WAL mode SQLite

#### System Integration
- **Start with Windows**: Optional auto-start with system boot
- **Portable Mode**: Runs without installation, stores data locally
- **No Admin Rights**: Runs with standard user permissions
- **Native Performance**: C++ native modules for optimal clipboard monitoring

#### Settings & Customization
- **Comprehensive Settings**: Full settings panel with live preview
- **Visual Customization**: Border radius, transparency, accent colors
- **Behavior Options**: Window hide behavior, notifications, taskbar presence
- **Backup Configuration**: Automatic backup intervals and retention
- **Shortcut Customization**: Full keyboard shortcut customization

### 🔧 Technical Details

#### Architecture
- **Electron 25.9.0**: Modern Electron framework for cross-platform desktop apps
- **React 19.1.0**: Latest React with modern hooks and performance optimizations
- **TypeScript**: Full TypeScript support for type safety
- **Better-SQLite3**: High-performance SQLite database integration
- **Native Modules**: Custom C++ modules for Windows API integration

#### Performance Optimizations
- **Caching System**: Intelligent caching for clipboard history (3-second cache)
- **Lazy Loading**: Deferred loading of non-critical components
- **Memory Management**: Efficient memory usage with cleanup routines
- **Background Processing**: Non-blocking database operations

#### Security & Privacy
- **Local Only**: No cloud storage, all data stays on your device
- **No Telemetry**: No data collection or tracking
- **Secure Storage**: Encrypted local database storage
- **Permission Minimal**: Minimal system permissions required

### 📦 Distribution

#### Available Formats
- **Portable Executable**: Single .exe file, no installation required
- **NSIS Installer**: Traditional Windows installer with uninstaller
- **ZIP Archive**: Portable version in ZIP format

#### System Requirements
- **OS**: Windows 10 or later (x64)
- **RAM**: 100MB minimum, 200MB recommended
- **Storage**: 50MB for application, additional space for clipboard history
- **Permissions**: Standard user permissions (no admin required)

### 🐛 Known Issues

- AutoHotkey integration may require Windows Defender exclusion for some antivirus software
- Very large images (>50MB) may cause temporary UI lag during processing
- Window focus restoration may not work perfectly with all applications

### 🔮 Planned Features

- Cloud synchronization (optional)
- Plugin system for custom clipboard processors
- Advanced search filters and tags
- Clipboard templates and snippets
- Multi-monitor support improvements
- Linux and macOS support

### 📝 Notes

This beta release is feature-complete and stable for daily use. We're looking for feedback on:
- Performance in various Windows environments
- Compatibility with different applications
- User interface and experience improvements
- Feature requests and suggestions

Please report any issues or feedback through GitHub Issues.

---

**Full Changelog**: https://github.com/Sukarth/Clip/commits/v1.0.0-beta
