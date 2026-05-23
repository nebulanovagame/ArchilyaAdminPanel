import React, { useEffect, useMemo, useState } from 'react';
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
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { doc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, ExternalLink, FolderOpen, Pencil, Share2, Wand2 } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { db } from '../src/config/firebase';
import {
  buildPdfViewerUrl,
  formatFileSize,
  getCategoryLabel,
  resolveFileCategory,
  resolveFileExtension,
  resolveMimeTypeFromFile,
} from '../src/utils/fileUtils';
import {
  buildFolderMap,
  buildFolderPath,
  normalizeFolderId,
} from '../src/utils/projectFileTree';
import { createR2DownloadUrlSecure } from '../src/services/r2StorageService';
import { captureException } from '../src/services/errorTracking';
import { updateProjectSecure } from '../src/services/entitlementService';

function extractR2ObjectKey(url: string) {
  const value = String(url || '').trim();
  if (!value.toLowerCase().startsWith('r2://')) {
    return '';
  }
  return value.replace(/^r2:\/\//i, '').trim();
}

export default function FilePreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    url?: string;
    name?: string;
    type?: string;
    projectId?: string;
    size?: string;
    storageProvider?: string;
    objectKey?: string;
    folderId?: string;
    folderPath?: string;
  }>();

  const sourceProjectId = String(params.projectId || '').trim();
  const initialFileUrl = String(params.url || '').trim();
  const initialObjectKey = String(params.objectKey || '').trim() || extractR2ObjectKey(initialFileUrl);
  const [sourceProject, setSourceProject] = useState<any>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [pdfLoadFailed, setPdfLoadFailed] = useState(false);
  const [resolvedFileUrl, setResolvedFileUrl] = useState('');
  const [resolvingUrl, setResolvingUrl] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    if (!sourceProjectId) return;

    const unsubscribe = onSnapshot(
      doc(db, 'projects', sourceProjectId),
      (snapshot) => {
        setSourceProject(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
      },
      (error) => {
        captureException(error, {
          scope: 'mobile_file_preview_project_snapshot',
          project_id: sourceProjectId,
        });
      }
    );

    return unsubscribe;
  }, [sourceProjectId]);

  const currentProjectFile = useMemo(() => {
    const projectFiles = Array.isArray(sourceProject?.files) ? sourceProject.files : [];
    return (
      projectFiles.find((file: any) => {
        const candidateUrl = String(file?.url || '').trim();
        const candidateObjectKey = String(file?.objectKey || '').trim() || extractR2ObjectKey(candidateUrl);

        if (initialObjectKey && candidateObjectKey === initialObjectKey) {
          return true;
        }

        return Boolean(initialFileUrl) && candidateUrl === initialFileUrl;
      }) || null
    );
  }, [initialFileUrl, initialObjectKey, sourceProject?.files]);

  const activeFileName = String(currentProjectFile?.name || params.name || 'Dosya').trim();
  const activeFileType = String(currentProjectFile?.type || params.type || '').toLowerCase();
  const activeStorageProvider = String(currentProjectFile?.storageProvider || params.storageProvider || '').trim().toLowerCase();
  const activeObjectKey = String(currentProjectFile?.objectKey || initialObjectKey || '').trim() || extractR2ObjectKey(String(currentProjectFile?.url || initialFileUrl));
  const activeSourceUrl = String(currentProjectFile?.url || initialFileUrl).trim();
  const parsedFileSize = Number(currentProjectFile?.size || params.size || 0);
  const fileSize = Number.isFinite(parsedFileSize) ? parsedFileSize : 0;
  const fileExt = resolveFileExtension(activeFileName, activeFileType, activeFileType);
  const sourceFolderId = normalizeFolderId(currentProjectFile?.folderId || params.folderId);
  const folderMap = useMemo<Map<string, any>>(() => {
    return buildFolderMap(Array.isArray(sourceProject?.folders) ? sourceProject.folders : []);
  }, [sourceProject?.folders]);
  const folderPath = useMemo(() => buildFolderPath(sourceFolderId, folderMap), [folderMap, sourceFolderId]);
  const folderPathLabel = useMemo(() => {
    if (folderPath.length > 0) {
      return folderPath.map((folder: any) => String(folder?.name || '')).filter(Boolean).join(' / ');
    }
    return String(params.folderPath || '').trim() || 'Ana Klasor';
  }, [folderPath, params.folderPath]);

  useEffect(() => {
    setRenameValue(activeFileName);
  }, [activeFileName]);

  useEffect(() => {
    setImageLoadFailed(false);
    setPdfLoadFailed(false);
  }, [activeFileName, activeObjectKey, activeSourceUrl, activeStorageProvider]);



  useEffect(() => {
    let active = true;

    const resolveUrl = async () => {
      if (activeStorageProvider !== 'r2') {
        if (active) {
          setResolvedFileUrl(activeSourceUrl);
          setResolvingUrl(false);
        }
        return;
      }

      if (!activeObjectKey || !sourceProjectId) {
        if (active) {
          setResolvedFileUrl('');
          setResolvingUrl(false);
        }
        return;
      }

      if (active) {
        setResolvingUrl(true);
      }

      try {
        const signed: any = await createR2DownloadUrlSecure({
          projectId: sourceProjectId,
          objectKey: activeObjectKey,
          fileName: activeFileName,
          disposition: 'inline',
        });

        if (!signed?.success || !signed?.downloadUrl) {
          throw new Error('R2 baglantisi olusturulamadi.');
        }

        if (active) {
          setResolvedFileUrl(String(signed.downloadUrl || '').trim());
        }
      } catch (error) {
        captureException(error, {
          scope: 'mobile_file_preview_resolve_url',
          project_id: sourceProjectId,
          storage_provider: activeStorageProvider,
        });
        if (active) {
          setResolvedFileUrl('');
        }
      } finally {
        if (active) {
          setResolvingUrl(false);
        }
      }
    };

    void resolveUrl();
    return () => {
      active = false;
    };
  }, [activeFileName, activeObjectKey, activeSourceUrl, activeStorageProvider, sourceProjectId]);

  const activeFileUrl = String(resolvedFileUrl || '').trim();



  const fileCategory = useMemo(() => resolveFileCategory(activeFileType, activeFileName), [activeFileName, activeFileType]);
  const fileCategoryLabel = useMemo(() => getCategoryLabel(fileCategory), [fileCategory]);
  const fileMimeType = useMemo(() => resolveMimeTypeFromFile(activeFileType, activeFileName), [activeFileName, activeFileType]);
  const isImage = fileCategory === 'image';
  const isPdf = fileCategory === 'pdf';
  const canPreviewPdfInline = isPdf && /^https?:\/\//i.test(activeFileUrl) && !pdfLoadFailed;

  const openInBrowser = async (urlToOpen = activeFileUrl) => {
    if (!urlToOpen) {
      Alert.alert('Hata', 'Dosya baglantisi bulunamadi.');
      return;
    }

    try {
      await WebBrowser.openBrowserAsync(urlToOpen);
    } catch (error) {
      captureException(error, {
        scope: 'mobile_file_preview_open_browser',
        project_id: sourceProjectId,
      });
      Alert.alert('Hata', 'Dosya acilamadi.');
    }
  };

  const openInSystem = async () => {
    if (!activeFileUrl) {
      Alert.alert('Hata', 'Dosya baglantisi bulunamadi.');
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(activeFileUrl);
      if (canOpen) {
        await Linking.openURL(activeFileUrl);
        return;
      }

      await openInBrowser(activeFileUrl);
    } catch (error) {
      captureException(error, {
        scope: 'mobile_file_preview_open_system',
        project_id: sourceProjectId,
      });
      Alert.alert('Hata', 'Dosya cihaz uygulamasi ile acilamadi.');
    }
  };

  const openPdfPreview = async () => {
    const pdfViewerUrl = buildPdfViewerUrl(activeFileUrl);
    await openInBrowser(pdfViewerUrl);
  };

  const shareFile = async () => {
    if (!activeFileUrl) {
      Alert.alert('Hata', 'Paylasim icin dosya baglantisi bulunamadi.');
      return;
    }

    try {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Bu cihazda guvenli dosya paylasimi desteklenmiyor.');
      }

      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) {
        throw new Error('Paylasim icin gecici dosya alani bulunamadi.');
      }

      const fallbackName = `file-${Date.now()}.${fileExt || 'bin'}`;
      const safeName = String(activeFileName || fallbackName).replace(/[^a-zA-Z0-9._-]/g, '_') || fallbackName;
      const targetUri = `${cacheDir}share-${Date.now()}-${safeName}`;
      const downloaded = await FileSystem.downloadAsync(activeFileUrl, targetUri);

      if (Number(downloaded?.status || 0) >= 400) {
        throw new Error('Paylasim dosyasi indirilemedi.');
      }

      await Sharing.shareAsync(downloaded.uri, {
        mimeType: fileMimeType,
        dialogTitle: 'Dosyayi Paylas',
      });
      await FileSystem.deleteAsync(downloaded.uri, { idempotent: true }).catch(() => null);
    } catch (err: any) {
      captureException(err, {
        scope: 'mobile_file_preview_share',
        project_id: sourceProjectId,
      });
      Alert.alert('Hata', err?.message || 'Dosya paylasilamadi.');
    }
  };

  const sendImageToAiStudio = () => {
    if (!isImage || !activeFileUrl) {
      Alert.alert('Bilgi', 'AI Studio sadece gorsel dosyalarla calisir.');
      return;
    }

    router.push({
      pathname: '/(tabs)/ai',
      params: {
        sourceImageUri: activeFileUrl,
        sourceImageName: activeFileName,
        sourceImageMimeType: fileMimeType,
        sourceProjectId: sourceProjectId,
      },
    });
  };

  const openContainingFolder = () => {
    if (!sourceProjectId) {
      Alert.alert('Hata', 'Kaynak proje bilgisi bulunamadi.');
      return;
    }

    router.replace({
      pathname: '/project/[id]',
      params: {
        id: sourceProjectId,
        ...(sourceFolderId ? { folderId: sourceFolderId } : {}),
      },
    });
  };

  const renameCurrentFile = async () => {
    if (!sourceProjectId || !sourceProject || !currentProjectFile) {
      Alert.alert('Hata', 'Dosya yeniden adlandirma bilgisi bulunamadi.');
      return;
    }

    const nextName = renameValue.trim();
    if (!nextName) {
      Alert.alert('Hata', 'Yeni dosya adi zorunludur.');
      return;
    }

    setRenaming(true);
    try {
      const nextFiles = (Array.isArray(sourceProject.files) ? sourceProject.files : []).map((file: any) => {
        const candidateUrl = String(file?.url || '').trim();
        const candidateObjectKey = String(file?.objectKey || '').trim() || extractR2ObjectKey(candidateUrl);
        const matchesByObjectKey = Boolean(activeObjectKey) && candidateObjectKey === activeObjectKey;
        const matchesByUrl = Boolean(activeSourceUrl) && candidateUrl === activeSourceUrl;

        if (!matchesByObjectKey && !matchesByUrl) {
          return file;
        }

        return {
          ...file,
          name: nextName,
        };
      });

      const result = await updateProjectSecure(sourceProjectId, { files: nextFiles });
      if (!result?.success) {
        throw new Error(result?.message || 'Dosya yeniden adlandirilamadi.');
      }

      Alert.alert('Basarili', 'Dosya adi guncellendi.');
    } catch (error: any) {
      captureException(error, {
        scope: 'mobile_file_preview_rename',
        project_id: sourceProjectId,
      });
      Alert.alert('Hata', error?.message || 'Dosya yeniden adlandirilamadi.');
    } finally {
      setRenaming(false);
    }
  };

  if (!activeSourceUrl && !activeObjectKey) {
    return (
      <SafeAreaView className="flex-1 bg-[#0f1115] items-center justify-center px-6">
        <Text className="text-white text-lg font-semibold">Dosya baglantisi bulunamadi.</Text>
        <TouchableOpacity onPress={() => router.back()} className="bg-[#c6a87c] px-4 py-3 rounded-xl mt-4">
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
          <View className="flex-1 pr-2">
            <Text className="text-white text-lg font-bold" numberOfLines={1}>
              {activeFileName}
            </Text>
            <Text className="text-gray-500 text-xs mt-1">Kategori: {fileCategoryLabel}</Text>
            <Text className="text-gray-500 text-xs mt-1">Klasor: {folderPathLabel}</Text>
          </View>
        </View>

        <View className="flex-row mb-3">
          <TouchableOpacity className="flex-1 bg-[#1a1c23] border border-[#2a2d36] rounded-xl p-3 items-center mr-2" onPress={openInSystem}>
            <View className="flex-row items-center">
              <ExternalLink size={15} color="#c6a87c" />
              <Text className="text-[#c6a87c] font-semibold ml-2">Cihazda Ac</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity className="flex-1 bg-[#1a1c23] border border-[#2a2d36] rounded-xl p-3 items-center" onPress={() => openInBrowser()}>
            <View className="flex-row items-center">
              <ExternalLink size={15} color="#9cc6ff" />
              <Text className="text-[#9cc6ff] font-semibold ml-2">Tarayicida Ac</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View className="flex-row mb-4">
          <TouchableOpacity className={`bg-[#1a1c23] border border-[#2a2d36] rounded-xl p-3 items-center ${isPdf ? 'flex-1 mr-2' : 'flex-1 mr-2'}`} onPress={shareFile}>
            <View className="flex-row items-center">
              <Share2 size={15} color="#9cc6ff" />
              <Text className="text-[#9cc6ff] font-semibold ml-2">Paylas</Text>
            </View>
          </TouchableOpacity>

          {isPdf ? (
            <TouchableOpacity className="flex-1 bg-[#1a1c23] border border-[#2a2d36] rounded-xl p-3 items-center" onPress={openPdfPreview}>
              <Text className="text-[#c6a87c] font-semibold">PDF Onizleme</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity className="flex-1 bg-[#1a1c23] border border-[#2a2d36] rounded-xl p-3 items-center" onPress={openContainingFolder}>
              <View className="flex-row items-center">
                <FolderOpen size={15} color="#c6a87c" />
                <Text className="text-[#c6a87c] font-semibold ml-2">Klasore Git</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {isPdf ? (
          <TouchableOpacity className="bg-[#1a1c23] border border-[#2a2d36] rounded-xl p-3 items-center mb-4" onPress={openContainingFolder}>
            <View className="flex-row items-center">
              <FolderOpen size={15} color="#c6a87c" />
              <Text className="text-[#c6a87c] font-semibold ml-2">Bulundugu Klasoru Ac</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {currentProjectFile ? (
          <View className="bg-[#1a1c23] p-3 rounded-xl border border-[#2a2d36] mb-4">
            <View className="flex-row items-center mb-2">
              <Pencil size={15} color="#b9b4ff" />
              <Text className="text-white font-semibold ml-2">Dosyayi Yeniden Adlandir</Text>
            </View>
            <TextInput
              className="bg-[#0f1115] text-white p-3 rounded-xl border border-[#2a2d36]"
              placeholder="Yeni dosya adi"
              placeholderTextColor="#4b5563"
              value={renameValue}
              onChangeText={setRenameValue}
            />
            <TouchableOpacity className="bg-[#25243d] mt-3 p-3 rounded-xl items-center" onPress={renameCurrentFile} disabled={renaming}>
              <Text className="text-[#b9b4ff] font-semibold">{renaming ? 'Kaydediliyor...' : 'Adi Guncelle'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {resolvingUrl ? (
          <View className="bg-[#1a1c23] p-3 rounded-xl border border-[#2a2d36] mb-4 flex-row items-center justify-center">
            <ActivityIndicator color="#c6a87c" />
            <Text className="text-gray-300 ml-2 text-xs">Guvenli dosya baglantisi hazirlaniyor...</Text>
          </View>
        ) : null}

        {!resolvingUrl && !activeFileUrl ? (
          <View className="bg-red-500/10 p-3 rounded-xl border border-red-500/30 mb-4">
            <Text className="text-red-300 text-xs">Dosya baglantisi olusturulamadi. Lutfen tekrar deneyin.</Text>
          </View>
        ) : null}

        {isImage ? (
          <View className="bg-black p-3 rounded-2xl border border-[#2a2d36]">
            {activeFileUrl && !imageLoadFailed ? (
              <Image
                source={{ uri: activeFileUrl }}
                className="w-full h-[560px] rounded-xl"
                contentFit="contain"
                cachePolicy="memory-disk"
                priority="high"
                onError={() => setImageLoadFailed(true)}
              />
            ) : (
              <View className="h-[360px] rounded-xl items-center justify-center bg-[#1a1c23]">
                <Text className="text-gray-300 text-center">Gorsel uygulama icinde yuklenemedi.</Text>
                <Text className="text-gray-500 text-xs text-center mt-2">Cihazda Ac veya Tarayicida Ac seceneklerini kullanabilirsiniz.</Text>
              </View>
            )}

            <View className="bg-[#0f1115] border border-[#2a2d36] rounded-xl p-3 mt-3">
              <Text className="text-gray-400 text-xs">Dosya Bilgisi</Text>
              <Text className="text-white text-sm mt-1" numberOfLines={2}>
                {activeFileName}
              </Text>
              <Text className="text-gray-500 text-xs mt-1">Tip: {(activeFileType || fileExt || 'image').toUpperCase()}</Text>
              <Text className="text-gray-500 text-xs mt-1">Boyut: {formatFileSize(fileSize)}</Text>
            </View>

            <TouchableOpacity className="mt-3 bg-[#0f1115] border border-[#2a2d36] rounded-xl p-3 items-center" onPress={sendImageToAiStudio}>
              <View className="flex-row items-center">
                <Wand2 size={15} color="#c6a87c" />
                <Text className="text-[#c6a87c] font-semibold ml-2">AI Studio'ya Gonder</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : isPdf ? (
          <View className="bg-black p-3 rounded-2xl border border-[#2a2d36]">
            {canPreviewPdfInline ? (
              <View className="h-[560px] rounded-xl overflow-hidden bg-[#0f1115]">
                <WebView
                  source={{ uri: buildPdfViewerUrl(activeFileUrl) }}
                  style={{ flex: 1 }}
                  originWhitelist={['*']}
                  startInLoadingState
                  renderLoading={() => (
                    <View className="items-center justify-center mt-6">
                      <ActivityIndicator color="#c6a87c" />
                    </View>
                  )}
                  onError={() => setPdfLoadFailed(true)}
                />
              </View>
            ) : (
              <View className="h-[220px] rounded-xl items-center justify-center bg-[#1a1c23] px-4">
                <Text className="text-gray-300 text-center">PDF uygulama icinde onizlenemedi.</Text>
                <Text className="text-gray-500 text-xs text-center mt-2">Tarayicida Ac secenegi ile onizlemeye devam edebilirsiniz.</Text>
                <TouchableOpacity className="mt-4 bg-[#0f1115] border border-[#2a2d36] rounded-lg px-4 py-2" onPress={openPdfPreview}>
                  <Text className="text-[#c6a87c] font-semibold">Tarayicida PDF Ac</Text>
                </TouchableOpacity>
              </View>
            )}

            <View className="bg-[#0f1115] border border-[#2a2d36] rounded-xl p-3 mt-3">
              <Text className="text-gray-400 text-xs">Dosya Bilgisi</Text>
              <Text className="text-white text-sm mt-1" numberOfLines={2}>
                {activeFileName}
              </Text>
              <Text className="text-gray-500 text-xs mt-1">Tip: {(activeFileType || fileExt || 'pdf').toUpperCase()}</Text>
              <Text className="text-gray-500 text-xs mt-1">Boyut: {formatFileSize(fileSize)}</Text>
            </View>
          </View>
        ) : (
          <View className="bg-[#1a1c23] p-5 rounded-2xl border border-[#2a2d36]">
            <Text className="text-white font-semibold text-lg">Bu dosya turu uygulama icinde sinirli onizleniyor.</Text>
            <Text className="text-gray-400 mt-2">
              PDF, CAD, video ve diger dokumanlar icin Cihazda Ac veya Tarayicida Ac secenegini kullanabilirsiniz.
            </Text>

            <View className="bg-[#0f1115] border border-[#2a2d36] rounded-xl p-3 mt-4">
              <Text className="text-gray-400 text-xs">Dosya Bilgisi</Text>
              <Text className="text-white text-sm mt-1" numberOfLines={2}>
                {activeFileName}
              </Text>
              <Text className="text-gray-500 text-xs mt-1">Kategori: {fileCategoryLabel}</Text>
              <Text className="text-gray-500 text-xs mt-1">Uzanti: {(fileExt || 'bilinmiyor').toUpperCase()}</Text>
              <Text className="text-gray-500 text-xs mt-1">Boyut: {formatFileSize(fileSize)}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
