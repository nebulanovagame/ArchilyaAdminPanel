import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Link } from 'expo-router';
import { MailCheck } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { resetPassword } = useAuth();

  const handleReset = async () => {
    if (!email) {
      setError(t('emailRequired'));
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await resetPassword(email.trim());
      setSuccess(t('resetLinkSent'));
    } catch (err: any) {
      setError(err?.message || t('emailSendFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-[#0f1115]">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: Platform.OS === 'android' ? 40 : 24 }}
        className="px-6"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 justify-start py-10">
          <View className="items-center mb-10">
            <View className="w-20 h-20 bg-[#c6a87c] rounded-2xl items-center justify-center mb-4">
              <MailCheck size={36} color="#0f1115" />
            </View>
            <Text className="text-3xl font-bold text-white mb-2">{t('forgotPasswordTitle')}</Text>
            <Text className="text-gray-400 text-base text-center">{t('forgotPasswordSubtitle')}</Text>
          </View>

          <View className="bg-[#1a1c23] p-6 rounded-3xl border border-[#2a2d36]">
            {error ? (
              <View className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl mb-4">
                <Text className="text-red-500 text-center">{error}</Text>
              </View>
            ) : null}

            {success ? (
              <View className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl mb-4">
                <Text className="text-emerald-400 text-center">{success}</Text>
              </View>
            ) : null}

            <View className="mb-6">
              <Text className="text-gray-400 mb-2 ml-1">{t('email')}</Text>
              <TextInput
                className="bg-[#0f1115] text-white p-4 rounded-xl border border-[#2a2d36]"
                placeholder={t('emailPlaceholder')}
                placeholderTextColor="#4b5563"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <TouchableOpacity
              className={`bg-[#c6a87c] p-4 rounded-xl items-center ${loading ? 'opacity-70' : ''}`}
              onPress={handleReset}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={t('sendLink')}
            >
              {loading ? <ActivityIndicator color="#0f1115" /> : <Text className="text-[#0f1115] font-bold text-lg">{t('sendLink')}</Text>}
            </TouchableOpacity>

            <View className="mt-5 items-center">
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('backToLogin')}>
                  <Text className="text-gray-400">{t('backToLogin')}</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
