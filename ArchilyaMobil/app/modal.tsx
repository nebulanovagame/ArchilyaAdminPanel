import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useProjects } from '../src/hooks/useProjects';

export default function NewProjectModal() {
  const router = useRouter();
  const { addProject } = useProjects();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateProject = async () => {
    if (!name.trim()) {
      Alert.alert('Hata', 'Proje adi zorunludur.');
      return;
    }

    setCreating(true);
    try {
      await addProject({
        name: name.trim(),
        location: location.trim(),
        status: 'Aktif',
      });
      router.back();
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Proje olusturulamadi.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0f1115]" style={{ paddingTop: Platform.OS === 'android' ? 36 : 0 }}>
      <View className="flex-1 px-4 pt-4">
        <View className="flex-row items-center mb-5">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 bg-[#1a1c23] p-2 rounded-lg" accessibilityRole="button" accessibilityLabel="Geri">
            <ArrowLeft size={18} color="#c6a87c" />
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold">Yeni Proje</Text>
        </View>

        <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36]">
          <Text className="text-gray-400 mb-2">Proje Adi</Text>
          <TextInput
            className="bg-[#0f1115] text-white p-3 rounded-xl border border-[#2a2d36] mb-3"
            placeholder="Proje adi"
            placeholderTextColor="#4b5563"
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <Text className="text-gray-400 mb-2">Konum (opsiyonel)</Text>
          <TextInput
            className="bg-[#0f1115] text-white p-3 rounded-xl border border-[#2a2d36]"
            placeholder="Konum"
            placeholderTextColor="#4b5563"
            value={location}
            onChangeText={setLocation}
          />

          <TouchableOpacity className="bg-[#c6a87c] p-3 rounded-xl items-center mt-4" onPress={handleCreateProject} disabled={creating} accessibilityRole="button" accessibilityLabel={creating ? 'Olusturuluyor' : 'Projeyi Olustur'}>
            {creating ? <ActivityIndicator color="#0f1115" /> : <Text className="text-[#0f1115] font-bold">Projeyi Olustur</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
