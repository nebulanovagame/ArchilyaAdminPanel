import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useNavigationContainerRef, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import 'react-native-reanimated';
import '../src/i18n';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { useProjectUploadQueue } from '../src/hooks/useProjectUploadQueue';
import OfflineIndicator from '../src/components/OfflineIndicator';
import { initializeAnalytics, trackEvent, trackPageView } from '../src/services/analyticsService';
import {
  captureException,
  clearUserContext,
  initErrorTracking,
  registerNavigationContainer,
  Sentry,
  setRouteContext,
  setUserContext,
} from '../src/services/errorTracking';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
void SplashScreen.preventAutoHideAsync().catch((error) => {
  captureException(error, { scope: 'mobile_root_splash_prepare' });
});

function InitialLayout() {
  const { user, userData, loading } = useAuth();
  const { pushError, lastNotificationResponse } = usePushNotifications();
  const segments = useSegments();
  const router = useRouter();
  const navigationRef = useNavigationContainerRef();
  const lastTrackedPathRef = useRef('');
  const isNavigatingRef = useRef(false);

  useProjectUploadQueue();

  const buildAnalyticsPath = () => {
    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';

    if (!loading) {
      if (!user && !inAuthGroup) {
        return '';
      }

      if (user && inAuthGroup) {
        return '';
      }
    }

    const normalized = segments.filter((segment) => segment && !/^\(.*\)$/.test(segment));
    const normalizedPath = normalized.join('/');

    if (inTabsGroup) {
      if (!normalizedPath || normalizedPath === 'index') {
        return '/dashboard';
      }

      return `/dashboard/${normalizedPath}`;
    }

    if (inAuthGroup) {
      return normalizedPath ? `/${normalizedPath}` : '/giris';
    }

    if (!normalizedPath) {
      return '/';
    }

    return `/${normalizedPath}`;
  };

  useEffect(() => {
    if (loading) return;
    const path = buildAnalyticsPath();
    if (!path) return;
    if (lastTrackedPathRef.current === path) return;
    lastTrackedPathRef.current = path;
    void trackPageView(path);
  }, [loading, segments, user]);

  useEffect(() => {
    registerNavigationContainer(navigationRef);
  }, [navigationRef]);

  useEffect(() => {
    if (user?.uid || user?.email) {
      setUserContext({
        id: user?.uid,
        email: user?.email,
        username: userData?.name || user?.displayName,
        name: userData?.name || user?.displayName,
      });
      return;
    }

    clearUserContext();
  }, [user?.uid, user?.email, user?.displayName, userData?.name]);

  useEffect(() => {
    setRouteContext({
      path: buildAnalyticsPath(),
      segments: Array.isArray(segments) ? segments : [],
      params: {
        authenticated: Boolean(user),
      },
    });
  }, [loading, segments, user]);

  useEffect(() => {
    if (loading) return;
    if (isNavigatingRef.current) return;

    const inAuthGroup = segments[0] === '(auth)';

    try {
      if (!user && !inAuthGroup) {
        isNavigatingRef.current = true;
        router.replace('/(auth)/login');
      } else if (user && inAuthGroup) {
        isNavigatingRef.current = true;
        router.replace('/(tabs)');
      }
    } catch (error) {
      captureException(error, {
        scope: 'mobile_root_auth_redirect',
        authenticated: Boolean(user),
      });
    }
  }, [user, loading, segments]);

  useEffect(() => {
    isNavigatingRef.current = false;
  }, [segments]);

  useEffect(() => {
    if (pushError && __DEV__) {
      console.warn('Push registration warning:', pushError);
    }
  }, [pushError]);

  useEffect(() => {
    if (!user || !lastNotificationResponse) return;

    const data = lastNotificationResponse?.data || {};
    const projectId = String(data?.projectId || data?.projectID || '').trim();
    const target = String(data?.target || '').trim().toLowerCase();

    void trackEvent('push_notification_open', {
      target: target || 'inbox',
      has_project_id: Boolean(projectId),
    });

    try {
      if (projectId) {
        router.push(`/project/${projectId}`);
        return;
      }

      if (target === 'workspace') {
        router.push('/workspace');
        return;
      }

      if (target === 'ai-history') {
        router.push('/ai-history');
        return;
      }

      router.push('/(tabs)/inbox');
    } catch (error) {
      captureException(error, {
        scope: 'mobile_push_navigation',
        target: target || 'inbox',
        has_project_id: Boolean(projectId),
      });
    }
  }, [lastNotificationResponse, router, user]);

  return (
    <View style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="project/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="ai-history" options={{ headerShown: false }} />
        <Stack.Screen name="file-preview" options={{ headerShown: false }} />
        <Stack.Screen name="workspace" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="credits" options={{ headerShown: false }} />
        <Stack.Screen name="trash" options={{ headerShown: false }} />
        <Stack.Screen name="subscription" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
      {loading && (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: '#0f1115',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
          }}
        >
          <ActivityIndicator size="large" color="#c6a87c" />
        </View>
      )}
      <OfflineIndicator />
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (!loaded) return;

    SplashScreen.hideAsync().catch((error) => {
      captureException(error, { scope: 'mobile_root_splash_hide' });
    });
  }, [loaded]);

  useEffect(() => {
    initErrorTracking();
    initializeAnalytics().catch((error) => {
      captureException(error, { scope: 'mobile_root_analytics_init' });
    });
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <Sentry.ErrorBoundary
      fallback={
        <View style={{ flex: 1, backgroundColor: '#0f1115', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: '#c6a87c', fontSize: 18, fontWeight: '700', marginBottom: 12, textAlign: 'center' }}>
            Bir hata oluştu
          </Text>
          <Text style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
            Uygulama beklenmedik bir şekilde durdu. Lütfen tekrar deneyin.
          </Text>
          <TouchableOpacity
            onPress={() => {
              // Attempt recovery by reloading the app
              if (typeof global !== 'undefined' && (global as any).Expo?.reload) {
                (global as any).Expo.reload();
              }
            }}
            style={{ backgroundColor: '#c6a87c', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
          >
            <Text style={{ color: '#0f1115', fontWeight: '700' }}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <AuthProvider>
        <ThemeProvider value={DarkTheme}>
          <InitialLayout />
        </ThemeProvider>
      </AuthProvider>
    </Sentry.ErrorBoundary>
  );
}
