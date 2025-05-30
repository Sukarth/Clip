# Contributing to Clip

Thank you for your interest in contributing to Clip! This document provides guidelines and information for contributors.

## 🎯 Beta Testing

As this is a beta release, we're particularly interested in:

### 🐛 Bug Reports
- Performance issues on different Windows versions
- Compatibility problems with specific applications
- UI/UX issues or unexpected behavior
- Memory leaks or resource usage problems
- AutoHotkey integration issues

### 💡 Feature Requests
- Workflow improvements
- New clipboard processing features
- UI/UX enhancements
- Integration with other tools
- Accessibility improvements

### 🧪 Testing Scenarios
- Different Windows versions (Windows 10, 11)
- Various screen resolutions and DPI settings
- Different antivirus software configurations
- Heavy clipboard usage scenarios
- Long-running stability tests

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- Windows 10/11 (for testing)
- Git
- Visual Studio Build Tools (for native modules)

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Clip.git
   cd Clip
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Development**
   ```bash
   npm run start
   ```

4. **Build for Testing**
   ```bash
   npm run build:all
   npm run test:build
   ```

### Project Structure
```
Clip/
├── src/
│   ├── main.ts              # Electron main process
│   ├── preload.js           # Preload script
│   ├── logger.ts            # Logging utilities
│   └── renderer/            # React UI components
│       ├── App.tsx          # Main React component
│       ├── ThemeProvider.tsx # Theme management
│       └── index.tsx        # React entry point
├── native/                  # C++ native modules
│   ├── clipmsg.cpp          # Windows API integration
│   ├── SendPaste.exe        # Paste utility
│   └── AutoHotkey.exe       # Global hotkey support
├── assets/                  # Icons and resources
├── dist/                    # Build output
└── scripts/                 # Build scripts
```

## 📝 How to Contribute

### Reporting Issues

1. **Check Existing Issues** - Search for similar issues first
2. **Use Issue Templates** - Follow the provided templates
3. **Provide Details** - Include:
   - Windows version and build
   - Clip version
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots/videos if applicable
   - Error logs (check `%LOCALAPPDATA%/clip-main-error.log`)

### Submitting Pull Requests

1. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Follow existing code style
   - Add comments for complex logic
   - Update documentation if needed

3. **Test Thoroughly**
   ```bash
   npm run build:all
   npm run test:build
   ```

4. **Commit with Clear Messages**
   ```bash
   git commit -m "feat: add new clipboard filter feature"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Code Style Guidelines

#### TypeScript/JavaScript
- Use TypeScript for all new code
- Follow existing naming conventions
- Use 4 spaces for indentation
- Add JSDoc comments for public functions
- Prefer `const` over `let` where possible

#### React Components
- Use functional components with hooks
- Keep components focused and small
- Use meaningful prop names
- Handle loading and error states

#### Electron Main Process
- Handle errors gracefully
- Use async/await for asynchronous operations
- Log important events for debugging
- Clean up resources properly

## 🔧 Development Guidelines

### Performance Considerations
- Minimize main thread blocking
- Use caching for expensive operations
- Optimize database queries
- Handle large clipboard items efficiently

### Security Best Practices
- Validate all user inputs
- Use secure IPC communication
- Minimize native module usage
- Handle sensitive data carefully

### Testing
- Test on multiple Windows versions
- Verify memory usage over time
- Test with various clipboard content types
- Ensure proper cleanup on exit

## 📋 Issue Labels

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Improvements to docs
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `beta-feedback` - Beta testing feedback
- `performance` - Performance related
- `ui/ux` - User interface/experience

## 🎉 Recognition

Contributors will be recognized in:
- README.md acknowledgments
- Release notes
- GitHub contributors page

## 📞 Getting Help

- **GitHub Issues** - For bugs and feature requests
- **GitHub Discussions** - For questions and general discussion
- **Email** - sukarthacharya@gmail.com for private matters

## 📄 License

By contributing to Clip, you agree that your contributions will be licensed under the MIT License.

---

Thank you for helping make Clip better! 🚀
