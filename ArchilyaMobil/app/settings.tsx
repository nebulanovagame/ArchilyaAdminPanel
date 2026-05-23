import React, { useEffect, useState } from 'react';
import { Alert, Linking, Modal, Platform, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ArrowLeft, Building2, ExternalLink, Headphones, Lock, Mail, Save, Shield, Trash2, X } from 'lucide-react-native';
import { EmailAuthProvider, reauthenticateWithCredential, updateEmail, updateProfile } from 'firebase/auth';
import { useAuth } from '../src/context/AuthContext';
import { deleteAccountSecure, ensureUserProfileSecure } from '../src/services/entitlementService';

function getAuthErrorMessage(code?: string) {
  const map: Record<string, string> = {
    'auth/wrong-password': 'Mevcut şifreniz hatalı.',
    'auth/requires-recent-login': 'Bu işlem için yeniden giriş yapmanız gerekiyor.',
    'auth/email-already-in-use': 'Bu e-posta adresi zaten kullanımda.',
    'auth/invalid-email': 'Geçerli bir e-posta adresi girin.',
    'auth/too-many-requests': 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.',
  };

  return map[String(code || '').trim()] || 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
}

const LEGAL_PAGES = [
  { title: 'Hakkımızda', path: 'hakkimizda' },
  { title: 'Gizlilik Politikası', path: 'gizlilik-politikasi' },
  { title: 'KVKK Aydınlatma Metni', path: 'kvkk' },
  { title: 'Kullanım Koşulları', path: 'kullanim-kosullari' },
  { title: 'İptal ve İade Koşulları', path: 'iptal-iade' },
  { title: 'Mesafeli Satış Sözleşmesi', path: 'mesafeli-satis' },
];

export default function SettingsScreen() {
  const { user, userData, resetPassword, refreshUserData, logout } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(userData?.name || user?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailStep, setEmailStep] = useState<'email' | 'password'>('email');
  const [pendingEmail, setPendingEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const isGoogleUser = Array.isArray(user?.providerData)
    ? user.providerData.some((provider: any) => provider?.providerId === 'google.com')
    : false;

  useEffect(() => {
    setName(userData?.name || user?.displayName || '');
  }, [user?.displayName, userData?.name]);

  useEffect(() => {
    setPendingEmail(user?.email || '');
  }, [user?.email]);

  const saveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Hata', 'Ad soyad bos olamaz.');
      return;
    }

    setSaving(true);
    try {
      if (user) {
        await updateProfile(user, { displayName: name.trim() });
      }
      await ensureUserProfileSecure({
        email: user!.email,
        displayName: name.trim(),
      });
      await refreshUserData(user!.uid);
      Alert.alert('Basarili', 'Profil bilgileri guncellendi.');
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Profil guncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  const sendResetMail = async () => {
    try {
      await resetPassword(user!.email!);
      Alert.alert('Basarili', 'Sifre sifirlama e-postasi gonderildi.');
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'E-posta gonderilemedi.');
    }
  };

  const closeEmailModal = () => {
    setEmailModalVisible(false);
    setEmailStep('email');
    setPendingEmail(user?.email || '');
    setCurrentPassword('');
  };

  const openEmailModal = () => {
    if (isGoogleUser) {
      Alert.alert('Bilgi', 'Google ile giriş yapan hesaplarda e-posta değişikliği desteklenmiyor.');
      return;
    }

    setPendingEmail(user?.email || '');
    setCurrentPassword('');
    setEmailStep('email');
    setEmailModalVisible(true);
  };

  const handleEmailStepContinue = () => {
    const normalizedEmail = String(pendingEmail || '').trim().toLowerCase();
    const currentEmail = String(user?.email || '').trim().toLowerCase();

    if (!user) {
      Alert.alert('Hata', 'Oturum bilgisi bulunamadi.');
      return;
    }

    if (!normalizedEmail) {
      Alert.alert('Hata', 'Yeni e-posta adresini girin.');
      return;
    }

    if (normalizedEmail === currentEmail) {
      Alert.alert('Bilgi', 'Yeni e-posta mevcut e-posta ile ayni.');
      return;
    }

    setPendingEmail(normalizedEmail);
    setEmailStep('password');
  };

  const handleUpdateEmail = async (newEmail: string, password: string) => {
    const normalizedEmail = String(newEmail || '').trim().toLowerCase();

    if (!user?.email || !user?.uid) {
      Alert.alert('Hata', 'Oturum bilgisi bulunamadi.');
      return;
    }

    if (!password) {
      Alert.alert('Hata', 'Güvenlik doğrulaması için mevcut şifrenizi girin.');
      return;
    }

    setEmailSaving(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      await updateEmail(user, normalizedEmail);
      const result = await ensureUserProfileSecure({
        email: normalizedEmail,
        displayName: user.displayName || name.trim(),
      });

      if (!result?.success) {
        throw new Error(result?.message || 'Profil bilgileri guncellenemedi.');
      }

      await refreshUserData(user.uid);
      closeEmailModal();
      Alert.alert('Basarili', 'E-posta adresiniz guncellendi.');
    } catch (err: any) {
      Alert.alert('Hata', getAuthErrorMessage(err?.code || err?.message));
    } finally {
      setEmailSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Hesabi Sil',
      'Bu islem kalicidir. Hesap ve iliskili verileriniz silinir. Devam etmek istiyor musunuz?',
      [
        { text: 'Vazgec', style: 'cancel' },
        {
          text: 'Hesabi Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteAccountSecure();
              if (!result?.success) {
                throw new Error(result?.message || 'Hesap silinemedi.');
              }
              await logout();
              Alert.alert('Basarili', 'Hesabiniz silindi.');
            } catch (err: any) {
              Alert.alert('Hata', err?.message || 'Hesap silme islemi basarisiz.');
            }
          },
        },
      ]
    );
  };

  const openLegalPage = async (path: string) => {
    try {
      await WebBrowser.openBrowserAsync(`https://archilya.com/${path}`);
    } catch {
      Alert.alert('Hata', 'Sayfa açılamadı. Lütfen tekrar deneyin.');
    }
  };

  const openSupportMail = async () => {
    try {
      await Linking.openURL(`mailto:info@nebulanovagames.com?subject=${encodeURIComponent('Archilya Mobil Destek')}`);
    } catch {
      Alert.alert('Hata', 'Destek e-postası açılamadı. Lütfen daha sonra tekrar deneyin.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0f1115]" style={{ paddingTop: Platform.OS === 'android' ? 36 : 0 }}>
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="flex-row items-center mb-5">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 bg-[#1a1c23] p-2 rounded-lg">
            <ArrowLeft size={18} color="#c6a87c" />
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold">Ayarlar</Text>
        </View>

        <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
          <Text className="text-white font-semibold mb-3">Profil Bilgileri</Text>
          <Text className="text-gray-400 mb-2">E-posta</Text>
          <TextInput className="bg-[#0f1115] text-gray-400 p-3 rounded-xl border border-[#2a2d36] mb-3" value={user?.email || ''} editable={false} />
          <Text className="text-gray-400 mb-2">Ad Soyad</Text>
          <TextInput
            className="bg-[#0f1115] text-white p-3 rounded-xl border border-[#2a2d36]"
            placeholder="Ad Soyad"
            placeholderTextColor="#4b5563"
            value={name}
            onChangeText={setName}
          />

          <TouchableOpacity className="bg-[#c6a87c] p-3 rounded-xl items-center mt-4" onPress={saveProfile} disabled={saving}>
            <View className="flex-row items-center">
              <Save size={15} color="#0f1115" />
              <Text className="text-[#0f1115] font-bold ml-2">{saving ? 'Kaydediliyor...' : 'Profili Kaydet'}</Text>
            </View>
          </TouchableOpacity>

          {!isGoogleUser ? (
            <TouchableOpacity className="bg-[#0f1115] p-3 rounded-xl items-center mt-3 border border-[#2a2d36]" onPress={openEmailModal} disabled={emailSaving}>
              <View className="flex-row items-center justify-center">
                <Mail size={15} color="#c6a87c" />
                <Text className="text-[#c6a87c] font-semibold ml-2">E-posta Güncelle</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>

        <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
          <Text className="text-white font-semibold mb-3">Guvenlik</Text>
          <TouchableOpacity className="bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36]" onPress={sendResetMail}>
            <View className="flex-row items-center justify-center">
              <Shield size={15} color="#c6a87c" />
              <Text className="text-[#c6a87c] font-semibold ml-2">Sifre Sifirlama E-postasi Gonder</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity className="bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] mt-3" onPress={() => router.push('/workspace')}>
            <View className="flex-row items-center justify-center">
              <Building2 size={15} color="#9cc6ff" />
              <Text className="text-[#9cc6ff] font-semibold ml-2">Workspace Yonetimi</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity className="bg-red-500/10 p-3 rounded-xl border border-red-500/30 mt-3" onPress={handleDeleteAccount}>
            <View className="flex-row items-center justify-center">
              <Trash2 size={15} color="#ef4444" />
              <Text className="text-red-400 font-semibold ml-2">Hesabimi Kalici Sil</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
          <Text className="text-white font-semibold mb-3">Destek</Text>
          <TouchableOpacity className="bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36]" onPress={openSupportMail}>
            <View className="flex-row items-center justify-center">
              <Headphones size={15} color="#c6a87c" />
              <Text className="text-[#c6a87c] font-semibold ml-2">Destek Ekibiyle İletişime Geç</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36]">
          <View className="flex-row items-center mb-3">
            <Shield size={16} color="#c6a87c" />
            <Text className="text-white font-semibold ml-2">Yasal</Text>
          </View>

          {LEGAL_PAGES.map((page, index) => (
            <TouchableOpacity
              key={page.path}
              className={`bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] flex-row items-center justify-between ${index === LEGAL_PAGES.length - 1 ? '' : 'mb-2'}`}
              onPress={() => openLegalPage(page.path)}
            >
              <Text className="text-white font-medium flex-1 pr-3">{page.title}</Text>
              <ExternalLink size={16} color="#c6a87c" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Modal visible={emailModalVisible} animationType="fade" transparent onRequestClose={closeEmailModal}>
        <View className="flex-1 bg-black/60 items-center justify-center px-4">
          <View className="w-full max-w-md bg-[#1a1c23] border border-[#2a2d36] rounded-2xl p-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white text-lg font-semibold">
                {emailStep === 'email' ? 'Yeni e-posta adresinizi girin' : 'Güvenlik doğrulaması'}
              </Text>
              <TouchableOpacity onPress={closeEmailModal}>
                <X size={18} color="#c6a87c" />
              </TouchableOpacity>
            </View>

            {emailStep === 'email' ? (
              <>
                <Text className="text-gray-400 mb-2">Yeni E-posta</Text>
                <View className="bg-[#0f1115] rounded-xl border border-[#2a2d36] mb-4 px-3 flex-row items-center">
                  <Mail size={15} color="#c6a87c" />
                  <TextInput
                    className="flex-1 text-white p-3"
                    placeholder="ornek@archilya.com"
                    placeholderTextColor="#4b5563"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={pendingEmail}
                    onChangeText={setPendingEmail}
                  />
                </View>

                <View className="flex-row justify-end">
                  <TouchableOpacity className="bg-[#0f1115] border border-[#2a2d36] px-4 py-3 rounded-xl mr-2" onPress={closeEmailModal}>
                    <Text className="text-gray-300 font-semibold">Vazgeç</Text>
                  </TouchableOpacity>
                  <TouchableOpacity className="bg-[#c6a87c] px-4 py-3 rounded-xl" onPress={handleEmailStepContinue}>
                    <Text className="text-[#0f1115] font-bold">Devam Et</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text className="text-gray-400 mb-2">Mevcut Şifre</Text>
                <View className="bg-[#0f1115] rounded-xl border border-[#2a2d36] mb-4 px-3 flex-row items-center">
                  <Lock size={15} color="#c6a87c" />
                  <TextInput
                    className="flex-1 text-white p-3"
                    placeholder="••••••••"
                    placeholderTextColor="#4b5563"
                    secureTextEntry
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                  />
                </View>

                <View className="flex-row justify-end">
                  <TouchableOpacity
                    className="bg-[#0f1115] border border-[#2a2d36] px-4 py-3 rounded-xl mr-2"
                    onPress={() => {
                      setCurrentPassword('');
                      setEmailStep('email');
                    }}
                    disabled={emailSaving}
                  >
                    <Text className="text-gray-300 font-semibold">Geri</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="bg-[#c6a87c] px-4 py-3 rounded-xl"
                    onPress={() => handleUpdateEmail(pendingEmail, currentPassword)}
                    disabled={emailSaving}
                  >
                    <Text className="text-[#0f1115] font-bold">{emailSaving ? 'Güncelleniyor...' : 'E-postayı Güncelle'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
