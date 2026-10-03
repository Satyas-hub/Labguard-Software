import { NativeService } from './native';

type OnlineStatusListener = (isOnline: boolean) => void;
const onlineListeners: Set<OnlineStatusListener> = new Set();

export function subscribeOnlineStatus(listener: OnlineStatusListener): () => void {
  onlineListeners.add(listener);
  return () => onlineListeners.delete(listener);
}

function notifyOnlineStatus(isOnline: boolean): void {
  onlineListeners.forEach((fn) => {
    try {
      fn(isOnline);
    } catch (e) {
      console.warn('[ApiClient] Error in online status listener:', e);
    }
  });
}

export async function initServerConfig(): Promise<string> {
  if (typeof window !== 'undefined') {
    try {
      const nativeCfg = await NativeService.getServerConfig();
      if (nativeCfg && nativeCfg.server_url) {
        localStorage.setItem('LABGUARD_SERVER_URL', nativeCfg.server_url);
        return nativeCfg.server_url;
      }
    } catch {
      // Fallback to localStorage
    }
    const current = localStorage.getItem('LABGUARD_SERVER_URL');
    if (current && current.trim()) return current.trim();
  }
  return 'http://localhost:5000';
}

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('LABGUARD_SERVER_URL');
    if (custom && custom.trim()) {
      const clean = custom.trim().replace(/\/+$/, '');
      return clean.endsWith('/api') ? clean : `${clean}/api`;
    }
  }
  return 'http://localhost:5000/api';
}

export function getServerUrl(): string {
  return getApiBaseUrl().replace(/\/api\/?$/, '');
}

export function setServerUrl(url: string | null): void {
  if (typeof window !== 'undefined') {
    if (url && url.trim()) {
      const clean = url.trim().replace(/\/+$/, '');
      localStorage.setItem('LABGUARD_SERVER_URL', clean);
      NativeService.setServerConfig(clean).catch(() => {});
    } else {
      localStorage.removeItem('LABGUARD_SERVER_URL');
      NativeService.setServerConfig('http://localhost:5000').catch(() => {});
    }
  }
}

export class ApiClient {
  private static token: string | null = null;
  private static refreshToken: string | null = null;

  public static setTokens(accessToken: string | null, refreshToken?: string | null) {
    this.token = accessToken;
    if (accessToken) {
      sessionStorage.setItem('labguard_token', accessToken);
    } else {
      sessionStorage.removeItem('labguard_token');
    }

    if (refreshToken !== undefined) {
      this.refreshToken = refreshToken;
      if (refreshToken) {
        sessionStorage.setItem('labguard_refresh_token', refreshToken);
      } else {
        sessionStorage.removeItem('labguard_refresh_token');
      }
    }
  }

  public static setToken(token: string | null) {
    this.setTokens(token);
  }

  public static getToken(): string | null {
    if (!this.token) {
      this.token = sessionStorage.getItem('labguard_token');
    }
    return this.token;
  }

  public static getRefreshToken(): string | null {
    if (!this.refreshToken) {
      this.refreshToken = sessionStorage.getItem('labguard_refresh_token');
    }
    return this.refreshToken;
  }

  public static async refreshAccessToken(): Promise<boolean> {
    const refresh = this.getRefreshToken();
    if (!refresh) return false;

    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh })
      });
      const json = await res.json();
      if (res.ok && json.data?.accessToken) {
        this.setTokens(json.data.accessToken, json.data.refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public static async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<{ success: boolean; data?: T; error?: string; message?: string }> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const baseUrl = getApiBaseUrl();

    try {
      let res = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers
      });

      // Attempt automatic token refresh on 401 INVALID_TOKEN
      if (res.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${this.getToken()}`;
          res = await fetch(`${baseUrl}${endpoint}`, {
            ...options,
            headers
          });
        }
      }

      const json = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: json.error || `HTTP_${res.status}`,
          message: json.message || 'Request failed'
        };
      }
      notifyOnlineStatus(true);
      return json;
    } catch (err: any) {
      notifyOnlineStatus(false);
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: 'Unable to communicate with central LABGUARD server (Operating Offline)'
      };
    }
  }

  public static async checkHealth(timeoutMs: number = 3000): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${getServerUrl()}/health`, {
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timer);
      const isOk = res.ok;
      notifyOnlineStatus(isOk);
      return isOk;
    } catch {
      clearTimeout(timer);
      notifyOnlineStatus(false);
      return false;
    }
  }
}
