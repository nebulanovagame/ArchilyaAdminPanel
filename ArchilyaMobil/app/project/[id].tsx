import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import * as FileSystem from 'expo-file-system/legacy';
import { ArrowLeft, Mail, Pencil, RefreshCw, Trash2, UserPlus, Users } from 'lucide-react-native';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/context/AuthContext';
import { captureImageWithCamera, pickImageFromLibrary, pickProjectFileFromDocument } from '../../src/services/mediaService';
import { captureException } from '../../src/services/errorTracking';
import { useInvitations } from '../../src/hooks/useInvitations';
import { createR2DownloadUrlSecure } from '../../src/services/r2StorageService';
import {
  formatFileSize,
  isImageFileLike,
  resolveMimeTypeFromFile,
} from '../../src/utils/fileUtils';
import {
  buildFolderMap,
  buildFolderPath,
  getChildFolders,
  normalizeFolderId,
} from '../../src/utils/projectFileTree';
import {
  createProjectFolderSecure,
  moveProjectFileToTrashSecure,
  updateProjectSecure,
} from '../../src/services/entitlementService';
import { trackEvent } from '../../src/services/analyticsService';
import {
  drainProjectUploadQueue,
  enqueueProjectUpload,
  listProjectUploadQueue,
  subscribeProjectUploadQueue,
} from '../../src/services/projectUploadQueue';

function createFolderId() {
  return `fld_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function extractR2ObjectKey(value = '') {
  const raw = String(value || '').trim();
  if (!raw.toLowerCase().startsWith('r2://')) {
    return '';
  }
  return raw.replace(/^r2:\/\//i, '').trim();
}

export default function ProjectDetailScreen() {
  const { id, folderId: routeFolderId } = useLocalSearchParams<{ id: string; folderId?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { sendInvite: sendProjectInvite } = useInvitations();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [folderName, setFolderName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [pendingUploadCount, setPendingUploadCount] = useState(0);
  const [renameTarget, setRenameTarget] = useState<{ type: 'file' | 'folder'; id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    if (!id) return;

    const unsub = onSnapshot(
      doc(db, 'projects', id),
      (snap) => {
        if (!snap.exists()) {
          setProject(null);
          setLoading(false);
          return;
        }

        setProject({ id: snap.id, ...snap.data() });
        setLoading(false);
      },
      (error) => {
        captureException(error, {
          scope: 'mobile_project_detail_snapshot',
          project_id: String(id || ''),
        });
        setLoading(false);
      }
    );

    return unsub;
  }, [id]);

  const files = useMemo(() => (Array.isArray(project?.files) ? project.files : []), [project]);
  const folders = useMemo(() => (Array.isArray(project?.folders) ? project.folders : []), [project]);
  const folderMap = useMemo<Map<string, any>>(() => {
    return buildFolderMap(folders);
  }, [folders]);
  const currentFolderPath = useMemo(() => buildFolderPath(selectedFolderId, folderMap), [folderMap, selectedFolderId]);
  const currentFolder = useMemo(() => (selectedFolderId ? folderMap.get(selectedFolderId) || null : null), [folderMap, selectedFolderId]);
  const childFolders = useMemo(() => {
    return getChildFolders(folders, selectedFolderId);
  }, [folders, selectedFolderId]);
  const visibleFiles = useMemo(() => {
    return files.filter((file: any) => normalizeFolderId(file?.folderId) === selectedFolderId);
  }, [files, selectedFolderId]);
  const imageFiles = useMemo(() => visibleFiles.filter((file: any) => isImageFileLike(file)), [visibleFiles]);
  const documentFiles = useMemo(() => visibleFiles.filter((file: any) => !isImageFileLike(file)), [visibleFiles]);
  const isOwner = project?.uid === user?.uid;

  useEffect(() => {
    const nextRouteFolderId = normalizeFolderId(routeFolderId);
    if (nextRouteFolderId && !folderMap.has(nextRouteFolderId)) {
      return;
    }

    setSelectedFolderId(nextRouteFolderId);
  }, [folderMap, routeFolderId]);

  useEffect(() => {
    if (selectedFolderId && !folderMap.has(selectedFolderId)) {
      setSelectedFolderId(null);
    }
  }, [folderMap, selectedFolderId]);

  const refreshPendingUploads = useCallback(async () => {
    if (!project?.id || !user?.uid) {
      setPendingUploadCount(0);
      return;
    }

    const items = await listProjectUploadQueue({
      projectId: project.id,
      userId: user.uid,
    });
    setPendingUploadCount(items.length);
  }, [project?.id, user?.uid]);

  useEffect(() => {
    void refreshPendingUploads();
    const unsubscribe = subscribeProjectUploadQueue(() => {
      void refreshPendingUploads();
    });
    return unsubscribe;
  }, [refreshPendingUploads]);

  const resolveFileAccessUrl = async (file: any, disposition: 'inline' | 'attachment' = 'attachment') => {
    const normalizedProvider = String(file?.storageProvider || '').toLowerCase();
    const resolvedObjectKey = String(file?.objectKey || '').trim() || extractR2ObjectKey(String(file?.url || ''));

    if (normalizedProvider === 'r2' && resolvedObjectKey) {
      const signed: any = await createR2DownloadUrlSecure({
        projectId: project.id,
        objectKey: resolvedObjectKey,
        fileName: file.name,
        disposition,
      });

      if (!signed?.success || !signed?.downloadUrl) {
        throw new Error('R2 dosya baglantisi olusturulamadi.');
      }

      return signed.downloadUrl;
    }

    return file.url;
  };

  const retryQueuedUploads = async () => {
    if (!user?.uid) return;

    try {
      await drainProjectUploadQueue({
        userId: user.uid,
        projectId: project?.id,
        reason: 'project_manual_retry',
      });
    } catch (error) {
      captureException(error, {
        scope: 'mobile_project_manual_queue_retry',
        project_id: String(project?.id || ''),
      });
      Alert.alert('Hata', 'Kuyruktaki yuklemeler tekrar baslatilamadi.');
    }
  };

  const queueUpload = async (asset: { uri: string; name: string; mimeType?: string | null; size?: number | null }) => {
    if (!project?.id || !user?.uid) return;

    await enqueueProjectUpload({
      asset,
      projectId: project.id,
      userId: user.uid,
      folderId: selectedFolderId,
    });

    void trackEvent('file_upload_queued', {
      project_id: project.id,
      folder_id: selectedFolderId || 'root',
    });

    await refreshPendingUploads();
    void drainProjectUploadQueue({
      userId: user.uid,
      projectId: project.id,
      reason: 'project_enqueue',
    });
  };

  const handleUpload = async (source: 'camera' | 'gallery' | 'document') => {
    if (!project?.id) return;

    setUploading(true);
    try {
      let picked = null;

      if (source === 'camera') {
        picked = await captureImageWithCamera();
      } else if (source === 'gallery') {
        picked = await pickImageFromLibrary();
      } else {
        picked = await pickProjectFileFromDocument();
      }

      if (!picked) return;

      await queueUpload(picked);
      Alert.alert('Bilgi', 'Dosya yukleme kuyruguna eklendi. Baglanti oldugunda otomatik tamamlanacak.');
    } catch (err: any) {
      captureException(err, {
        scope: 'mobile_file_upload_queue',
        source,
        project_id: String(project?.id || ''),
      });
      Alert.alert('Hata', err?.message || 'Dosya kuyruga eklenemedi.');
    } finally {
      setUploading(false);
    }
  };

  const createFolder = async () => {
    if (!project?.id) return;
    if (!folderName.trim()) {
      Alert.alert('Hata', 'Klasor adi zorunludur.');
      return;
    }

    setCreatingFolder(true);
    try {
      const requestedName = folderName.trim();
      const result: any = await createProjectFolderSecure(project.id, requestedName, createFolderId());
      if (!result?.success || !result?.folder?.id) {
        throw new Error(result?.message || 'Klasor olusturulamadi.');
      }

      const createdFolderId = String(result.folder.id);
      const nextFolders = [
        ...folders.filter((folder: any) => String(folder?.id || '').trim() !== createdFolderId),
        {
          ...(result.folder || {}),
          id: createdFolderId,
          name: String(result.folder?.name || requestedName),
          parentFolderId: selectedFolderId,
        },
      ];

      const updateResult = await updateProjectSecure(project.id, { folders: nextFolders });
      if (!updateResult?.success) {
        throw new Error(updateResult?.message || 'Klasor yapisi guncellenemedi.');
      }

      setFolderName('');
      setSelectedFolderId(createdFolderId);
    } catch (err: any) {
      captureException(err, {
        scope: 'mobile_project_create_folder',
        project_id: String(project?.id || ''),
        parent_folder_id: selectedFolderId || 'root',
      });
      Alert.alert('Hata', err?.message || 'Klasor olusturulamadi.');
    } finally {
      setCreatingFolder(false);
    }
  };

  const openRename = (type: 'file' | 'folder', target: any) => {
    const targetId = String(target?.id || target?.url || '').trim();
    if (!targetId) return;

    setRenameTarget({
      type,
      id: targetId,
      name: String(target?.name || '').trim(),
    });
    setRenameValue(String(target?.name || '').trim());
  };

  const submitRename = async () => {
    if (!renameTarget || !project?.id) return;

    const nextName = renameValue.trim();
    if (!nextName) {
      Alert.alert('Hata', 'Yeni ad zorunludur.');
      return;
    }

    setRenaming(true);
    try {
      if (renameTarget.type === 'folder') {
        const nextFolders = folders.map((folder: any) => {
          if (String(folder?.id || '').trim() !== renameTarget.id) {
            return folder;
          }

          return {
            ...folder,
            name: nextName,
          };
        });

        const result = await updateProjectSecure(project.id, { folders: nextFolders });
        if (!result?.success) {
          throw new Error(result?.message || 'Klasor yeniden adlandirilamadi.');
        }
      } else {
        const nextFiles = files.map((file: any) => {
          const candidateId = String(file?.url || file?.objectKey || '').trim();
          if (candidateId !== renameTarget.id) {
            return file;
          }

          return {
            ...file,
            name: nextName,
          };
        });

        const result = await updateProjectSecure(project.id, { files: nextFiles });
        if (!result?.success) {
          throw new Error(result?.message || 'Dosya yeniden adlandirilamadi.');
        }
      }

      setRenameTarget(null);
      setRenameValue('');
    } catch (error: any) {
      captureException(error, {
        scope: 'mobile_project_rename',
        project_id: String(project?.id || ''),
        entity_type: renameTarget.type,
      });
      Alert.alert('Hata', error?.message || 'Yeniden adlandirma basarisiz oldu.');
    } finally {
      setRenaming(false);
    }
  };

  const openFile = async (file: any) => {
    if (!file?.url && !file?.objectKey) {
      Alert.alert('Hata', 'Dosya baglantisi bulunamadi.');
      return;
    }

    try {
      const folderPathLabel = currentFolderPath.map((folder: any) => String(folder?.name || '')).filter(Boolean).join(' / ');
      router.push({
        pathname: '/file-preview',
        params: {
          url: file.url,
          name: file.name || 'Dosya',
          type: file.type || '',
          size: String(file.size || 0),
          projectId: String(project?.id || ''),
          storageProvider: String(file.storageProvider || ''),
          objectKey: String(file.objectKey || extractR2ObjectKey(String(file.url || '')) || ''),
          folderId: String(file.folderId || ''),
          folderPath: folderPathLabel,
        },
      });
    } catch (error) {
      captureException(error, {
        scope: 'mobile_project_open_preview',
        project_id: String(project?.id || ''),
      });
      Alert.alert('Hata', 'Dosya onizleme acilamadi.');
    }
  };

  const shareFile = async (file: any) => {
    if (!file?.url && !file?.objectKey) {
      Alert.alert('Hata', 'Paylasilacak dosya baglantisi bulunamadi.');
      return;
    }

    try {
      const accessUrl = await resolveFileAccessUrl(file, 'attachment');
      await Share.share({
        message: `${file.name || 'Dosya'}\n${accessUrl}`,
        url: accessUrl,
      });
    } catch (error) {
      captureException(error, {
        scope: 'mobile_project_share_file',
        project_id: String(project?.id || ''),
      });
      Alert.alert('Hata', 'Dosya paylasilamadi.');
    }
  };

  const openFileInAi = (file: any) => {
    if (!file?.url && !file?.objectKey) {
      Alert.alert('Hata', 'AI icin dosya baglantisi bulunamadi.');
      return;
    }

    if (!isImageFileLike(file)) {
      Alert.alert('Bilgi', 'AI Studio sadece gorsel dosyalarla calisir.');
      return;
    }

    const mimeType = resolveMimeTypeFromFile(String(file?.type || ''), String(file?.name || ''));
    resolveFileAccessUrl(file, 'inline')
      .then((accessUrl) => {
        router.push({
          pathname: '/(tabs)/ai',
          params: {
            sourceImageUri: accessUrl,
            sourceImageName: file.name || 'ProjectImage',
            sourceImageMimeType: mimeType,
            sourceProjectId: String(project?.id || ''),
          },
        });
      })
      .catch((error) => {
        captureException(error, {
          scope: 'mobile_project_open_ai',
          project_id: String(project?.id || ''),
        });
        Alert.alert('Hata', 'AI icin dosya baglantisi olusturulamadi.');
      });
  };

  const deleteFile = (file: any) => {
    Alert.alert('Dosyayi Sil', `${file.name} cop kutusuna tasinsin mi?`, [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Tasi',
        style: 'destructive',
        onPress: async () => {
          try {
            const result = await moveProjectFileToTrashSecure(project.id, file.url);
            if (!result?.success) {
              throw new Error(result?.message || 'Dosya cop kutusuna tasinamadi.');
            }
          } catch (err: any) {
            captureException(err, {
              scope: 'mobile_project_delete_file',
              project_id: String(project?.id || ''),
            });
            Alert.alert('Hata', err?.message || 'Dosya silinemedi.');
          }
        },
      },
    ]);
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Hata', 'E-posta zorunludur.');
      return;
    }

    if (inviteEmail.trim().toLowerCase() === user?.email?.toLowerCase()) {
      Alert.alert('Hata', 'Kendinizi davet edemezsiniz.');
      return;
    }

    setInviting(true);
    try {
      await sendProjectInvite({
        toEmail: inviteEmail.trim(),
        projectId: project.id,
        projectName: project.name,
        role: 'member',
      });

      setInviteEmail('');
      Alert.alert('Basarili', 'Davet gonderildi.');
    } catch (err: any) {
      captureException(err, {
        scope: 'mobile_project_send_invite',
        project_id: String(project?.id || ''),
      });
      Alert.alert('Hata', err?.message || 'Davet gonderilemedi.');
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#0f1115] items-center justify-center">
        <ActivityIndicator color="#c6a87c" />
      </SafeAreaView>
    );
  }

  if (!project) {
    return (
      <SafeAreaView className="flex-1 bg-[#0f1115] items-center justify-center px-6">
        <Text className="text-white text-lg font-semibold mb-2">Proje bulunamadi</Text>
        <TouchableOpacity onPress={() => router.back()} className="bg-[#c6a87c] px-4 py-3 rounded-xl">
          <Text className="text-[#0f1115] font-bold">Geri Don</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0f1115]" style={{ paddingTop: Platform.OS === 'android' ? 36 : 0 }}>
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="flex-row items-center mb-4">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 bg-[#1a1c23] p-2 rounded-lg">
            <ArrowLeft size={18} color="#c6a87c" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-2xl font-bold">{project.name}</Text>
            {project.location ? <Text className="text-gray-400">{project.location}</Text> : null}
          </View>
        </View>

        <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-white font-semibold">Dosyalar ({visibleFiles.length}/{files.length})</Text>
            <Text className="text-gray-500 text-xs">Konum: {String(currentFolder?.name || 'Ana Klasor')}</Text>
          </View>

          {pendingUploadCount > 0 ? (
            <View className="bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] mb-3 flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-[#c6a87c] font-semibold">Yukleme kuyrugu aktif</Text>
                <Text className="text-gray-400 text-xs mt-1">{pendingUploadCount} dosya baglanti geldiginde otomatik yeniden denenecek.</Text>
              </View>
              <TouchableOpacity className="bg-[#1b2a3a] px-3 py-2 rounded-lg" onPress={retryQueuedUploads}>
                <View className="flex-row items-center">
                  <RefreshCw size={14} color="#9cc6ff" />
                  <Text className="text-[#9cc6ff] text-xs font-semibold ml-2">Simdi Dene</Text>
                </View>
              </TouchableOpacity>
            </View>
          ) : null}

          <View className="bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] mb-3">
            <Text className="text-gray-400 mb-2">Gezinme</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                className={`px-3 py-2 rounded-lg mr-2 border ${!selectedFolderId ? 'bg-[#c6a87c]/20 border-[#c6a87c]/40' : 'bg-[#1a1c23] border-[#2a2d36]'}`}
                onPress={() => setSelectedFolderId(null)}>
                <Text className={!selectedFolderId ? 'text-[#c6a87c] font-semibold' : 'text-white'}>Ana Klasor</Text>
              </TouchableOpacity>

              {currentFolderPath.map((folder: any) => (
                <TouchableOpacity
                  key={folder.id}
                  className={`px-3 py-2 rounded-lg mr-2 border ${selectedFolderId === folder.id ? 'bg-[#c6a87c]/20 border-[#c6a87c]/40' : 'bg-[#1a1c23] border-[#2a2d36]'}`}
                  onPress={() => setSelectedFolderId(folder.id)}>
                  <Text className={selectedFolderId === folder.id ? 'text-[#c6a87c] font-semibold' : 'text-white'}>{folder.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View className="bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] mb-3">
            <Text className="text-gray-400 mb-2">Yeni klasor</Text>
            <View className="flex-row">
              <TextInput
                className="flex-1 bg-[#1a1c23] text-white p-3 rounded-xl border border-[#2a2d36] mr-2"
                placeholder={selectedFolderId ? 'Bu klasor icin alt klasor adi' : 'Kok klasor adi'}
                placeholderTextColor="#4b5563"
                value={folderName}
                onChangeText={setFolderName}
              />
              <TouchableOpacity className="bg-[#c6a87c] px-3 rounded-xl items-center justify-center" onPress={createFolder} disabled={creatingFolder}>
                <Text className="text-[#0f1115] font-bold">{creatingFolder ? '...' : 'Ekle'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {renameTarget ? (
            <View className="bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] mb-3">
              <Text className="text-gray-400 mb-2">{renameTarget.type === 'folder' ? 'Klasoru Yeniden Adlandir' : 'Dosyayi Yeniden Adlandir'}</Text>
              <TextInput
                className="bg-[#1a1c23] text-white p-3 rounded-xl border border-[#2a2d36]"
                placeholder="Yeni ad"
                placeholderTextColor="#4b5563"
                value={renameValue}
                onChangeText={setRenameValue}
              />
              <View className="flex-row mt-3">
                <TouchableOpacity className="flex-1 bg-[#c6a87c] p-3 rounded-xl items-center mr-2" onPress={submitRename} disabled={renaming}>
                  <Text className="text-[#0f1115] font-bold">{renaming ? 'Kaydediliyor...' : 'Kaydet'}</Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-1 bg-[#1a1c23] border border-[#2a2d36] p-3 rounded-xl items-center" onPress={() => setRenameTarget(null)}>
                  <Text className="text-white font-semibold">Vazgec</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <View className="flex-row mb-3">
            <TouchableOpacity className="flex-1 bg-[#c6a87c] p-3 rounded-xl items-center mr-2" onPress={() => handleUpload('document')} disabled={uploading}>
              {uploading ? <ActivityIndicator color="#0f1115" /> : <Text className="text-[#0f1115] font-bold">Dosya</Text>}
            </TouchableOpacity>
            <TouchableOpacity className="flex-1 bg-[#0f1115] p-3 rounded-xl items-center border border-[#2a2d36] mr-2" onPress={() => handleUpload('gallery')} disabled={uploading}>
              <Text className="text-[#c6a87c] font-bold">Galeri</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-1 bg-[#0f1115] p-3 rounded-xl items-center border border-[#2a2d36]" onPress={() => handleUpload('camera')} disabled={uploading}>
              <Text className="text-[#c6a87c] font-bold">Kamera</Text>
            </TouchableOpacity>
          </View>

          {childFolders.length > 0 ? (
            <View className="mb-4">
              <Text className="text-gray-400 mb-2">Alt Klasorler</Text>
              {childFolders.map((folder: any) => {
                const nestedCount = files.filter((file: any) => normalizeFolderId(file?.folderId) === String(folder.id)).length;
                return (
                  <TouchableOpacity
                    key={folder.id}
                    className="bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] mb-2"
                    activeOpacity={0.88}
                    onPress={() => setSelectedFolderId(String(folder.id))}>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 pr-3">
                        <Text className="text-white font-semibold">{folder.name}</Text>
                        <Text className="text-gray-500 text-xs mt-1">{nestedCount} dosya • {folder.parentFolderId ? 'Alt klasor' : 'Kok klasor'}</Text>
                      </View>
                      <TouchableOpacity className="bg-[#25243d] px-3 py-2 rounded-lg" onPress={() => openRename('folder', folder)}>
                        <View className="flex-row items-center">
                          <Pencil size={14} color="#b9b4ff" />
                          <Text className="text-[#b9b4ff] text-xs font-semibold ml-2">Yeniden Adlandir</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {childFolders.length === 0 && visibleFiles.length === 0 ? (
            <Text className="text-gray-500">Bu klasorde henuz icerik bulunmuyor.</Text>
          ) : (
            <>
              {imageFiles.length > 0 ? (
                <View className="mb-4">
                  <Text className="text-gray-400 mb-2">Gorsel Onizlemeler</Text>
                  <View className="flex-row flex-wrap justify-between">
                    {imageFiles.map((file: any, idx: number) => (
                      <View key={`${file.url || file.objectKey}_${idx}`} className="w-[48%] bg-[#0f1115] p-2 rounded-xl border border-[#2a2d36] mb-3">
                        <TouchableOpacity onPress={() => openFile(file)} activeOpacity={0.85}>
                          {String(file.storageProvider || '').toLowerCase() === 'r2' ? (
                            <View className="w-full h-32 rounded-lg bg-[#1a1c23] border border-[#2a2d36] items-center justify-center">
                              <Text className="text-gray-400 text-xs">R2 Gorsel</Text>
                              <Text className="text-gray-500 text-[10px] mt-1">Onizleme icin Ac</Text>
                            </View>
                          ) : (
                            <Image source={{ uri: file.url }} className="w-full h-32 rounded-lg bg-[#1a1c23]" contentFit="cover" cachePolicy="memory-disk" />
                          )}
                        </TouchableOpacity>

                        <Text className="text-white text-xs font-semibold mt-2" numberOfLines={1}>{file.name}</Text>
                        <Text className="text-gray-500 text-[10px] mt-1">{formatFileSize(file.size)} • {(file.type || 'IMG').toUpperCase()}</Text>

                        <View className="flex-row mt-2">
                          <TouchableOpacity className="flex-1 bg-[#c6a87c]/15 rounded-md py-1 items-center mr-1" onPress={() => openFile(file)}>
                            <Text className="text-[#c6a87c] text-[10px] font-semibold">Onizle</Text>
                          </TouchableOpacity>
                          <TouchableOpacity className="flex-1 bg-[#25243d] rounded-md py-1 items-center mr-1" onPress={() => openFileInAi(file)}>
                            <Text className="text-[#b9b4ff] text-[10px] font-semibold">AI</Text>
                          </TouchableOpacity>
                          <TouchableOpacity className="flex-1 bg-[#1b2a3a] rounded-md py-1 items-center" onPress={() => shareFile(file)}>
                            <Text className="text-[#9cc6ff] text-[10px] font-semibold">Paylas</Text>
                          </TouchableOpacity>
                        </View>

                        <TouchableOpacity className="mt-2 bg-[#25243d] rounded-md py-1 items-center" onPress={() => openRename('file', file)}>
                          <Text className="text-[#b9b4ff] text-[10px] font-semibold">Yeniden Adlandir</Text>
                        </TouchableOpacity>

                        <TouchableOpacity className="mt-2 bg-red-500/10 rounded-md py-1 items-center" onPress={() => deleteFile(file)}>
                          <Text className="text-red-400 text-[10px] font-semibold">Cop Kutusuna Tasi</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {documentFiles.length > 0 ? (
                <View>
                  <Text className="text-gray-400 mb-2">Diger Dosyalar</Text>
                  {documentFiles.map((file: any, idx: number) => (
                    <View key={`${file.url || file.objectKey}_${idx}`} className="bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] mb-2">
                      <View className="flex-row justify-between items-center">
                        <View className="flex-1 pr-3">
                          <Text className="text-white font-medium">{file.name}</Text>
                          <Text className="text-gray-500 text-xs mt-1">{formatFileSize(file.size)} • {(file.type || 'DOC').toUpperCase()}</Text>
                        </View>
                        <View className="items-end">
                          <View className="flex-row items-center mb-2">
                            <TouchableOpacity className="bg-[#c6a87c]/15 px-3 py-2 rounded-lg mr-2" onPress={() => openFile(file)}>
                              <Text className="text-[#c6a87c] text-xs font-semibold">Ac</Text>
                            </TouchableOpacity>
                            <TouchableOpacity className="bg-[#1b2a3a] px-3 py-2 rounded-lg mr-2" onPress={() => shareFile(file)}>
                              <Text className="text-[#9cc6ff] text-xs font-semibold">Paylas</Text>
                            </TouchableOpacity>
                            <TouchableOpacity className="bg-red-500/10 px-3 py-2 rounded-lg" onPress={() => deleteFile(file)}>
                              <Trash2 size={15} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                          <TouchableOpacity className="bg-[#25243d] px-3 py-2 rounded-lg" onPress={() => openRename('file', file)}>
                            <Text className="text-[#b9b4ff] text-xs font-semibold">Yeniden Adlandir</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </View>

        {isOwner ? (
          <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36]">
            <View className="flex-row items-center mb-3">
              <Users size={18} color="#c6a87c" />
              <Text className="text-white font-semibold ml-2">Ekip ve Davet</Text>
            </View>
            <View className="bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] mb-3">
              <Text className="text-gray-400 mb-2">Davet e-postasi</Text>
              <TextInput
                className="bg-[#1a1c23] text-white p-3 rounded-lg border border-[#2a2d36]"
                placeholder="ornek@email.com"
                placeholderTextColor="#4b5563"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TouchableOpacity className="bg-[#c6a87c] mt-3 p-3 rounded-lg items-center" onPress={sendInvite} disabled={inviting}>
                {inviting ? (
                  <ActivityIndicator color="#0f1115" />
                ) : (
                  <View className="flex-row items-center">
                    <UserPlus size={15} color="#0f1115" />
                    <Text className="text-[#0f1115] font-bold ml-2">Davet Gonder</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View className="bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36]">
              <Text className="text-gray-400 mb-2">Takim Uyeleri</Text>
              {(project.team || []).map((member: any, idx: number) => (
                <View key={`${member.email}_${idx}`} className="flex-row items-center justify-between py-2 border-b border-[#2a2d36]">
                  <View className="flex-row items-center">
                    <Mail size={14} color="#6b7280" />
                    <Text className="text-white ml-2">{member.email}</Text>
                  </View>
                  <Text className="text-[#c6a87c] text-xs uppercase">{member.role}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
