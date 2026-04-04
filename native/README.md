# Native Folder Reference

This folder contains the Windows-specific binaries and source files that make the app work on a real desktop. The checked-in binaries are here so packaged builds can run without compiling anything on the user's machine.

## Why Each File Exists

- `AutoHotkey.exe`
  - Handles the Windows-key hotkey path.
  - `src/main.ts` writes a temporary AHK script, starts this executable, and uses it to register the shortcut.
  - This file is shipped because the app needs a ready-to-run hotkey engine in portable and packaged installs.

- `SendPaste.exe`
  - Sends paste commands to the currently focused window in a way that works across common control types.
  - It is used by `sendPasteWithRetries()` in `src/main.ts` to paste into Edit, RichEdit, ComboBox, console, and fallback input targets.
  - This file is shipped because it is the last-mile paste helper for the native clipboard flow.

- `clipmsg.node`
  - Native Node addon built from `clipmsg.cpp`.
  - `src/main.ts` uses it only for two small OS-facing helpers:
    - `getForegroundWindow()` to remember the window that was active before paste.
    - `setForegroundWindow()` to restore focus after paste.
  - The addon is optional at runtime. The app guards the calls so Clip still starts if the addon is missing, but focus restore may be less reliable.

- `clipmsg.cpp`
  - Source for the addon above.
  - It also contains a `hookWindow` export, but the current app flow uses Electron's `hookWindowMessage` path instead, so `hookWindow` is effectively legacy support.

- `SendPaste.cpp`
  - Source for `SendPaste.exe`.
  - This is the file to edit if paste routing needs to change for a new control class or fallback behavior.

- `binding.gyp`
  - Build definition for `clipmsg.node`.
  - It tells the native build which source file to compile, which headers to use, and which addon flags are required.

- `build/`
  - Generated build output from the native addon build system.
  - This folder is useful for local inspection, but it is not the source of truth. The real inputs are `clipmsg.cpp` and `binding.gyp`.

## How The App Uses These Files

- `src/main.ts` loads `clipmsg.node` for foreground-window helpers and launches `SendPaste.exe` for paste delivery.
- `package.json` packages `native/AutoHotkey.exe`, `native/SendPaste.exe`, and `native/clipmsg.node` into the application bundle so end users do not need a compiler.
- `scripts/copy-clipmsg.js` copies the freshly built addon into `native/clipmsg.node` after the native rebuild step.

## Rebuild Workflow

### Prerequisites

- Node.js matching the project requirements.
- `npm install` run at the repository root so the addon headers are available.
- For `SendPaste.exe`, MSYS2 MinGW64 is a good fit on this machine.
- For `clipmsg.node`, use the Electron build path in this repo so the addon links against the correct Node/Electron ABI.

### Rebuild The Native Addon

1. From the repository root, run `npm run rebuild:native`.
   - This executes `electron-builder install-app-deps` and rebuilds native dependencies for the Electron runtime.
2. Then run `npm run build:main`.
   - This compiles the main-process TypeScript and copies the rebuilt addon into `native/clipmsg.node`.
3. If you want to inspect the intermediate artifact, check `native/build/Release/clipmsg.node` before the copy step.

### Rebuild `SendPaste.exe`

1. Open an MSYS2 MinGW64 shell.
2. Change into this folder.
3. Build with the MinGW compiler, for example:

```bash
g++ -std=c++17 -O2 -s -o SendPaste.temp.exe SendPaste.cpp -lshlwapi -luser32
```

4. When you are satisfied with the temp build, rename or copy it over `SendPaste.exe`.

### Make Source Edits Safely

- Edit `clipmsg.cpp` when the addon behavior needs to change.
- Edit `SendPaste.cpp` when paste dispatch behavior needs to change.
- Edit `binding.gyp` only when the addon build definition itself changes.
- Do not hand-edit `build/` files unless you are debugging a generated build artifact.

## Quick Functional Checks

1. Start Clip and paste a clipboard item.
   - Expected: `SendPaste.exe` handles the paste without opening a console window.
2. Use a Windows-key shortcut profile.
   - Expected: the hotkey starts Clip through the AutoHotkey helper.
3. Trigger a focus-restore flow after paste.
   - Expected: Clip should restore the previous foreground window when `clipmsg.node` is present.
4. Remove or rename `clipmsg.node` temporarily.
   - Expected: Clip should still start, but focus restoration may degrade instead of crashing.
