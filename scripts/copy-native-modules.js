// Post-build script to copy both SendPaste.exe and clipmsg.node to the correct locations
const fs = require('fs');
const path = require('path');

// Copy clipmsg.node
const clipmsgSrc = path.join(__dirname, '..', 'native', 'build', 'Release', 'clipmsg.node');
const clipmsgDest = path.join(__dirname, '..', 'native', 'clipmsg.node');

if (fs.existsSync(clipmsgSrc)) {
    fs.copyFileSync(clipmsgSrc, clipmsgDest);
    console.log('Copied', clipmsgSrc, 'to', clipmsgDest);
} else {
    console.log('clipmsg.node source file not found at', clipmsgSrc);
}

// No need to copy SendPaste.exe - it's already in native/ directory and 
// is included in the build via package.json "files" section
console.log('SendPaste.exe already in native/ directory and included in packaging');
