const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Preparing Clip for Beta Release...\n');

// Check if we're in the right directory
if (!fs.existsSync('package.json')) {
    console.error('❌ Error: package.json not found. Please run this script from the project root.');
    process.exit(1);
}

// Read package.json to get version
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;

console.log(`📦 Version: ${version}`);

// Clean previous builds
console.log('🧹 Cleaning previous builds...');
try {
    if (fs.existsSync('dist')) {
        execSync('rmdir /s /q dist', { stdio: 'inherit', shell: true });
    }
    console.log('✅ Cleaned dist directory');
} catch (error) {
    console.log('⚠️  Could not clean dist directory (may not exist)');
}

// Install dependencies
console.log('📥 Installing dependencies...');
try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed');
} catch (error) {
    console.error('❌ Failed to install dependencies');
    process.exit(1);
}

// Build the application
console.log('🔨 Building application...');
try {
    execSync('npm run build:all', { stdio: 'inherit' });
    console.log('✅ Application built successfully');
} catch (error) {
    console.error('❌ Failed to build application');
    process.exit(1);
}

// Create distribution packages
console.log('📦 Creating distribution packages...');
try {
    execSync('npm run dist:both', { stdio: 'inherit' });
    console.log('✅ Distribution packages created');
} catch (error) {
    console.error('❌ Failed to create distribution packages');
    process.exit(1);
}

// List created files
console.log('\n📋 Release files created:');
const distDir = 'dist';
if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir).filter(file => {
        return file.endsWith('.exe') || file.endsWith('.zip') || file.endsWith('.yml');
    });
    
    files.forEach(file => {
        const filePath = path.join(distDir, file);
        const stats = fs.statSync(filePath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`  📄 ${file} (${sizeInMB} MB)`);
    });
}

console.log('\n🎉 Release preparation complete!');
console.log('\n📝 Next steps:');
console.log('1. Test the built executables');
console.log('2. Commit all changes to git');
console.log('3. Create a GitHub release with tag v' + version);
console.log('4. Upload the distribution files to the release');
console.log('\n🔗 Files to upload to GitHub release:');
console.log('  - Clip Setup ' + version + '.exe (Installer)');
console.log('  - Clip ' + version + '.exe (Portable)');
console.log('  - latest.yml (Update metadata)');
