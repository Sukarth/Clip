// Post-build script to copy the native addon to native/clipmsg.node and dist/native/clipmsg.node
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'native', 'build', 'Release', 'clipmsg.node');
const destDir1 = path.join(__dirname, '..', 'native');
const dest1 = path.join(destDir1, 'clipmsg.node');
const destDir2 = path.join(__dirname, '..', 'dist', 'native');
const dest2 = path.join(destDir2, 'clipmsg.node');

if (!fs.existsSync(src)) {
    console.error('clipmsg.node not found at', src);
    process.exit(1);
}

// Copy to native directory
fs.mkdirSync(destDir1, { recursive: true });
fs.copyFileSync(src, dest1);
console.log('Copied', src, 'to', dest1);

// Copy to dist/native directory
fs.mkdirSync(destDir2, { recursive: true });
fs.copyFileSync(src, dest2);
console.log('Copied', src, 'to', dest2);
