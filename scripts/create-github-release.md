# GitHub Release Creation Guide

This guide will help you create the GitHub release for Clip v1.0.0-beta.

## Prerequisites

1. **Repository Setup**: Make sure you have a GitHub repository created
2. **Built Files**: Run the release preparation script first
3. **Git Remote**: Ensure your local repository is connected to GitHub

## Step-by-Step Release Process

### 1. Push to GitHub

First, make sure all changes are pushed to GitHub:

```bash
# Add remote if not already added
git remote add origin https://github.com/Sukarth/Clip.git

# Push the Dev branch
git push -u origin Dev

# Create and push main branch from Dev
git checkout -b main
git push -u origin main
```

### 2. Build Release Files

Run the release preparation script:

```bash
node scripts/prepare-release.js
```

This will create the distribution files in the `dist/` directory.

### 3. Create GitHub Release

1. **Go to GitHub Repository**
   - Navigate to https://github.com/Sukarth/Clip
   - Click on "Releases" in the right sidebar
   - Click "Create a new release"

2. **Release Configuration**
   - **Tag version**: `v1.0.0-beta`
   - **Release title**: `Clip v1.0.0-beta - First Beta Release 🎉`
   - **Target branch**: `main`

3. **Release Description**
   - Copy the content from `.github/RELEASE_TEMPLATE.md`
   - Update any placeholder information (file sizes, etc.)

4. **Upload Files**
   Upload these files from the `dist/` directory:
   - `Clip Setup 1.0.0-beta.exe` (Installer)
   - `Clip 1.0.0-beta.exe` (Portable) 
   - `latest.yml` (Update metadata)

5. **Release Options**
   - ✅ Check "This is a pre-release" (since it's beta)
   - ✅ Check "Create a discussion for this release"

6. **Publish Release**
   - Click "Publish release"

### 4. Post-Release Tasks

1. **Update README Links**
   - Verify download links work correctly
   - Update any version references

2. **Announce Release**
   - Share on relevant communities
   - Update any documentation

3. **Monitor Feedback**
   - Watch for issues and bug reports
   - Respond to user feedback

## Release Checklist

- [ ] All code changes committed and pushed
- [ ] Version updated to 1.0.0-beta in package.json
- [ ] CHANGELOG.md updated with all features
- [ ] README.md updated with beta information
- [ ] LICENSE file added
- [ ] CONTRIBUTING.md created
- [ ] GitHub issue templates created
- [ ] Release files built and tested
- [ ] GitHub release created with proper tag
- [ ] Files uploaded to release
- [ ] Release marked as pre-release
- [ ] Download links verified

## File Naming Convention

The built files should follow this naming pattern:
- **Installer**: `Clip Setup 1.0.0-beta.exe`
- **Portable**: `Clip 1.0.0-beta.exe`
- **Metadata**: `latest.yml`

## Troubleshooting

### Build Issues
- Ensure all dependencies are installed: `npm install`
- Clear dist folder and rebuild: `npm run build:all`
- Check for native module compilation errors

### GitHub Issues
- Verify repository permissions
- Check if remote is correctly configured
- Ensure you have push access to the repository

### File Upload Issues
- Check file sizes (GitHub has limits)
- Verify file names match expected patterns
- Ensure files are not corrupted

## Next Steps After Beta

1. **Collect Feedback**: Monitor issues and discussions
2. **Bug Fixes**: Address critical issues found in beta
3. **Feature Refinements**: Improve based on user feedback
4. **Stable Release**: Plan for v1.0.0 stable release

---

**Note**: This is a beta release. Encourage users to provide feedback and report issues!
