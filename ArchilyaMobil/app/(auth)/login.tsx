import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/context/AuthContext';
import { Link } from 'expo-router';
import { loginSchema, type LoginFormValues } from '../../src/schemas/formSchemas';
import { LogIn } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import {
  buildGoogleAuthRedirectOptions,
  buildGoogleAuthRequestConfig,
  extractGoogleTokens,
  getGoogleAuthConfig,
  getGoogleAuthErrorMessage,
  getGoogleSetupHintText,
  isGoogleAuthConfigured,
  signInWithGoogleNative,
  type AuthResultLike,
} from '../../src/services/googleAuthService';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { t } = useTranslation();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, signInWithGoogleToken } = useAuth();
  const passwordInputRef = useRef<TextInput | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const googleConfig = useMemo(() => getGoogleAuthConfig(), []);
  const googleRequestConfig = useMemo(() => buildGoogleAuthRequestConfig(googleConfig), [googleConfig]);
  const googleRedirectOptions = useMemo(() => buildGoogleAuthRedirectOptions(googleConfig), [googleConfig]);

  const isGoogleConfigured = useMemo(() => isGoogleAuthConfigured(googleConfig), [googleConfig]);

  const [googleRequest, googleResponse, promptGoogleSignIn] = Google.useIdTokenAuthRequest(googleRequestConfig, googleRedirectOptions);

  useEffect(() => {
    if (!googleResponse) return;

    if (googleResponse.type === 'success') {
      const { idToken, accessToken } = extractGoogleTokens(googleResponse as AuthResultLike);

      if (!idToken && !accessToken) {
        setError(t('googleAuthError'));
        setGoogleLoading(false);
        return;
      }

      signInWithGoogleToken({ idToken, accessToken })
        .then(() => {
          setError('');
          // Navigation is handled by root layout's auth redirect effect
        })
        .catch((err: any) => {
          setError(getGoogleAuthErrorMessage(err));
        })
        .finally(() => {
          setGoogleLoading(false);
        });

      return;
    }

    if (googleResponse.type === 'error') {
      setError(getGoogleAuthErrorMessage(googleResponse));
    }

    if (googleResponse.type !== 'dismiss' && googleResponse.type !== 'opened' && googleResponse.type !== 'locked') {
      setGoogleLoading(false);
    }
  }, [googleResponse, signInWithGoogleToken, t]);

  const getEmailLoginErrorMessage = (err: any): string => {
    const code = String(err?.code || '').toLowerCase();
    if (code.includes('auth/invalid-email')) return t('emailInvalid');
    if (code.includes('auth/user-disabled')) return t('accountDisabled');
    if (
      code.includes('auth/user-not-found') ||
      code.includes('auth/wrong-password') ||
      code.includes('auth/invalid-credential')
    ) {
      return t('wrongCredentials');
    }
    if (code.includes('auth/too-many-requests')) return t('tooManyRequests');
    if (code.includes('auth/network-request-failed')) return t('networkError');
    return t('loginFailed');
  };

  const onSubmit = async (values: LoginFormValues) => {
    setError('');
    try {
      await login(values.email.trim(), values.password);
      // Navigation is handled by root layout's auth redirect effect
    } catch (err: any) {
      setError(getEmailLoginErrorMessage(err));
      console.error(err);
    }
  };

  const handleGoogleLogin = async () => {
    if (!isGoogleConfigured) {
      Alert.alert(
        t('googleLoginNotReady'),
        `${t('googleLoginNotReadyMessage')}\n\n${getGoogleSetupHintText()}`
      );
      return;
    }

    if (Platform.OS !== 'android' && !googleRequest) {
      Alert.alert(t('googleLoginNotReady'), t('googleLoginError'));
      return;
    }

    setGoogleLoading(true);
    setError('');
    try {
      if (Platform.OS === 'android') {
        const nativeResult = await signInWithGoogleNative(googleConfig);

        if (nativeResult.cancelled) {
          setGoogleLoading(false);
          return;
        }

        if (!nativeResult.idToken && !nativeResult.accessToken) {
          setGoogleLoading(false);
          setError(t('googleAuthError'));
          return;
        }

        await signInWithGoogleToken({ idToken: nativeResult.idToken, accessToken: nativeResult.accessToken });
        setError('');
        setGoogleLoading(false);
        // Navigation is handled by root layout's auth redirect effect
        return;
      }

      const result = await promptGoogleSignIn({ showInRecents: true });
      if (result.type === 'cancel' || result.type === 'dismiss') {
        setGoogleLoading(false);
      } else if (result.type === 'error') {
        setGoogleLoading(false);
        setError(getGoogleAuthErrorMessage(result));
      }
    } catch (err: any) {
      setGoogleLoading(false);
      setError(getGoogleAuthErrorMessage(err));
    }
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'android' ? 30 : 0}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <View className="items-center mb-10">
            <View className="w-20 h-20 bg-[#c6a87c] rounded-2xl items-center justify-center mb-4">
              <LogIn size={40} color="#0f1115" />
            </View>
            <Text className="text-3xl font-bold text-white mb-2">Archilya</Text>
            <Text className="text-[#c6a87c] text-lg font-medium">{t('loginTitle')}</Text>
          </View>

          <View className="bg-[#1a1c23] p-6 rounded-3xl border border-[#2a2d36]">
            {error ? (
              <View className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl mb-4">
                <Text className="text-red-500 text-center">{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              className={`bg-white/10 border border-white/15 p-4 rounded-xl items-center mb-4 ${googleLoading ? 'opacity-70' : ''}`}
              onPress={handleGoogleLogin}
              disabled={googleLoading}
              accessibilityRole="button"
              accessibilityLabel={t('loginWithGoogle')}
            >
              {googleLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-bold text-base">{t('loginWithGoogle')}</Text>
              )}
            </TouchableOpacity>

            <View className="flex-row items-center mb-4">
              <View className="flex-1 h-px bg-[#2a2d36]" />
              <Text className="text-gray-500 text-xs px-3">{t('orWithEmail')}</Text>
              <View className="flex-1 h-px bg-[#2a2d36]" />
            </View>

            <View className="mb-4">
              <Text className="text-gray-400 mb-2 ml-1">{t('email')}</Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className="bg-[#0f1115] text-white p-4 rounded-xl border border-[#2a2d36]"
                    placeholder={t('emailPlaceholder')}
                    placeholderTextColor="#4b5563"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                    autoComplete="email"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                )}
              />
            </View>

            <View className="mb-6">
              <Text className="text-gray-400 mb-2 ml-1">{t('password')}</Text>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder={t('passwordPlaceholder')}
                      placeholderTextColor="#4b5563"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      secureTextEntry={!showPassword}
                      ref={passwordInputRef}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="password"
                      textContentType="none"
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit(onSubmit)}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(v => !v)}
                      style={styles.eyeButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? t('hidePassword') : t('showPassword')}
                    >
                      <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            </View>

            <TouchableOpacity
              className={`bg-[#c6a87c] p-4 rounded-xl items-center ${isSubmitting ? 'opacity-70' : ''}`}
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={t('loginButton')}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#0f1115" />
              ) : (
                <Text className="text-[#0f1115] font-bold text-lg">{t('loginButton')}</Text>
              )}
            </TouchableOpacity>

            <View className="mt-5 flex-row items-center justify-between">
              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('forgotPassword')}>
                  <Text className="text-gray-400">{t('forgotPassword')}</Text>
                </TouchableOpacity>
              </Link>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('register')}>
                  <Text className="text-[#c6a87c] font-semibold">{t('register')}</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1115',
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 40,
    paddingBottom: 24,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f1115',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2d36',
    overflow: 'hidden',
  },
  passwordInput: {
    flex: 1,
    color: '#ffffff',
    padding: 16,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  eyeText: {
    fontSize: 18,
  },
});
