import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Building2, Check, CheckCheck, Clock3, FolderOpen, Mail, X } from 'lucide-react-native';
import { useInvitations } from '../../src/hooks/useInvitations';
import { useNotifications } from '../../src/hooks/useNotifications';
import { useWorkspace } from '../../src/hooks/useWorkspace';

function formatDate(value: any) {
  try {
    return new Date(value).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Bilinmeyen tarih';
  }
}

export default function InboxScreen() {
  const router = useRouter();
  const { notifications, unreadCount, loading, markAllAsRead, markAsRead } = useNotifications();
  const { receivedInvites, loading: inviteLoading, acceptInvite, declineInvite } = useInvitations();
  const {
    workspaceInvites,
    loading: workspaceLoading,
    acceptWorkspaceInvite,
    declineWorkspaceInvite,
  } = useWorkspace();

  const [busyInviteId, setBusyInviteId] = useState('');
  const [busyInviteAction, setBusyInviteAction] = useState<'accept' | 'decline' | ''>('');
  const [busyWorkspaceInviteId, setBusyWorkspaceInviteId] = useState('');
  const [busyWorkspaceInviteAction, setBusyWorkspaceInviteAction] = useState<'accept' | 'decline' | ''>('');
  const hasContent = notifications.length > 0 || receivedInvites.length > 0 || workspaceInvites.length > 0;

  const pendingInviteMap = useMemo(() => {
    const map = new Map<string, any>();
    receivedInvites.forEach((invite: any) => {
      map.set(invite.id, invite);
    });
    return map;
  }, [receivedInvites]);

  const openNotificationProject = async (notification: any) => {
    if (!notification?.projectId) return;

    try {
      if (!notification.read) {
        await markAsRead(notification.id);
      }
    } finally {
      router.push(`/project/${notification.projectId}`);
    }
  };

  const handleAcceptInvite = async (invite: any) => {
    setBusyInviteId(invite.id);
    setBusyInviteAction('accept');
    try {
      await acceptInvite(invite);
      Alert.alert('Basarili', 'Davet kabul edildi.');
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Davet kabul edilemedi.');
    } finally {
      setBusyInviteId('');
      setBusyInviteAction('');
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    setBusyInviteId(inviteId);
    setBusyInviteAction('decline');
    try {
      await declineInvite(inviteId);
      Alert.alert('Bilgi', 'Davet reddedildi.');
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Davet reddedilemedi.');
    } finally {
      setBusyInviteId('');
      setBusyInviteAction('');
    }
  };

  const handleAcceptWorkspaceInvite = async (inviteId: string) => {
    setBusyWorkspaceInviteId(inviteId);
    setBusyWorkspaceInviteAction('accept');
    try {
      await acceptWorkspaceInvite(inviteId);
      Alert.alert('Basarili', 'Workspace daveti kabul edildi.');
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Workspace daveti kabul edilemedi.');
    } finally {
      setBusyWorkspaceInviteId('');
      setBusyWorkspaceInviteAction('');
    }
  };

  const handleDeclineWorkspaceInvite = async (inviteId: string) => {
    setBusyWorkspaceInviteId(inviteId);
    setBusyWorkspaceInviteAction('decline');
    try {
      await declineWorkspaceInvite(inviteId);
      Alert.alert('Bilgi', 'Workspace daveti reddedildi.');
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Workspace daveti reddedilemedi.');
    } finally {
      setBusyWorkspaceInviteId('');
      setBusyWorkspaceInviteAction('');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0f1115]" style={{ paddingTop: Platform.OS === 'android' ? 36 : 0 }}>
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="mb-6 mt-2">
          <Text className="text-white text-3xl font-bold">Inbox</Text>
          <Text className="text-gray-400 mt-1">Bildirimler ve davetler</Text>
        </View>

        <View className="flex-row flex-wrap justify-between mb-4">
          <View className="w-[48%] bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-3">
            <Text className="text-gray-400 text-xs">Okunmamis Bildirim</Text>
            <Text className="text-white text-2xl font-bold mt-1">{unreadCount}</Text>
          </View>
          <View className="w-[48%] bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-3">
            <Text className="text-gray-400 text-xs">Bekleyen Davetler</Text>
            <Text className="text-white text-2xl font-bold mt-1">{receivedInvites.length + workspaceInvites.length}</Text>
          </View>
        </View>

        <TouchableOpacity
          className="bg-[#1a1c23] border border-[#2a2d36] rounded-xl px-4 py-3 mb-4 flex-row items-center justify-center"
          onPress={markAllAsRead}
          disabled={unreadCount === 0}
        >
          <CheckCheck size={16} color={unreadCount === 0 ? '#4b5563' : '#c6a87c'} />
          <Text className={`ml-2 font-semibold ${unreadCount === 0 ? 'text-gray-500' : 'text-[#c6a87c]'}`}>Tumunu okundu yap</Text>
        </TouchableOpacity>

        <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
          <View className="flex-row items-center mb-3">
            <Mail size={17} color="#c6a87c" />
            <Text className="text-white font-semibold ml-2">Bekleyen Davetler</Text>
          </View>

          {inviteLoading ? (
            <ActivityIndicator color="#c6a87c" />
          ) : receivedInvites.length === 0 ? (
            <Text className="text-gray-500">Bekleyen davetiniz yok.</Text>
          ) : (
            receivedInvites.map((invite: any) => {
              const busy = busyInviteId === invite.id;
              return (
                <View key={invite.id} className="bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] mb-2">
                  <Text className="text-white font-semibold">{invite.projectName || 'Proje Daveti'}</Text>
                  <Text className="text-gray-400 mt-1 text-xs">{invite.fromName || invite.fromEmail} sizi projeye davet etti.</Text>
                  <View className="flex-row items-center mt-2">
                    <Clock3 size={12} color="#6b7280" />
                    <Text className="text-gray-500 text-xs ml-1">{formatDate(invite.createdAt)}</Text>
                  </View>

                  <View className="flex-row mt-3">
                    <TouchableOpacity
                      className="flex-1 bg-[#c6a87c] p-2 rounded-lg items-center mr-2"
                      onPress={() => handleAcceptInvite(invite)}
                      disabled={busy}
                    >
                      {busy && busyInviteAction === 'accept' ? (
                        <ActivityIndicator color="#0f1115" size="small" />
                      ) : (
                        <View className="flex-row items-center">
                          <Check size={14} color="#0f1115" />
                          <Text className="text-[#0f1115] font-bold ml-2">Kabul Et</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      className="flex-1 bg-red-500/10 p-2 rounded-lg items-center"
                      onPress={() => handleDeclineInvite(invite.id)}
                      disabled={busy}
                    >
                      {busy && busyInviteAction === 'decline' ? (
                        <ActivityIndicator color="#ef4444" size="small" />
                      ) : (
                        <View className="flex-row items-center">
                          <X size={14} color="#ef4444" />
                          <Text className="text-red-400 font-bold ml-2">Reddet</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
          <View className="flex-row items-center mb-3">
            <Building2 size={17} color="#c6a87c" />
            <Text className="text-white font-semibold ml-2">Workspace Davetleri</Text>
          </View>

          {workspaceLoading ? (
            <ActivityIndicator color="#c6a87c" />
          ) : workspaceInvites.length === 0 ? (
            <Text className="text-gray-500">Bekleyen workspace davetiniz yok.</Text>
          ) : (
            workspaceInvites.map((invite: any) => {
              const busy = busyWorkspaceInviteId === invite.id;
              return (
                <View key={invite.id} className="bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] mb-2">
                  <Text className="text-white font-semibold">{invite.workspaceName || 'Workspace'}</Text>
                  <Text className="text-gray-400 mt-1 text-xs">{invite.fromName || invite.fromEmail} sizi calisma alanina davet etti.</Text>
                  <View className="flex-row items-center mt-2">
                    <Clock3 size={12} color="#6b7280" />
                    <Text className="text-gray-500 text-xs ml-1">{formatDate(invite.createdAt)}</Text>
                  </View>

                  <View className="flex-row mt-3">
                    <TouchableOpacity
                      className="flex-1 bg-[#c6a87c] p-2 rounded-lg items-center mr-2"
                      onPress={() => handleAcceptWorkspaceInvite(invite.id)}
                      disabled={busy}
                    >
                      {busy && busyWorkspaceInviteAction === 'accept' ? (
                        <ActivityIndicator color="#0f1115" size="small" />
                      ) : (
                        <View className="flex-row items-center">
                          <Check size={14} color="#0f1115" />
                          <Text className="text-[#0f1115] font-bold ml-2">Kabul Et</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      className="flex-1 bg-red-500/10 p-2 rounded-lg items-center"
                      onPress={() => handleDeclineWorkspaceInvite(invite.id)}
                      disabled={busy}
                    >
                      {busy && busyWorkspaceInviteAction === 'decline' ? (
                        <ActivityIndicator color="#ef4444" size="small" />
                      ) : (
                        <View className="flex-row items-center">
                          <X size={14} color="#ef4444" />
                          <Text className="text-red-400 font-bold ml-2">Reddet</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36]">
          <View className="flex-row items-center mb-3">
            <Bell size={17} color="#c6a87c" />
            <Text className="text-white font-semibold ml-2">Bildirimler</Text>
          </View>

          {loading ? (
            <ActivityIndicator color="#c6a87c" />
          ) : notifications.length === 0 ? (
            <Text className="text-gray-500">Henuz bildiriminiz yok.</Text>
          ) : (
            notifications.map((notification: any) => {
              const inviteMatch = notification.inviteId ? pendingInviteMap.get(notification.inviteId) : null;
              return (
                <TouchableOpacity
                  key={notification.id}
                  className={`p-3 rounded-xl border mb-2 ${notification.read ? 'bg-[#0f1115] border-[#2a2d36]' : 'bg-[#131821] border-[#c6a87c]/30'}`}
                  onPress={() => openNotificationProject(notification)}
                  activeOpacity={0.8}
                >
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1 pr-3">
                      <Text className="text-white font-semibold">{notification.title || 'Bildirim'}</Text>
                      <Text className="text-gray-400 mt-1 text-xs">{notification.body || 'Detay bulunamadi.'}</Text>
                      <View className="flex-row items-center mt-2">
                        <Clock3 size={12} color="#6b7280" />
                        <Text className="text-gray-500 text-xs ml-1">{formatDate(notification.createdAt)}</Text>
                      </View>
                    </View>

                    {!notification.read ? (
                      <TouchableOpacity
                        className="bg-[#c6a87c]/20 border border-[#c6a87c]/40 px-2 py-1 rounded-md"
                        onPress={() => markAsRead(notification.id)}
                      >
                        <Text className="text-[#c6a87c] text-xs font-semibold">Okundu</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {notification.projectId ? (
                    <View className="flex-row items-center mt-3">
                      <FolderOpen size={14} color="#c6a87c" />
                      <Text className="text-[#c6a87c] text-xs ml-2">Projeyi ac</Text>
                    </View>
                  ) : null}

                  {inviteMatch ? (
                    <Text className="text-amber-300 text-xs mt-2">Bu bildirim icin bekleyen davetiniz var.</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {!hasContent && !loading && !inviteLoading && !workspaceLoading ? (
          <Text className="text-gray-500 text-center mt-5">Inbox su anda bos.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
