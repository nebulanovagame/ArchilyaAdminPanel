import React, { useMemo, useState } from 'react';
import {
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
import { Clock, Folder, Plus, Search } from 'lucide-react-native';
import { useProjects } from '../../src/hooks/useProjects';
import ProjectCreateModal from '../../src/components/ProjectCreateModal';

export default function ProjectsScreen() {
  const { projects, addProject, deleteProject } = useProjects();
  const projectList = projects ?? [];
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const filteredProjects = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    if (!keyword) return projectList;
    return projectList.filter((p) => `${p.name || ''}`.toLowerCase().includes(keyword));
  }, [projectList, search]);

  const handleCreateProject = async (values: { name: string; location?: string }): Promise<boolean> => {
    setCreating(true);
    try {
      await addProject({
        name: values.name.trim(),
        location: values.location?.trim(),
        status: 'Aktif',
      });
      setShowAddModal(false);
      return true;
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Proje olusturulamadi.');
      return false;
    } finally {
      setCreating(false);
    }
  };

  const askDelete = (project: any) => {
    Alert.alert('Projeyi Cople', `${project.name} projesi cop kutusuna tasinacak.`, [
      { text: 'Vazgec', style: 'cancel' },
      {
        text: 'Tasi',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProject(project.id);
          } catch (err: any) {
            Alert.alert('Hata', err?.message || 'Proje tasinamadi.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0f1115]" style={{ paddingTop: Platform.OS === 'android' ? 36 : 0 }}>
      <View className="flex-1 px-4 pt-4">
        <View className="flex-row justify-between items-center mb-5 mt-2">
          <Text className="text-white text-3xl font-bold">Projelerim</Text>
          <TouchableOpacity className="w-11 h-11 bg-[#c6a87c] rounded-2xl items-center justify-center" onPress={() => setShowAddModal(true)}>
            <Plus size={23} color="#0f1115" />
          </TouchableOpacity>
        </View>

        <View className="bg-[#1a1c23] flex-row items-center px-4 py-3 rounded-2xl border border-[#2a2d36] mb-5">
          <Search size={19} color="#4b5563" />
          <TextInput
            placeholder="Proje ara..."
            placeholderTextColor="#4b5563"
            className="flex-1 text-white ml-3"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 20 }}>
          {filteredProjects.length === 0 ? (
            <View className="items-center py-20">
              <Folder size={58} color="#2a2d36" />
              <Text className="text-gray-500 mt-4 text-center">{search ? 'Sonuc bulunamadi' : 'Henuz proje bulunmuyor'}</Text>
            </View>
          ) : (
            filteredProjects.map((project) => (
              <TouchableOpacity key={project.id} className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-3" onPress={() => router.push(`/project/${project.id}`)}>
                <View className="flex-row justify-between items-center">
                  <View className="flex-1 pr-3">
                    <Text className="text-white font-bold text-lg">{project.name}</Text>
                    {project.location ? <Text className="text-gray-500 mt-1">{project.location}</Text> : null}
                    <View className="flex-row items-center mt-2">
                      <Clock size={12} color="#6b7280" />
                      <Text className="text-gray-500 text-xs ml-1">{project.updatedAt ? new Date(project.updatedAt).toLocaleDateString('tr-TR') : 'Bugun'}</Text>
                      <Text className="text-[#c6a87c] text-xs ml-3">{project.status || 'Aktif'}</Text>
                    </View>
                  </View>
                  <TouchableOpacity className="bg-red-500/10 px-3 py-2 rounded-lg" onPress={() => askDelete(project)}>
                    <Text className="text-red-400 font-semibold">Cop</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      <ProjectCreateModal
        visible={showAddModal}
        creating={creating}
        onCreate={handleCreateProject}
        onClose={() => setShowAddModal(false)}
      />
    </SafeAreaView>
  );
}
