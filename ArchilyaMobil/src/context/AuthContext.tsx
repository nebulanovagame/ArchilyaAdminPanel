import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithCredential,
  signOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ensureUserProfileSecure } from '../services/entitlementService';
import { trackEvent } from '../services/analyticsService';
import { captureException } from '../services/errorTracking';
import { type AuthContextType, type UserProfile } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const mapUserData = (data: Record<string, unknown> | undefined, firebaseUser: User): UserProfile => {
    const baseName =
      (data?.name as string) ||
      (data?.displayName as string) ||
      firebaseUser.displayName ||
      firebaseUser.email?.split('@')?.[0] ||
      'Kullanici';

    return {
      ...(data || {}),
      name: baseName,
    } as UserProfile;
  };

  const ensureUserProfile = async (firebaseUser: User, extra: { name?: string } = {}) => {
    const userRef = doc(db, 'users', firebaseUser.uid);

    try {
      await ensureUserProfileSecure({
        email: firebaseUser.email || '',
        displayName: extra.name || firebaseUser.displayName || '',
      });
    } catch (error) {
      captureException(error instanceof Error ? error : new Error(String(error)), {
        scope: 'mobile_auth_ensure_profile_secure',
        uid: firebaseUser.uid,
      });
    }

    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return mapUserData(snap.data() as Record<string, unknown>, firebaseUser);
    }

    return mapUserData(
      {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        credits: 0,
        plan: 'free',
      },
      firebaseUser
    );
  };

  const refreshUserData = async (uid: string) => {
    if (!uid) return;
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      setUserData(mapUserData(userDoc.data() as Record<string, unknown>, auth.currentUser!));
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          setUser(currentUser);
          const profile = await ensureUserProfile(currentUser);
          setUserData(mapUserData(profile, currentUser));
        } else {
          setUser(null);
          setUserData(null);
        }
      } catch (error) {
        captureException(error instanceof Error ? error : new Error(String(error)), {
          scope: 'mobile_auth_state_change',
          uid: currentUser?.uid || '',
        });
        setUser(currentUser || null);
        setUserData(
          currentUser
            ? mapUserData(
                {
                  uid: currentUser.uid,
                  email: currentUser.email,
                  credits: 0,
                  plan: 'free',
                },
                currentUser
              )
            : null
        );
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string): Promise<UserCredential> => {
    const normalizedEmail = String(email || '').trim();
    const normalizedPassword = String(password || '');
    try {
      const result = await signInWithEmailAndPassword(auth, normalizedEmail, normalizedPassword);
      void trackEvent('login', { method: 'email' });
      return result;
    } catch (error) {
      captureException(error instanceof Error ? error : new Error(String(error)), { scope: 'mobile_auth_login' });
      throw error;
    }
  };

  const logout = () => signOut(auth);

  const signInWithGoogleToken = async ({ idToken, accessToken }: { idToken?: string; accessToken?: string } = {}): Promise<UserCredential> => {
    if (!idToken && !accessToken) {
      throw new Error('Google kimlik dogrulama verisi bulunamadi.');
    }

    try {
      const credential = GoogleAuthProvider.credential(idToken || null, accessToken || null);
      const result = await signInWithCredential(auth, credential);

      await ensureUserProfile(result.user, {
        name: result.user.displayName || result.user.email || undefined,
      });

      const isNewUser = result.user?.metadata?.creationTime === result.user?.metadata?.lastSignInTime;
      void trackEvent(isNewUser ? 'sign_up' : 'login', { method: 'google' });

      return result;
    } catch (error) {
      captureException(error instanceof Error ? error : new Error(String(error)), { scope: 'mobile_auth_google_signin' });
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string): Promise<UserCredential> => {
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      if (name?.trim()) {
        await updateProfile(res.user, { displayName: name.trim() });
      }
      await ensureUserProfile(res.user, { name: name?.trim() });
      void trackEvent('sign_up', { method: 'email' });
      return res;
    } catch (error) {
      captureException(error instanceof Error ? error : new Error(String(error)), { scope: 'mobile_auth_signup' });
      throw error;
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      captureException(error instanceof Error ? error : new Error(String(error)), { scope: 'mobile_auth_reset_password' });
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        loading,
        login,
        logout,
        register,
        signInWithGoogleToken,
        resetPassword,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
