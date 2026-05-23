import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { db, storage } from '../src/config/firebase';
import { useAuth } from '../src/context/AuthContext';
import { useProjects } from '../src/hooks/useProjects';
import { deleteR2ObjectSecure } from '../src/services/r2StorageService';
import { permanentlyDeleteProjectFileSecure, restoreProjectFileSecure } from '../src/services/entitlementService';

export default function TrashScreen() {
  const { user } = useAuth();
  const { hardDeleteProject, restoreProject } = useProjects();
  const router = useRouter();
  const [deletedProjects, setDeletedProjects] = useState<any[]>([]);
  const [activeProjectsWithDeletedFiles, setActiveProjectsWithDeletedFiles] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    let ownerDocs: any[] = [];
    let memberDocs: any[] = [];

    const sync = (a: any[], b: any[]) => {
      const map = new Map();
      [...a, ...b].forEach((d) => map.set(d.id, d));
      const all = [...map.values()].map((d: any) => ({ id: d.id, ...d.data() }));
      setDeletedProjects(all.filter((p) => p.isDeleted && p.uid === user.uid));
      setActiveProjectsWithDeletedFiles(all.filter((p) => !p.isDeleted && (p.deletedFiles || []).length > 0));
    };

    const ownerQ = query(collection(db, 'projects'), where('ownerId', '==', user.uid));
    const memberQ = query(collection(db, 'projects'), where('memberUids', 'array-contains', user.uid));

    const unsubOwner = onSnapshot(ownerQ, (snap) => {
      ownerDocs = snap.docs;
      sync(ownerDocs, memberDocs);
    });

    const unsubMember = onSnapshot(memberQ, (snap) => {
      memberDocs = snap.docs;
      sync(ownerDocs, memberDocs);
    });

    return () => {
      unsubOwner();
      unsubMember();
    };
  }, [user]);

  const allDeletedFiles = useMemo(() => {
    return activeProjectsWithDeletedFiles.flatMap((p) =>
      (p.deletedFiles || []).map((f: any) => ({ ...f, projectId: p.id, projectName: p.name }))
    );
  }, [activeProjectsWithDeletedFiles]);

  const restoreFile = async (file: any) => {
    try {
      const result = await restoreProjectFileSecure(file.projectId, file.url);
      if (!result?.success) {
        throw new Error(result?.message || 'Dosya geri yuklenemedi.');
      }
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Dosya geri yuklenemedi.');
    }
  };

  const permanentlyDeleteFile = async (file: any) => {
    Alert.alert('Kalici Sil', `${file.name} kalici olarak silinsin mi?`, [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            const normalizedProvider = String(file.storageProvider || '').toLowerCase();

            if (normalizedProvider === 'r2' && file.objectKey) {
              await deleteR2ObjectSecure({
                projectId: file.projectId,
                objectKey: file.objectKey,
              }).catch(() => null);
            } else if (file.path) {
              await deleteObject(ref(storage, file.path)).catch(() => null);
            }

            const result = await permanentlyDeleteProjectFileSecure(file.projectId, file.url);
            if (!result?.success) {
              throw new Error(result?.message || 'Kalici silme basarisiz.');
            }
          } catch (err: any) {
            Alert.alert('Hata', err?.message || 'Kalici silme basarisiz.');
          }
        },
      },
    ]);
  };

  const permanentlyDeleteProject = async (project: any) => {
    Alert.alert('Kalici Sil', `${project.name} ve tum dosyalari kalici olarak silinsin mi?`, [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            const allFiles = [...(project.files || []), ...(project.deletedFiles || [])];
            for (const file of allFiles) {
              if (String(file.storageProvider || '').toLowerCase() === 'r2' && file.objectKey) {
                await deleteR2ObjectSecure({
                  projectId: project.id,
                  objectKey: file.objectKey,
                }).catch(() => null);
              } else if (file.path) {
                await deleteObject(ref(storage, file.path)).catch(() => null);
              }
            }
            await hardDeleteProject(project.id);
          } catch (err: any) {
            Alert.alert('Hata', err?.message || 'Proje silinemedi.');
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
          <Text className="text-white text-2xl font-bold">Cop Kutusu</Text>
        </View>

        <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
          <Text className="text-white font-semibold mb-3">Silinmis Projeler ({deletedProjects.length})</Text>
          {deletedProjects.length === 0 ? (
            <Text className="text-gray-500">Silinmis proje yok.</Text>
          ) : (
            deletedProjects.map((project) => (
              <View key={project.id} className="bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] mb-2">
                <Text className="text-white font-medium">{project.name}</Text>
                <View className="flex-row mt-3">
                  <TouchableOpacity className="bg-[#c6a87c] px-3 py-2 rounded-lg mr-2" onPress={() => restoreProject(project.id)}>
                    <View className="flex-row items-center">
                      <RotateCcw size={14} color="#0f1115" />
                      <Text className="text-[#0f1115] font-bold ml-2">Geri Yukle</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity className="bg-red-500/10 px-3 py-2 rounded-lg" onPress={() => permanentlyDeleteProject(project)}>
                    <View className="flex-row items-center">
                      <Trash2 size={14} color="#ef4444" />
                      <Text className="text-red-400 font-bold ml-2">Kalici Sil</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36]">
          <Text className="text-white font-semibold mb-3">Silinmis Dosyalar ({allDeletedFiles.length})</Text>
          {allDeletedFiles.length === 0 ? (
            <Text className="text-gray-500">Silinmis dosya yok.</Text>
          ) : (
            allDeletedFiles.map((file, idx) => (
              <View key={`${file.url}_${idx}`} className="bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] mb-2">
                <Text className="text-white font-medium">{file.name}</Text>
                <Text className="text-gray-500 text-xs mt-1">{file.projectName}</Text>
                <View className="flex-row mt-3">
                  <TouchableOpacity className="bg-[#c6a87c] px-3 py-2 rounded-lg mr-2" onPress={() => restoreFile(file)}>
                    <Text className="text-[#0f1115] font-bold">Geri Yukle</Text>
                  </TouchableOpacity>
                  <TouchableOpacity className="bg-red-500/10 px-3 py-2 rounded-lg" onPress={() => permanentlyDeleteFile(file)}>
                    <Text className="text-red-400 font-bold">Kalici Sil</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
