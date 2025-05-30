# Clip - Build Instructions

## Building for Production

### Prerequisites
- Node.js 18+ installed
- Windows environment (for Windows builds)

### Build Commands

#### 1. Build Both Installer and Portable Version
```bash
npm run dist
```
This creates both:
- `release/Clip Setup 1.0.0.exe` - Traditional installer
- `release/Clip-1.0.0-portable.exe` - Single portable executable

#### 2. Build Only Portable Version
```bash
npm run dist:standalone
```
Creates only the portable single-file executable.

#### 3. Build Only Installer
```bash
npm run dist:portable
```
Creates only the traditional installer.

### Output Files

All build outputs will be placed in the `release/` directory:

- **Clip-1.0.0-portable.exe** - Single executable file (no installation required)
- **Clip Setup 1.0.0.exe** - Traditional installer
- **latest.yml** - Update metadata

### Portable Version Features

The portable version:
- ✅ Runs without installation
- ✅ Runs without admin rights (`requestedExecutionLevel: asInvoker`)
- ✅ Self-contained (all dependencies included)
- ✅ Can be run from USB drives
- ✅ Stores data in user directory (not requiring write access to program folder)

### File Structure

The build includes all necessary files:
- Main application code
- Native modules (clipmsg.node, SendPaste.exe)
- AutoHotkey executable for global shortcuts
- Application icons
- Required assets

### Distribution

For beta distribution, you can share either:
1. **Clip-1.0.0-portable.exe** - Single file, easiest to distribute
2. **Clip Setup 1.0.0.exe** - Traditional installer for end users who prefer installation

### Build Troubleshooting

If you encounter issues:
1. Clear the `dist/` folder: `rm -rf dist/`
2. Clear node_modules: `rm -rf node_modules/ && npm install`
3. Rebuild native modules: `npm run build:main`
4. Try building again: `npm run dist`