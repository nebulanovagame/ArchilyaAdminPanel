import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Link, useRouter } from 'expo-router';
import { UserPlus } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import * as WebBrowser from 'expo-web-browser';
import { registerSchema, type RegisterFormValues } from '../../src/schemas/formSchemas';
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

export default function RegisterScreen() {
  const { t } = useTranslation();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register: registerUser, signInWithGoogleToken } = useAuth();
  const router = useRouter();
  const emailInputRef = useRef<TextInput | null>(null);
  const passwordInputRef = useRef<TextInput | null>(null);
  const confirmPasswordInputRef = useRef<TextInput | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
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
          router.replace('/(tabs)');
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
  }, [googleResponse, router, signInWithGoogleToken, t]);

  const onSubmit = async (values: RegisterFormValues) => {
    setError('');
    try {
      await registerUser(values.email.trim(), values.password, values.name.trim());
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message || t('registerFailed'));
    }
  };

  const handleGoogleRegister = async () => {
    if (!isGoogleConfigured) {
      Alert.alert(
        t('googleRegisterNotReady'),
        `${t('googleLoginNotReadyMessage')}\n\n${getGoogleSetupHintText()}`
      );
      return;
    }

    if (Platform.OS !== 'android' && !googleRequest) {
      Alert.alert(t('googleRegisterNotReady'), t('googleRegisterError'));
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
        router.replace('/(tabs)');
        setGoogleLoading(false);
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
              <UserPlus size={36} color="#0f1115" />
            </View>
            <Text className="text-3xl font-bold text-white mb-2">Archilya</Text>
            <Text className="text-[#c6a87c] text-lg font-medium">{t('registerTitle')}</Text>
          </View>

          <View className="bg-[#1a1c23] p-6 rounded-3xl border border-[#2a2d36]">
            {error ? (
              <View className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl mb-4">
                <Text className="text-red-500 text-center">{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              className={`bg-white/10 border border-white/15 p-4 rounded-xl items-center mb-4 ${googleLoading ? 'opacity-70' : ''}`}
              onPress={handleGoogleRegister}
              disabled={googleLoading}
              accessibilityRole="button"
              accessibilityLabel={t('registerWithGoogle')}
            >
              {googleLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-bold text-base">{t('registerWithGoogle')}</Text>
              )}
            </TouchableOpacity>

            <View className="flex-row items-center mb-4">
              <View className="flex-1 h-px bg-[#2a2d36]" />
              <Text className="text-gray-500 text-xs px-3">{t('orWithEmail')}</Text>
              <View className="flex-1 h-px bg-[#2a2d36]" />
            </View>

            <View className="mb-4">
              <Text className="text-gray-400 mb-2 ml-1">{t('fullName')}</Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className="bg-[#0f1115] text-white p-4 rounded-xl border border-[#2a2d36]"
                    placeholder={t('fullNamePlaceholder')}
                    placeholderTextColor="#4b5563"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    autoCorrect={false}
                    textContentType="name"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => emailInputRef.current?.focus()}
                  />
                )}
              />
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
                    ref={emailInputRef}
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

            <View className="mb-4">
              <Text className="text-gray-400 mb-2 ml-1">{t('password')}</Text>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder={t('passwordMinChars')}
                      placeholderTextColor="#4b5563"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      secureTextEntry={!showPassword}
                      ref={passwordInputRef}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="new-password"
                      textContentType="none"
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
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

            <View className="mb-6">
              <Text className="text-gray-400 mb-2 ml-1">{t('confirmPassword')}</Text>
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder={t('confirmPasswordPlaceholder')}
                      placeholderTextColor="#4b5563"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      secureTextEntry={!showConfirmPassword}
                      ref={confirmPasswordInputRef}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="new-password"
                      textContentType="none"
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit(onSubmit)}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(v => !v)}
                      style={styles.eyeButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessibilityRole="button"
                      accessibilityLabel={showConfirmPassword ? t('hidePassword') : t('showPassword')}
                    >
                      <Text style={styles.eyeText}>{showConfirmPassword ? '🙈' : '👁️'}</Text>
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
              accessibilityLabel={t('registerButton')}
            >
              {isSubmitting ? <ActivityIndicator color="#0f1115" /> : <Text className="text-[#0f1115] font-bold text-lg">{t('registerButton')}</Text>}
            </TouchableOpacity>

            <View className="mt-5 items-center">
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('loginLink')}>
                  <Text className="text-gray-400">{t('alreadyHaveAccount')} <Text className="text-[#c6a87c]">{t('loginLink')}</Text></Text>
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
