import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { logSecurityEvent } from './security';

export type AppRole = 'doctor' | 'staff' | 'superadmin' | 'owner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  profile: { id?: string; full_name: string; clinic_id?: string; role?: string; is_superadmin?: boolean; avatar_url?: string } | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getSafeStorageItem<T>(key: string, fallback: T): T {
  try {
    const saved = sessionStorage.getItem(key);
    if (!saved) return fallback;
    return JSON.parse(saved);
  } catch {
    return fallback;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>(() => getSafeStorageItem<AppRole[]>('app_roles', []));
  const [profile, setProfile] = useState<{ id?: string; full_name: string; clinic_id?: string; role?: string; is_superadmin?: boolean; avatar_url?: string } | null>(() => 
    getSafeStorageItem<{ id?: string; full_name: string; clinic_id?: string; role?: string; is_superadmin?: boolean; avatar_url?: string } | null>('user_profile', null)
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedId = useRef<string | null>(null);
  const isFetching = useRef(false);

  const fetchUserData = async (userId: string, force = false) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    if (isFetching.current && !force) return;

    if (userId === lastFetchedId.current && roles.length > 0 && !force) {
      setLoading(false);
      return;
    }

    isFetching.current = true;
    setLoading(true);
    setError(null);

    // Hard 6-second timeout promise to prevent infinite hanging
    const timeoutPromise = new Promise<{ isTimeout: true }>((resolve) => {
      setTimeout(() => resolve({ isTimeout: true }), 6000);
    });

    try {
      const fetchPromise = Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase.from('profiles').select('id, full_name, is_superadmin, clinic_id, role, avatar_url').eq('user_id', userId).maybeSingle(),
      ]);

      const raceResult = await Promise.race([fetchPromise, timeoutPromise]);

      if ('isTimeout' in raceResult) {
        console.warn('[Auth] Fetch user data timed out. Using fallback state.');
        if (roles.length === 0) {
          setError('Connection timed out. Please check your network.');
        }
        return;
      }

      const [rolesRes, profileRes] = raceResult;

      if (rolesRes.error) throw rolesRes.error;

      const rolesFromDB = (rolesRes.data || []).map(r => r.role as AppRole);
      const profileData = profileRes.data || null;
      const isSuper = !!profileData?.is_superadmin;
      
      let newRoles: AppRole[] = isSuper ? [...rolesFromDB, 'superadmin' as AppRole] : rolesFromDB;
      
      // Fallback: If user_roles table didn't have rows, check role on profile table
      if (newRoles.length === 0 && profileData?.role) {
        newRoles = [profileData.role as AppRole];
      }

      setRoles(newRoles);
      setProfile(profileData);

      // Security: Update last activity non-blockingly
      supabase.from('profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('user_id', userId)
        .then()
        .catch(() => {});

      try {
        sessionStorage.setItem('app_roles', JSON.stringify(newRoles));
        sessionStorage.setItem('user_profile', JSON.stringify(profileData));
      } catch {
        // Ignore storage write issues
      }

      lastFetchedId.current = userId;
    } catch (err: any) {
      console.error('[Auth] Error fetching user data:', err);
      if (roles.length === 0) {
        const isNetworkError = err.message?.includes('fetch') || err.message?.includes('Network') || !navigator.onLine;
        setError(isNetworkError ? 'Network Connection Issue' : err.message || 'Failed to connect');
      }
    } finally {
      isFetching.current = false;
      setLoading(false);
    }
  };

  const refresh = async () => {
    if (user) {
      lastFetchedId.current = null;
      await fetchUserData(user.id, true);
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    let timeoutId: NodeJS.Timeout;
    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => signOut(), 3600000); // 1 hour
    };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach(e => document.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(e => document.removeEventListener(e, resetTimer));
    };
  }, [user]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      // Global fallback safety timer (5s)
      const safetyTimer = setTimeout(() => {
        if (mounted) setLoading(false);
      }, 5000);

      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (mounted && initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          await fetchUserData(initialSession.user.id);
        } else if (mounted) {
          setLoading(false);
        }
      } catch (err) {
        console.warn('[Auth] Initial session error:', err);
        if (mounted) setLoading(false);
      } finally {
        clearTimeout(safetyTimer);
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (!mounted) return;
        setSession(currentSession);
        const currentUser = currentSession?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          if (event === 'SIGNED_IN') {
             logSecurityEvent('LOGIN_SUCCESS', { method: 'password' }, undefined, currentUser.id);
             fetchUserData(currentUser.id);
          } else if (event === 'TOKEN_REFRESHED') {
            fetchUserData(currentUser.id);
          }
        } else if (event === 'SIGNED_OUT') {
          logSecurityEvent('LOGOUT');
          setRoles([]);
          setProfile(null);
          setError(null);
          lastFetchedId.current = null;
          try {
            sessionStorage.clear();
          } catch {}
          setLoading(false);
        }
      });
      return subscription;
    };

    const subPromise = initAuth();
    return () => {
      mounted = false;
      subPromise.then(sub => sub?.unsubscribe()).catch(() => {});
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    
    // Check Rate Limit (DB call with 2s max timeout so slow DB never blocks user)
    try {
      const rateLimitPromise = supabase.rpc('check_rate_limit', {
        p_identifier: email,
        p_bucket: 'login',
        p_max_requests: 5,
        p_interval_seconds: 600
      });
      const timeoutPromise = new Promise<{ data: null, error: null }>((resolve) => setTimeout(() => resolve({ data: null, error: null }), 2000));
      const raceResult = await Promise.race([rateLimitPromise, timeoutPromise]);

      if (raceResult && (raceResult as any).data === false) {
        const limitErr = new Error('Too many login attempts. Please try again in 10 minutes.');
        logSecurityEvent('SUSPICIOUS_TRAFFIC', { reason: 'Brute Force Attempt Detected', email });
        setLoading(false);
        return { error: limitErr };
      }
    } catch {
      console.warn("Security rate-check bypassed to guarantee login access.");
    }

    try {
      const loginPromise = supabase.auth.signInWithPassword({ email, password });
      // 25s timeout to allow Supabase free tier cold starts to wake up cleanly
      const loginTimeout = new Promise<{ data: any, error: any }>((_, reject) => 
        setTimeout(() => reject(new Error('Supabase server is taking longer to respond (Cold Start). Please try again in 5 seconds.')), 25000)
      );

      const result = await Promise.race([loginPromise, loginTimeout]);
      if (result.error) {
        logSecurityEvent('LOGIN_FAILURE', { email });
      }
      return { error: result.error as Error | null };
    } catch (err: any) {
      console.error("[Auth] Login error:", err);
      return { error: err as Error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut().catch(() => {});
    } finally {
      setUser(null);
      setSession(null);
      setRoles([]);
      setProfile(null);
      setError(null);
      lastFetchedId.current = null;
      try {
        sessionStorage.clear();
        localStorage.removeItem('supabase.auth.token');
      } catch {}
      setLoading(false);
    }
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  return (
    <AuthContext.Provider value={{ user, session, roles, profile, loading, error, signIn, signOut, hasRole, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}