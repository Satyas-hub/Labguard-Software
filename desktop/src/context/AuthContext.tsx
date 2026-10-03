// ============================================================================
// LABGUARD V2: Authentication & Dual-Mode State Context
// ============================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../../../shared/types';
import { ApiClient, initServerConfig, subscribeOnlineStatus } from '../services/api';
import { LocalDbService } from '../db/localDb';
import { NativeService, NativePcIdentity } from '../services/native';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  isOnline: boolean;
  pcIdentity: NativePcIdentity | null;
  login: (identifier: string, pass: string, targetRole: UserRole) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  requestShutdown: (sessionId: string) => Promise<string>;
  abortShutdown: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pcIdentity, setPcIdentity] = useState<NativePcIdentity | null>(null);

  useEffect(() => {
    // 1. Initialize native identity and server configuration from %ProgramData%
    initServerConfig().then(() => {
      ApiClient.checkHealth(3000).then((ok) => setIsOnline(ok));
    });

    NativeService.getPcIdentity().then((id) => setPcIdentity(id));

    // 2. Subscribe to API client online/offline status updates
    const unsubscribe = subscribeOnlineStatus((online) => {
      setIsOnline(online);
    });

    // 3. Listen to browser / Windows network adapter state changes
    const handleNetworkOnline = () => {
      ApiClient.checkHealth(3000).then((ok) => setIsOnline(ok));
    };
    const handleNetworkOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleNetworkOnline);
    window.addEventListener('offline', handleNetworkOffline);

    // 4. Periodic background health check (every 8 seconds)
    const interval = setInterval(() => {
      ApiClient.checkHealth(3000).then((ok) => setIsOnline(ok));
    }, 8000);

    // 5. Initialize local SQLite
    NativeService.initLocalDb();

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleNetworkOnline);
      window.removeEventListener('offline', handleNetworkOffline);
      clearInterval(interval);
    };
  }, []);

  const login = async (identifier: string, pass: string, targetRole: UserRole) => {
    // Try online login first
    const res = await ApiClient.request<{ accessToken: string; refreshToken?: string; user: User; offlineToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password: pass, role: targetRole })
    });

    if (res.success && res.data) {
      ApiClient.setTokens(res.data.accessToken, res.data.refreshToken);
      setUser(res.data.user);
      setRole(res.data.user.role);
      setIsOnline(true);

      // Cache verified credentials, password hash, and signed offline token into local SQLite
      LocalDbService.cacheOfflineUser(res.data.user, pass, res.data.offlineToken).catch((err) => {
        console.warn('[AuthContext] Failed to cache user into local SQLite:', err);
      });

      // Background pre-cache catalog into local SQLite
      Promise.all([
        ApiClient.request('/labs'),
        ApiClient.request('/computers'),
        ApiClient.request('/equipment')
      ]).then(([labsRes, compsRes, equipRes]) => {
        if (labsRes.success && compsRes.success && equipRes.success) {
          LocalDbService.cacheCatalog(labsRes.data || [], compsRes.data || [], equipRes.data || []).catch(console.warn);
        }
      }).catch(console.warn);

      return { success: true };
    }

    // Handle rate limiting / locked account
    if (res.error === 'TOO_MANY_ATTEMPTS') {
      return { success: false, message: res.message || 'Account sign-in temporarily throttled.' };
    }

    // If offline or network error, verify against local SQLite vaults
    if (!isOnline || res.error === 'NETWORK_ERROR') {
      setIsOnline(false);

      const verifyRes = await LocalDbService.verifyOfflineCredentials(identifier, pass, targetRole);
      if (verifyRes.success && verifyRes.user) {
        setUser(verifyRes.user);
        setRole(verifyRes.user.role);
        return { success: true, message: verifyRes.message };
      }

      return {
        success: false,
        message: verifyRes.message || 'Offline operation active. Cached authentication failed.'
      };
    }

    return { success: false, message: res.message || 'Invalid credentials or unassigned role' };
  };

  const logout = () => {
    ApiClient.setTokens(null, null);
    setUser(null);
    setRole(null);
  };

  const requestShutdown = async (sessionId: string) => {
    if (role !== 'STUDENT') {
      return 'Automatic shutdown is restricted to student sessions.';
    }
    return await NativeService.requestSafeShutdown('STUDENT', sessionId);
  };

  const abortShutdown = async () => {
    return await NativeService.abortShutdown();
  };

  return (
    <AuthContext.Provider value={{ user, role, isOnline, pcIdentity, login, logout, requestShutdown, abortShutdown }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
