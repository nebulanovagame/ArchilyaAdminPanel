import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

type SaveMode = 'new' | 'version';

type ProjectLike = {
  id: string;
  name: string;
  folders?: Array<{ id: string; name: string }>;
  files?: Array<{ name?: string; type?: string }>;
};

type SavePayload = {
  projectId: string;
  folderTarget: string;
  saveMode: SaveMode;
  fileName: string;
  versionTargetName: string;
};

type AiSaveResultModalProps = {
  visible: boolean;
  saving: boolean;
  projects: ProjectLike[];
  initialProjectId: string;
  defaultFileName: string;
  onClose: () => void;
  onSubmit: (payload: SavePayload) => void;
};

const AUTO_FOLDER_TARGET = '__ai_outputs_auto__';

function isImageType(type: string) {
  const normalized = String(type || '').toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(normalized);
}

export default function AiSaveResultModal({
  visible,
  saving,
  projects,
  initialProjectId,
  defaultFileName,
  onClose,
  onSubmit,
}: AiSaveResultModalProps) {
  const [projectId, setProjectId] = useState('');
  const [saveMode, setSaveMode] = useState<SaveMode>('new');
  const [folderTarget, setFolderTarget] = useState(AUTO_FOLDER_TARGET);
  const [fileName, setFileName] = useState('');
  const [versionTargetName, setVersionTargetName] = useState('');

  useEffect(() => {
    if (!visible) return;

    const fallbackProjectId = initialProjectId || projects[0]?.id || '';
    setProjectId(fallbackProjectId);
    setSaveMode('new');
    setFolderTarget(AUTO_FOLDER_TARGET);
    setFileName(defaultFileName || 'ai-output.png');
    setVersionTargetName('');
  }, [visible, initialProjectId, defaultFileName, projects]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) || null,
    [projects, projectId]
  );

  const folders = selectedProject?.folders || [];
  const versionCandidates = useMemo(
    () => (selectedProject?.files || []).filter((file) => isImageType(String(file?.type || ''))),
    [selectedProject]
  );

  const submit = () => {
    if (!projectId) return;
    if (saveMode === 'new' && !String(fileName || '').trim()) return;
    if (saveMode === 'version' && !versionTargetName) return;

    onSubmit({
      projectId,
      folderTarget,
      saveMode,
      fileName: String(fileName || '').trim(),
      versionTargetName,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-[#1a1c23] rounded-t-3xl p-5 border-t border-[#2a2d36] max-h-[86%]">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-white text-lg font-bold">Projeye Kaydet</Text>
            <TouchableOpacity className="px-2 py-1" onPress={onClose}>
              <Text className="text-gray-400">Kapat</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text className="text-gray-400 text-xs mb-2">Proje</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              {projects.map((project) => (
                <TouchableOpacity
                  key={project.id}
                  className={`px-3 py-2 rounded-lg mr-2 border ${projectId === project.id ? 'bg-[#c6a87c]/20 border-[#c6a87c]/40' : 'bg-[#0f1115] border-[#2a2d36]'}`}
                  onPress={() => {
                    setProjectId(project.id);
                    setVersionTargetName('');
                  }}
                >
                  <Text className={projectId === project.id ? 'text-[#c6a87c] font-semibold' : 'text-white'}>{project.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text className="text-gray-400 text-xs mb-2">Kayit Turu</Text>
            <View className="flex-row mb-4">
              <TouchableOpacity
                className={`flex-1 rounded-lg py-2 items-center mr-2 border ${saveMode === 'new' ? 'bg-[#c6a87c]/20 border-[#c6a87c]/40' : 'bg-[#0f1115] border-[#2a2d36]'}`}
                onPress={() => setSaveMode('new')}
              >
                <Text className={saveMode === 'new' ? 'text-[#c6a87c] font-semibold' : 'text-white'}>Yeni Dosya</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 rounded-lg py-2 items-center border ${saveMode === 'version' ? 'bg-[#c6a87c]/20 border-[#c6a87c]/40' : 'bg-[#0f1115] border-[#2a2d36]'}`}
                onPress={() => setSaveMode('version')}
              >
                <Text className={saveMode === 'version' ? 'text-[#c6a87c] font-semibold' : 'text-white'}>Yeni Versiyon</Text>
              </TouchableOpacity>
            </View>

            <Text className="text-gray-400 text-xs mb-2">Klasor</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <TouchableOpacity
                className={`px-3 py-2 rounded-lg mr-2 border ${folderTarget === AUTO_FOLDER_TARGET ? 'bg-[#c6a87c]/20 border-[#c6a87c]/40' : 'bg-[#0f1115] border-[#2a2d36]'}`}
                onPress={() => setFolderTarget(AUTO_FOLDER_TARGET)}
              >
                <Text className={folderTarget === AUTO_FOLDER_TARGET ? 'text-[#c6a87c] font-semibold' : 'text-white'}>AI Ciktilari (otomatik)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`px-3 py-2 rounded-lg mr-2 border ${folderTarget === 'root' ? 'bg-[#c6a87c]/20 border-[#c6a87c]/40' : 'bg-[#0f1115] border-[#2a2d36]'}`}
                onPress={() => setFolderTarget('root')}
              >
                <Text className={folderTarget === 'root' ? 'text-[#c6a87c] font-semibold' : 'text-white'}>Ana Dizin</Text>
              </TouchableOpacity>
              {folders.map((folder) => (
                <TouchableOpacity
                  key={folder.id}
                  className={`px-3 py-2 rounded-lg mr-2 border ${folderTarget === folder.id ? 'bg-[#c6a87c]/20 border-[#c6a87c]/40' : 'bg-[#0f1115] border-[#2a2d36]'}`}
                  onPress={() => setFolderTarget(folder.id)}
                >
                  <Text className={folderTarget === folder.id ? 'text-[#c6a87c] font-semibold' : 'text-white'}>{folder.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {saveMode === 'new' ? (
              <>
                <Text className="text-gray-400 text-xs mb-2">Dosya Adi</Text>
                <TextInput
                  className="bg-[#0f1115] text-white p-3 rounded-xl border border-[#2a2d36] mb-4"
                  placeholder="ai-output.png"
                  placeholderTextColor="#4b5563"
                  value={fileName}
                  onChangeText={setFileName}
                />
              </>
            ) : (
              <>
                <Text className="text-gray-400 text-xs mb-2">Versiyonlanacak Dosya</Text>
                <View className="mb-4">
                  {versionCandidates.length === 0 ? (
                    <Text className="text-gray-500">Bu projede versiyonlanabilir gorsel bulunamadi.</Text>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {versionCandidates.map((file, index) => {
                        const key = `${file.name || 'file'}_${index}`;
                        const active = versionTargetName === (file.name || '');
                        return (
                          <TouchableOpacity
                            key={key}
                            className={`px-3 py-2 rounded-lg mr-2 border ${active ? 'bg-[#c6a87c]/20 border-[#c6a87c]/40' : 'bg-[#0f1115] border-[#2a2d36]'}`}
                            onPress={() => setVersionTargetName(String(file.name || ''))}
                          >
                            <Text className={active ? 'text-[#c6a87c] font-semibold' : 'text-white'}>{file.name || 'Dosya'}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              </>
            )}
          </ScrollView>

          <TouchableOpacity className="bg-[#c6a87c] p-3 rounded-xl items-center mt-2" onPress={submit} disabled={saving || !projects.length}>
            <Text className="text-[#0f1115] font-bold">{saving ? 'Kaydediliyor...' : 'Projeye Kaydet'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
