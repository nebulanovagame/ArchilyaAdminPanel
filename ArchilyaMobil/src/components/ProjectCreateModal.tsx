import React from 'react';
import { Alert, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { projectCreateSchema, type ProjectCreateFormValues } from '../schemas/formSchemas';

type ProjectCreateModalProps = {
  visible: boolean;
  creating: boolean;
  onCreate: (values: ProjectCreateFormValues) => Promise<boolean>;
  onClose: () => void;
};

export default function ProjectCreateModal({
  visible,
  creating,
  onCreate,
  onClose,
}: ProjectCreateModalProps) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<ProjectCreateFormValues>({
    resolver: zodResolver(projectCreateSchema),
    defaultValues: { name: '', location: '' },
  });

  const onSubmit = async (values: ProjectCreateFormValues) => {
    try {
      const ok = await onCreate(values);
      if (ok) {
        reset({ name: '', location: '' });
      }
    } catch {
      Alert.alert('Hata', 'Proje olusturulamadi.');
    }
  };

  const isLoading = creating || isSubmitting;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-[#1a1c23] rounded-t-3xl p-5 border-t border-[#2a2d36]">
          <Text className="text-white text-xl font-bold mb-4">Yeni Proje</Text>

          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className="bg-[#0f1115] text-white p-4 rounded-xl border border-[#2a2d36] mb-3"
                placeholder="Proje adi"
                placeholderTextColor="#4b5563"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoFocus
              />
            )}
          />

          <Controller
            control={control}
            name="location"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className="bg-[#0f1115] text-white p-4 rounded-xl border border-[#2a2d36] mb-4"
                placeholder="Konum (opsiyonel)"
                placeholderTextColor="#4b5563"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />

          <TouchableOpacity
            className="bg-[#c6a87c] p-4 rounded-xl items-center mb-3"
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel={isLoading ? 'Olusturuluyor' : 'Projeyi Olustur'}
          >
            <Text className="text-[#0f1115] font-bold">
              {isLoading ? 'Olusturuluyor...' : 'Projeyi Olustur'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity className="p-3 items-center" onPress={onClose} accessibilityRole="button" accessibilityLabel="Vazgec">
            <Text className="text-gray-400">Vazgec</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
