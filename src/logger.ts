/**
 * Smart logging utility that automatically detects development vs production mode
 * and enables/disables logging accordingly.
 */

// Development detection logic
const isDevelopment = (): boolean => {
    // Method 1: Check if running via electron . (process.defaultApp exists)
    if (typeof process !== 'undefined' && process.defaultApp) {
        return true;
    }
    
    // Method 2: Check NODE_ENV
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
        return true;
    }
    
    // Method 3: Check if running from source (common development indicators)
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
        // In development, we're often running from file:// protocol
        const path = window.location.pathname;
        if (path.includes('src/') || path.includes('dist/') || path.includes('build/')) {
            return true;
        }
    }
    
    // Method 4: Check if devtools are available (more reliable for renderer process)
    if (typeof window !== 'undefined' && (window.electronAPI as any)?.isDevelopment) {
        return (window.electronAPI as any).isDevelopment();
    }
    
    // Method 5: Check for common development indicators
    if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')) {
        // Check if we're in a development build by looking for common dev patterns
        const isDev = !!(
            window.location.href.includes('localhost') ||
            window.location.href.includes('127.0.0.1') ||
            window.location.href.includes('file://')
        );
        return isDev;
    }
    
    // Default to production for safety
    return false;
};

// Cache the development status to avoid repeated checks
const DEV_MODE = isDevelopment();

// Logging levels
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}

// Configuration
const CONFIG = {
    enabled: DEV_MODE,
    level: DEV_MODE ? LogLevel.DEBUG : LogLevel.NONE,
    prefix: '[Clip]',
    timestamp: true,
    colors: {
        debug: '#888',
        info: '#2196F3',
        warn: '#FF9800',
        error: '#F44336',
        cache: '#9C27B0',
        scrollbar: '#4CAF50'
    }
};

// Enhanced logger class
class Logger {
    private enabled: boolean;
    private level: LogLevel;
    private prefix: string;
    private timestamp: boolean;
    private colors: Record<string, string>;

    constructor(config: typeof CONFIG) {
        this.enabled = config.enabled;
        this.level = config.level;
        this.prefix = config.prefix;
        this.timestamp = config.timestamp;
        this.colors = config.colors;
    }

    private shouldLog(level: LogLevel): boolean {
        return this.enabled && level >= this.level;
    }

    private formatMessage(level: string, category: string, message: string, ...args: any[]): any[] {
        const parts = [];
        
        if (this.timestamp) {
            const now = new Date();
            const time = now.toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
            parts.push(`%c${time}`);
        }
        
        parts.push(`%c${this.prefix}`);
        
        if (category) {
            parts.push(`%c[${category}]`);
        }
        
        parts.push(`%c${message}`);
        
        const styles = [
            'color: #666; font-size: 11px;', // timestamp
            'color: #999; font-weight: bold;', // prefix
            `color: ${this.colors[category.toLowerCase()] || this.colors.info}; font-weight: bold;`, // category
            `color: ${this.colors[level.toLowerCase()] || '#fff'};` // message
        ];
        
        return [parts.join(' '), ...styles, ...args];
    }

    debug(category: string, message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.log(...this.formatMessage('debug', category, message, ...args));
        }
    }

    info(category: string, message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.INFO)) {
            console.info(...this.formatMessage('info', category, message, ...args));
        }
    }

    warn(category: string, message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(...this.formatMessage('warn', category, message, ...args));
        }
    }

    error(category: string, message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.ERROR)) {
            console.error(...this.formatMessage('error', category, message, ...args));
        }
    }

    // Specialized logging methods for different categories
    cache(message: string, ...args: any[]): void {
        this.debug('cache', message, ...args);
    }

    scrollbar(message: string, ...args: any[]): void {
        this.debug('scrollbar', message, ...args);
    }

    renderer(message: string, ...args: any[]): void {
        this.debug('renderer', message, ...args);
    }

    ui(message: string, ...args: any[]): void {
        this.debug('ui', message, ...args);
    }

    // Status information
    getStatus(): { enabled: boolean; level: string; isDevelopment: boolean } {
        return {
            enabled: this.enabled,
            level: LogLevel[this.level],
            isDevelopment: DEV_MODE
        };
    }

    // Manual override methods (for testing/debugging)
    enable(): void {
        this.enabled = true;
    }

    disable(): void {
        this.enabled = false;
    }

    setLevel(level: LogLevel): void {
        this.level = level;
    }
}

// Create and export the logger instance
export const logger = new Logger(CONFIG);

// Export convenience functions that match your current logging patterns
export const log = {
    // Cache operations
    cache: (message: string, ...args: any[]) => logger.cache(message, ...args),
    
    // Scrollbar operations  
    scrollbar: (message: string, ...args: any[]) => logger.scrollbar(message, ...args),
    
    // Renderer operations
    renderer: (message: string, ...args: any[]) => logger.renderer(message, ...args),
    
    // UI operations
    ui: (message: string, ...args: any[]) => logger.ui(message, ...args),
    
    // General logging
    debug: (category: string, message: string, ...args: any[]) => logger.debug(category, message, ...args),
    info: (category: string, message: string, ...args: any[]) => logger.info(category, message, ...args),
    warn: (category: string, message: string, ...args: any[]) => logger.warn(category, message, ...args),
    error: (category: string, message: string, ...args: any[]) => logger.error(category, message, ...args),
};

// Development status check
export const isDev = () => DEV_MODE;

// Export the logger instance for advanced usage
export default logger;

// Show initialization status in development
if (DEV_MODE) {
    console.log(
        '%c[Clip] %cLogger initialized',
        'color: #999; font-weight: bold;',
        'color: #4CAF50;',
        { 
            development: DEV_MODE, 
            enabled: CONFIG.enabled, 
            level: LogLevel[CONFIG.level] 
        }
    );
} else {
    // In production, completely silence the logger
    Object.keys(console).forEach(method => {
        if (typeof (console as any)[method] === 'function') {
            const original = (console as any)[method];
            (console as any)[method] = (...args: any[]) => {
                // Only allow critical errors through in production
                if (method === 'error' && args.some(arg => 
                    typeof arg === 'string' && arg.includes('[Critical]')
                )) {
                    original.apply(console, args);
                }
                // Otherwise, suppress all logging
            };
        }
    });
}