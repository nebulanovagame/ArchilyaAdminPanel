import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Building2, Check, Mail, Trash2, UserMinus, Users, X } from 'lucide-react-native';
import { useWorkspace } from '../src/hooks/useWorkspace';
import { type WorkspaceMember } from '../src/types';

function formatBytes(bytes: any) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const power = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / 1024 ** power;
  return `${size.toFixed(power === 0 ? 0 : 1)} ${units[power]}`;
}

export default function WorkspaceScreen() {
  const router = useRouter();
  const {
    activeWorkspace,
    workspaceInvites,
    isAdmin,
    loading,
    createWorkspace,
    inviteMember,
    acceptWorkspaceInvite,
    declineWorkspaceInvite,
    removeMember,
    deleteWorkspace,
  } = useWorkspace();

  const [workspaceName, setWorkspaceName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [busyInviteId, setBusyInviteId] = useState('');
  const [removingUid, setRemovingUid] = useState('');

  const members = useMemo(() => (activeWorkspace?.members ?? []) as WorkspaceMember[], [activeWorkspace]);

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) {
      Alert.alert('Hata', 'Workspace adi zorunludur.');
      return;
    }

    setCreating(true);
    try {
      await createWorkspace(workspaceName.trim());
      setWorkspaceName('');
      Alert.alert('Basarili', 'Calisma alani olusturuldu.');
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Calisma alani olusturulamadi.');
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Hata', 'E-posta zorunludur.');
      return;
    }

    setInviting(true);
    try {
      await inviteMember(inviteEmail.trim());
      setInviteEmail('');
      Alert.alert('Basarili', 'Workspace daveti gonderildi.');
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Workspace daveti gonderilemedi.');
    } finally {
      setInviting(false);
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    setBusyInviteId(inviteId);
    try {
      await acceptWorkspaceInvite(inviteId);
      Alert.alert('Basarili', 'Workspace daveti kabul edildi.');
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Workspace daveti kabul edilemedi.');
    } finally {
      setBusyInviteId('');
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    setBusyInviteId(inviteId);
    try {
      await declineWorkspaceInvite(inviteId);
      Alert.alert('Bilgi', 'Workspace daveti reddedildi.');
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Workspace daveti reddedilemedi.');
    } finally {
      setBusyInviteId('');
    }
  };

  const handleRemoveMember = async (memberUid: string, email: string) => {
    Alert.alert('Uyeyi Cikar', `${email} workspace'ten cikarilsin mi?`, [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Cikar',
        style: 'destructive',
        onPress: async () => {
          setRemovingUid(memberUid);
          try {
            await removeMember(memberUid);
          } catch (err: any) {
            Alert.alert('Hata', err?.message || 'Uye cikarilamadi.');
          } finally {
            setRemovingUid('');
          }
        },
      },
    ]);
  };

  const handleDeleteWorkspace = () => {
    Alert.alert('Workspace Sil', 'Workspace kalici olarak silinecek. Emin misiniz?', [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWorkspace();
            Alert.alert('Basarili', 'Workspace silindi.');
          } catch (err: any) {
            Alert.alert('Hata', err?.message || 'Workspace silinemedi.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0f1115]" style={{ paddingTop: Platform.OS === 'android' ? 36 : 0 }}>
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="flex-row items-center mb-5">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 bg-[#1a1c23] p-2 rounded-lg">
            <ArrowLeft size={18} color="#c6a87c" />
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold">Workspace</Text>
        </View>

        {loading ? (
          <View className="items-center py-10">
            <ActivityIndicator color="#c6a87c" />
          </View>
        ) : null}

        {workspaceInvites.length > 0 ? (
          <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
            <Text className="text-white font-semibold mb-3">Bekleyen Workspace Davetleri</Text>

            {workspaceInvites.map((invite: any) => {
              const busy = busyInviteId === invite.id;
              return (
                <View key={invite.id} className="bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] mb-2">
                  <Text className="text-white font-semibold">{invite.workspaceName || 'Workspace'}</Text>
                  <Text className="text-gray-400 text-xs mt-1">{invite.fromName || invite.fromEmail} sizi davet etti.</Text>

                  <View className="flex-row mt-3">
                    <TouchableOpacity
                      className="flex-1 bg-[#c6a87c] p-2 rounded-lg items-center mr-2"
                      onPress={() => handleAcceptInvite(invite.id)}
                      disabled={busy}
                    >
                      {busy ? <ActivityIndicator size="small" color="#0f1115" /> : <Check size={14} color="#0f1115" />}
                    </TouchableOpacity>

                    <TouchableOpacity
                      className="flex-1 bg-red-500/10 p-2 rounded-lg items-center"
                      onPress={() => handleDeclineInvite(invite.id)}
                      disabled={busy}
                    >
                      {busy ? <ActivityIndicator size="small" color="#ef4444" /> : <X size={14} color="#ef4444" />}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {!activeWorkspace ? (
          <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
            <View className="flex-row items-center mb-3">
              <Building2 size={18} color="#c6a87c" />
              <Text className="text-white font-semibold ml-2">Yeni Workspace Olustur</Text>
            </View>

            <TextInput
              className="bg-[#0f1115] text-white p-3 rounded-xl border border-[#2a2d36]"
              placeholder="Workspace adi"
              placeholderTextColor="#4b5563"
              value={workspaceName}
              onChangeText={setWorkspaceName}
            />

            <TouchableOpacity className="bg-[#c6a87c] p-3 rounded-xl items-center mt-3" onPress={handleCreateWorkspace} disabled={creating}>
              <Text className="text-[#0f1115] font-bold">{creating ? 'Olusturuluyor...' : 'Workspace Olustur'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
              <Text className="text-white text-xl font-bold">{activeWorkspace.name || 'Workspace'}</Text>
              <Text className="text-gray-400 mt-1">Rol: {isAdmin ? 'Admin' : 'Uye'}</Text>

              <View className="flex-row flex-wrap justify-between mt-4">
                <View className="w-[48%] bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] mb-2">
                  <Text className="text-gray-500 text-xs">Pool Credits</Text>
                  <Text className="text-[#c6a87c] text-xl font-bold mt-1">{String((activeWorkspace.poolCredits as number | string | null | undefined) ?? 0)}</Text>
                </View>
                <View className="w-[48%] bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] mb-2">
                  <Text className="text-gray-500 text-xs">Kullanilan Depolama</Text>
                  <Text className="text-[#9cc6ff] text-xl font-bold mt-1">{formatBytes(activeWorkspace.usedStorage)}</Text>
                </View>
              </View>
              <Text className="text-gray-500 text-xs mt-2">Toplam Havuz Depolama: {formatBytes(activeWorkspace.poolStorage)}</Text>
            </View>

            {isAdmin ? (
              <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
                <View className="flex-row items-center mb-3">
                  <Mail size={16} color="#c6a87c" />
                  <Text className="text-white font-semibold ml-2">Uye Davet Et</Text>
                </View>

                <TextInput
                  className="bg-[#0f1115] text-white p-3 rounded-xl border border-[#2a2d36]"
                  placeholder="ornek@email.com"
                  placeholderTextColor="#4b5563"
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <TouchableOpacity className="bg-[#c6a87c] p-3 rounded-xl items-center mt-3" onPress={handleInvite} disabled={inviting}>
                  <Text className="text-[#0f1115] font-bold">{inviting ? 'Gonderiliyor...' : 'Davet Gonder'}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
              <View className="flex-row items-center mb-3">
                <Users size={16} color="#c6a87c" />
                <Text className="text-white font-semibold ml-2">Uyeler ({members.length})</Text>
              </View>

              {members.length === 0 ? (
                <Text className="text-gray-500">Uye bulunmuyor.</Text>
              ) : (
                members.map((member: any, index: number) => (
                  <View key={`${member.uid || member.email}_${index}`} className="bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] mb-2">
                    <View className="flex-row justify-between items-center">
                      <View className="flex-1 pr-3">
                        <Text className="text-white font-semibold">{member.displayName || member.email}</Text>
                        <Text className="text-gray-500 text-xs mt-1">{member.email}</Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-[#c6a87c] text-xs uppercase">{member.role || 'member'}</Text>
                        {isAdmin && member.uid !== activeWorkspace.adminUid ? (
                          <TouchableOpacity
                            className="bg-red-500/10 px-2 py-1 rounded-md mt-2"
                            onPress={() => handleRemoveMember(member.uid, member.email)}
                            disabled={removingUid === member.uid}
                          >
                            {removingUid === member.uid ? <ActivityIndicator color="#ef4444" size="small" /> : <UserMinus size={13} color="#ef4444" />}
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>

            {isAdmin ? (
              <TouchableOpacity className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl items-center" onPress={handleDeleteWorkspace}>
                <View className="flex-row items-center">
                  <Trash2 size={15} color="#ef4444" />
                  <Text className="text-red-400 font-bold ml-2">Workspace'i Sil</Text>
                </View>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
