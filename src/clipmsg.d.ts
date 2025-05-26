// TypeScript declaration for the native clipmsg addon
// filepath: src/clipmsg.d.ts

interface ClipMsgAddon {
    hookWindow(
        hwndBuffer: Buffer,
        customMsg: number,
        callback: () => void
    ): boolean;
    getForegroundWindow(): number | Buffer | bigint;
}

declare const clipmsg: ClipMsgAddon;
export = clipmsg;
