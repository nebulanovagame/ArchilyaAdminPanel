import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Href, useRouter } from 'expo-router';
import { Building2, FolderOpen, Search, Settings2, Sparkles, Trash2, Wand2, X } from 'lucide-react-native';
import { AI_STUDIO_TOOLS } from '../services/aiStudioService';

type ProjectLike = {
  id: string;
  name?: string;
  location?: string;
  status?: string;
};

type SearchModalProps = {
  visible: boolean;
  projects: ProjectLike[];
  onClose: () => void;
};

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

type SearchItem = {
  key: string;
  section: string;
  type: 'project' | 'quick-action' | 'ai-tool';
  title: string;
  subtitle: string;
  icon: IconComponent;
  iconColor: string;
  iconBackground: string;
  route?: Href;
  projectId?: string;
  toolId?: string;
};

const QUICK_ACTIONS: Array<{
  key: string;
  title: string;
  subtitle: string;
  route: Href;
  icon: IconComponent;
}> = [
  {
    key: 'settings',
    title: 'Ayarlar',
    subtitle: 'Profil ve hesap tercihlerini yonet',
    route: '/settings',
    icon: Settings2,
  },
  {
    key: 'subscription',
    title: 'Abonelik',
    subtitle: 'Planlari ve kredi detaylarini gor',
    route: '/subscription',
    icon: Sparkles,
  },
  {
    key: 'workspace',
    title: 'Workspace',
    subtitle: 'Ekip alanini ve uyeleri yonet',
    route: '/workspace',
    icon: Building2,
  },
  {
    key: 'ai-studio',
    title: 'AI Studio',
    subtitle: 'Tum AI araclarini tek ekranda ac',
    route: '/(tabs)/ai',
    icon: Wand2,
  },
  {
    key: 'trash',
    title: 'Cop Kutusu',
    subtitle: 'Silinen proje ve dosyalara git',
    route: '/trash',
    icon: Trash2,
  },
];

function normalizeSearchValue(value: string) {
  return String(value || '').trim().toLocaleLowerCase('tr-TR');
}

function matchesQuery(parts: Array<string | undefined>, query: string) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;

  return parts.some((part) => normalizeSearchValue(String(part || '')).includes(normalizedQuery));
}

function buildProjectSubtitle(project: ProjectLike) {
  if (project.location) {
    return project.location;
  }

  if (project.status) {
    return `${project.status} proje`;
  }

  return 'Proje detayi';
}

export default function SearchModal({ visible, projects, onClose }: SearchModalProps) {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setQuery('');
      return;
    }

    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 120);

    return () => clearTimeout(focusTimer);
  }, [visible]);

  const quickActionItems = useMemo<SearchItem[]>(
    () =>
      QUICK_ACTIONS.map((action) => ({
        key: `quick-${action.key}`,
        section: 'Hizli Erisim',
        type: 'quick-action',
        title: action.title,
        subtitle: action.subtitle,
        icon: action.icon,
        iconColor: '#c6a87c',
        iconBackground: 'rgba(198, 168, 124, 0.14)',
        route: action.route,
      })),
    []
  );

  const recentProjectItems = useMemo<SearchItem[]>(
    () =>
      (projects || []).slice(0, 4).map((project) => ({
        key: `recent-project-${project.id}`,
        section: 'Son Projeler',
        type: 'project',
        title: project.name || 'Adsiz Proje',
        subtitle: buildProjectSubtitle(project),
        icon: FolderOpen,
        iconColor: '#c6a87c',
        iconBackground: 'rgba(198, 168, 124, 0.14)',
        projectId: project.id,
      })),
    [projects]
  );

  const filteredItems = useMemo<SearchItem[]>(() => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return [...recentProjectItems, ...quickActionItems];
    }

    const projectMatches = (projects || [])
      .filter((project) => matchesQuery([project.name], trimmedQuery))
      .map((project) => ({
        key: `project-${project.id}`,
        section: 'Projeler',
        type: 'project' as const,
        title: project.name || 'Adsiz Proje',
        subtitle: buildProjectSubtitle(project),
        icon: FolderOpen,
        iconColor: '#c6a87c',
        iconBackground: 'rgba(198, 168, 124, 0.14)',
        projectId: project.id,
      }));

    const aiToolMatches = AI_STUDIO_TOOLS.filter((tool) =>
      matchesQuery([tool.label, tool.id, `${tool.cost} kredi`, 'AI Studio'], trimmedQuery)
    ).map((tool) => ({
      key: `tool-${tool.id}`,
      section: 'AI Araclari',
      type: 'ai-tool' as const,
      title: tool.label,
      subtitle: `${tool.cost} kredi • AI Studio araci`,
      icon: Wand2,
      iconColor: '#c6a87c',
      iconBackground: 'rgba(198, 168, 124, 0.14)',
      toolId: tool.id,
    }));

    const quickActionMatches = quickActionItems.filter((item) => matchesQuery([item.title, item.subtitle], trimmedQuery));

    return [...projectMatches, ...aiToolMatches, ...quickActionMatches];
  }, [projects, query, quickActionItems, recentProjectItems]);

  const handleSelect = (item: SearchItem) => {
    onClose();

    requestAnimationFrame(() => {
      if (item.type === 'project' && item.projectId) {
        router.push({ pathname: '/project/[id]', params: { id: item.projectId } });
        return;
      }

      if (item.type === 'ai-tool' && item.toolId) {
        router.push({ pathname: '/(tabs)/ai', params: { toolId: item.toolId } });
        return;
      }

      if (item.route) {
        router.push(item.route);
      }
    });
  };

  const renderItem = ({ item, index }: { item: SearchItem; index: number }) => {
    const previousSection = index > 0 ? filteredItems[index - 1]?.section : '';
    const showSectionTitle = index === 0 || previousSection !== item.section;
    const Icon = item.icon;

    return (
      <View>
        {showSectionTitle ? <Text className="text-gray-500 text-xs uppercase mb-3 mt-1">{item.section}</Text> : null}

        <TouchableOpacity
          className="bg-[#1a1c23] border border-[#2a2d36] rounded-2xl px-4 py-4 mb-3 flex-row items-center"
          activeOpacity={0.85}
          onPress={() => handleSelect(item)}
          accessibilityRole="button"
          accessibilityLabel={item.title}
        >
          <View
            className="w-12 h-12 rounded-2xl items-center justify-center mr-3 border border-[#2a2d36]"
            style={{ backgroundColor: item.iconBackground }}
          >
            <Icon size={20} color={item.iconColor} />
          </View>

          <View className="flex-1 pr-2">
            <Text className="text-white text-base font-semibold">{item.title}</Text>
            <Text className="text-gray-400 text-sm mt-1">{item.subtitle}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-[#0f1115]" style={{ paddingTop: Platform.OS === 'android' ? 18 : 0 }}>
        <View className="flex-1 px-4 pt-4">
          <View className="flex-row items-start justify-between mb-4">
            <View className="flex-1 pr-4">
              <Text className="text-white text-3xl font-bold">Hizli Ara</Text>
              <Text className="text-gray-400 mt-2">Projeler, AI araclari ve onemli sayfalarda aninda gezinin.</Text>
            </View>

            <TouchableOpacity
              className="w-11 h-11 bg-[#1a1c23] rounded-2xl border border-[#2a2d36] items-center justify-center"
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Kapat"
            >
              <X size={18} color="#c6a87c" />
            </TouchableOpacity>
          </View>

          <View className="bg-[#1a1c23] border border-[#2a2d36] rounded-2xl px-4 py-3 flex-row items-center mb-4">
            <Search size={18} color="#c6a87c" />
            <TextInput
              ref={inputRef}
              className="flex-1 text-white ml-3"
              placeholder="Proje, AI araci veya sayfa ara..."
              placeholderTextColor="#4b5563"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              selectionColor="#c6a87c"
            />
          </View>

          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32, flexGrow: filteredItems.length === 0 ? 1 : 0 }}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center px-6 pt-24">
                <View className="w-16 h-16 rounded-3xl bg-[#1a1c23] border border-[#2a2d36] items-center justify-center mb-4">
                  <Search size={24} color="#c6a87c" />
                </View>
                <Text className="text-white text-lg font-semibold text-center">Sonuc bulunamadi</Text>
                <Text className="text-gray-400 text-center mt-2">Proje, AI araci veya hizli erisim adini farkli bir sekilde deneyin.</Text>
              </View>
            }
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
