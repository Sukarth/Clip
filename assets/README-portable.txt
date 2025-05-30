Clip - Portable Clipboard Manager
=================================

This is the portable version of Clip. All data is stored locally in this folder.

How to use:
1. Extract the ZIP file to any folder on your computer
2. Run Clip.exe from the extracted folder
3. Your clipboard history will be saved in the "AppData" folder next to the executable

Features:
- No installation required
- All data stored locally (nothing saved to system folders)
- Can be run from USB drives or any removable media
- Complete clipboard history with image support
- Global hotkeys for quick access
- Pin important items
- Search functionality

Folder Structure:
📁 Clip-1.0.0-win/
├── 📄 Clip.exe                    (Main application)
├── 📁 resources/                  (Native components)
│   ├── 📄 AutoHotkey.exe
│   ├── 📄 SendPaste.exe
│   └── 📄 clipmsg.node
├── 📁 AppData/                    (Created automatically - your data)
│   ├── 📄 clip.db                 (Clipboard history database)
│   ├── 📄 clip-settings.json      (Your settings)
│   └── 📁 clip_backups/           (Automatic backups)
└── 📄 README.txt                  (This file)

The AppData folder will be created automatically when you first run the application.
This folder contains all your clipboard history and settings.

Note: Make sure you have write permissions to the folder where you extract Clip.
If you're running from a read-only location, the app will fall back to using
your system's AppData folder instead.