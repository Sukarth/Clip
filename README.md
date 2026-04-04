# Clip: Modern Windows Clipboard Manager

<div align="center">

![Clip Logo](assets/icon.ico)

**A fast, modern, and lightweight clipboard manager for Windows**

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](https://github.com/Sukarth/Clip/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)](https://github.com/Sukarth/Clip/releases)

[Download Latest](https://github.com/Sukarth/Clip/releases/latest) • [Report Bug](https://github.com/Sukarth/Clip/issues) • [Request Feature](https://github.com/Sukarth/Clip/issues)

</div>

---

## 🚀 What is Clip?

Clip is a powerful, modern clipboard manager for Windows built with Electron, React, and TypeScript. It revolutionizes how you work with your clipboard by providing instant access to your clipboard history, powerful search capabilities, and a beautiful, customizable interface.

### ✨ Key Highlights

- 🔥 **Lightning Fast** - Instant startup and smooth animations
- 🎨 **Modern UI** - Beautiful dark/light themes with customizable transparency
- 🔍 **Smart Search** - Find anything in your clipboard history instantly
- 📌 **Pin Important Items** - Keep frequently used content at your fingertips
- 🖼️ **Image Support** - Full support for text and images
- ⚡ **Global Hotkeys** - Access from anywhere with customizable shortcuts
- 💾 **Local Storage** - Your data stays on your device, completely private
- 🚀 **No Installation Required** - Portable version available

## 📥 Download & Installation

### 🎯 Latest Release Available Now!

**[Get it here...](https://github.com/Sukarth/Clip/releases/latest)**


### System Requirements

- **OS**: Windows 10 or later (x64)
- **RAM**: 100MB minimum, 200MB recommended
- **Storage**: 50MB + space for clipboard history
- **Permissions**: Standard user (no admin required)

## 🌟 Features

### Core Functionality
- **📋 Clipboard History** - Store up to 100 items (configurable)
- **🔍 Instant Search** - Fuzzy search through all clipboard content
- **📌 Pin Items** - Keep important content always accessible
- **🖼️ Image Support** - Full support for text and image clipboard content
- **💾 Local Storage** - SQLite database, no cloud dependency

### User Interface
- **🎨 Modern Design** - Clean, intuitive interface with smooth animations
- **🌙 Dark/Light Mode** - Automatic system theme detection + manual override
- **✨ Transparency** - Adjustable window transparency (95% default)
- **🎯 Customizable** - Adjust colors, border radius, and visual settings
- **⚡ Fast Loading** - Optimized for instant access

### Keyboard & Shortcuts
- **⌨️ Global Hotkey** - Default `Ctrl+Shift+V` (fully customizable)
- **🪟 Windows Key Support** - Native Windows key combinations
- **🚪 ESC to Close** - Quick escape to hide window
- **🔄 Focus Restoration** - Returns focus to previous window after pasting

### Advanced Features
- **🔄 Auto Backups** - Configurable automatic database backups
- **📤 Import/Export** - Full database backup and restore
- **🚀 Start with Windows** - Optional auto-start with system
- **🎯 System Tray** - Minimize to tray or hide completely
- **🔒 Single Instance** - Prevents multiple instances

## 🖼️ Screenshots

> Screenshots will be added in the next update

## 🚀 Quick Start

### For End Users

1. **Download** the latest release from [GitHub Releases](https://github.com/Sukarth/Clip/releases/latest)
2. **Extract** (portable) or **install** (installer version)
3. **Run** `Clip.exe`
4. **Press** `Ctrl+Shift+V` to open Clip anywhere
5. **Start copying** - your clipboard history will be automatically saved!

### For Developers

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Sukarth/Clip.git
   cd Clip
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development**:
   ```bash
   npm run start
   ```

4. **Build for production**:
   ```bash
   npm run dist
   ```

## ⚙️ Configuration

Clip offers extensive customization options accessible through the settings panel:

### Visual Settings
- **Theme**: Dark, Light, or System
- **Transparency**: 0-100% window transparency
- **Border Radius**: Customize window corner rounding
- **Accent Color**: Choose your preferred accent color

### Behavior Settings
- **Window Hide Behavior**: Hide completely or minimize to tray
- **Show in Taskbar**: Control taskbar visibility
- **Notifications**: Enable/disable clipboard notifications
- **Start with System**: Auto-start with Windows

### Backup Settings
- **Auto Backups**: Enable automatic database backups
- **Backup Interval**: 5 minutes to 1 day
- **Max Backups**: Control backup retention

## 🔧 Technical Details

### Built With
- **[Electron 25.9.0](https://electronjs.org/)** - Cross-platform desktop framework
- **[React 19.1.0](https://reactjs.org/)** - Modern UI library with hooks
- **[TypeScript](https://typescriptlang.org/)** - Type-safe JavaScript
- **[Better-SQLite3](https://github.com/WiseLibs/better-sqlite3)** - High-performance SQLite
- **[AutoHotkey](https://autohotkey.com/)** - Windows global hotkey integration

### Architecture
- **Main Process**: Electron main process handles system integration
- **Renderer Process**: React-based UI with TypeScript
- **Native Modules**: C++ modules for Windows API integration
- **Database**: SQLite with WAL mode for performance
- **IPC**: Secure inter-process communication between main and renderer

## 🤝 Contributing

We welcome contributions! We're actively looking for:

- 🐛 **Bug Reports** - Help us identify and fix issues
- 💡 **Feature Requests** - Suggest new features and improvements
- 📝 **Documentation** - Improve docs and guides
- 🧪 **Testing** - Test on different Windows configurations
- 💻 **Code Contributions** - Submit pull requests

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📋 Roadmap

### Current (v1.1.0)
- [x] Performance improvements
- [x] Color theme customization options

### Planned Features
- [ ] Cloud synchronization
- [ ] Advanced search filters and tags
- [ ] Clipboard templates and snippets
- [ ] Multi-monitor support improvements
- [ ] Linux and macOS support

## 🐛 Known Issues

- AutoHotkey integration may require Windows Defender exclusion
- Very large images (>50MB) may cause temporary UI lag
- Window focus restoration may not work with all applications

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ using modern web technologies
- Icons and design inspired by modern Windows design language
- Special thanks to the Electron and React communities

---

<div align="center">

**Made with ❤️ by [Sukarth](https://github.com/Sukarth)**

[⭐ Star this repo](https://github.com/Sukarth/Clip) if you find it useful!

</div>
