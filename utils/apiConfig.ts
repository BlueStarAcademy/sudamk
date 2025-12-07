/**
 * API URL configuration for separated frontend/backend deployment
 * 
 * In development: Uses relative paths (proxied by Vite)
 * In production: Uses environment variables or defaults to relative paths
 */

// Get API base URL from environment variable
// Vite exposes env variables prefixed with VITE_
const getApiBaseUrl = (): string => {
    // In development, use relative paths (Vite proxy handles it)
    if (import.meta.env.DEV) {
        return '';
    }
    
    // In production, use environment variable if set
    const apiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL;
    if (apiUrl) {
        // Remove trailing slash
        return apiUrl.replace(/\/$/, '');
    }
    
    // Fallback to relative path (same origin)
    return '';
};

// Get WebSocket URL from environment variable
const getWebSocketUrl = (): string => {
    // In development, use relative paths
    if (import.meta.env.DEV) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}`;
    }
    
    // In production, use environment variable if set
    const wsUrl = import.meta.env.VITE_WS_URL || import.meta.env.VITE_BACKEND_WS_URL;
    if (wsUrl) {
        return wsUrl;
    }
    
    // Fallback: derive from API URL or use same origin
    const apiUrl = getApiBaseUrl();
    if (apiUrl) {
        const protocol = apiUrl.startsWith('https') ? 'wss:' : 'ws:';
        const host = apiUrl.replace(/^https?:\/\//, '');
        return `${protocol}//${host}`;
    }
    
    // Fallback to same origin
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
};

export const API_BASE_URL = getApiBaseUrl();
export const WS_URL = getWebSocketUrl();

/**
 * Get full API URL for a given endpoint
 * @param endpoint - API endpoint (e.g., '/api/action')
 * @returns Full URL
 */
export const getApiUrl = (endpoint: string): string => {
    const base = API_BASE_URL;
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${base}${path}`;
};

/**
 * Get full WebSocket URL for a given endpoint
 * @param endpoint - WebSocket endpoint (e.g., '/ws')
 * @returns Full WebSocket URL
 */
export const getWebSocketUrlFor = (endpoint: string): string => {
    const base = WS_URL;
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${base}${path}`;
};

