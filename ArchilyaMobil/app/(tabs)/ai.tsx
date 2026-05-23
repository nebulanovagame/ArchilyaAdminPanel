import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { storage } from '../../src/config/firebase';
import AiSaveResultModal from '../../src/components/AiSaveResultModal';
import AIStudioGenerationControls from '../../src/components/ai/AIStudioGenerationControls';
import AIStudioHeader from '../../src/components/ai/AIStudioHeader';
import AIStudioImageResultSection from '../../src/components/ai/AIStudioImageResultSection';
import AIStudioPromptHistorySection from '../../src/components/ai/AIStudioPromptHistorySection';
import AIStudioPromptSection from '../../src/components/ai/AIStudioPromptSection';
import AIStudioSceneSettings from '../../src/components/ai/AIStudioSceneSettings';
import AIStudioSourceImageSection from '../../src/components/ai/AIStudioSourceImageSection';
import AIStudioStatusBanners from '../../src/components/ai/AIStudioStatusBanners';
import AIStudioStyleSelector from '../../src/components/ai/AIStudioStyleSelector';
import AIStudioTextResultSection from '../../src/components/ai/AIStudioTextResultSection';
import AIStudioToolSelector from '../../src/components/ai/AIStudioToolSelector';
import {
  AiRunPayload,
  ImagePickerSource,
  PickedImage,
  PromptHistoryEntry,
  ResultPreviewMode,
  SavedResultInfo,
  SceneReference,
} from '../../src/components/ai/types';
import { useProjects } from '../../src/hooks/useProjects';
import { useCredits } from '../../src/hooks/useCredits';
import { useAuth } from '../../src/context/AuthContext';
import {
  AI_SCENE_EDIT_MODES,
  AI_SCENE_REFERENCE_TYPES,
  AI_STUDIO_TOOLS,
  AI_STYLE_OPTIONS,
  AI_TOOL_PRESETS,
  runAiStudioToolSecureMobile,
} from '../../src/services/aiStudioService';
import { trackEvent } from '../../src/services/analyticsService';
import { captureImageWithCamera, pickAiSourceFromDocument, pickImageFromDocument, pickImageFromLibrary } from '../../src/services/mediaService';
import { isPdfFile, renderPdfFirstPageToImage } from '../../src/services/pdfService';
import { useAiHistory } from '../../src/hooks/useAiHistory';
import {
  createProjectFolderSecure,
  getAiPromptHistorySecure,
  saveAiOutputToProjectSecure,
  saveAiPromptHistorySecure,
} from '../../src/services/entitlementService';
import { captureException } from '../../src/services/errorTracking';

type CreateFolderResult = {
  success?: boolean;
  message?: string;
  folder?: {
    id?: string;
  } | null;
};

type SaveAiOutputResult = {
  success?: boolean;
  message?: string;
  file?: {
    url?: string;
    name?: string;
  } | null;
};

function estimateDataUrlBytes(dataUrl: string) {
  const match = String(dataUrl || '').match(/^data:[^;]+;base64,(.+)$/i);
  if (!match?.[1]) return 0;
  return Math.floor((match[1].length * 3) / 4);
}

const MAX_PROMPT_HISTORY = 8;
const AI_OUTPUTS_FOLDER_NAME = 'AI Ciktilari';
const PROMPT_HISTORY_ALLOWED_TOOLS = new Set(AI_STUDIO_TOOLS.map((tool) => tool.id));

function nanoid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function formatDateTime(value: any) {
  try {
    return new Date(value).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

function sanitizeName(value: string) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

function buildDefaultAiFileName(toolId: string, mimeType = 'image/png') {
  const stamp = new Date().toISOString().replace(/[:]/g, '-').slice(0, 19);
  const safeTool = sanitizeName(toolId || 'ai');
  const ext = (String(mimeType || 'image/png').split('/')[1] || 'png').toLowerCase();
  return `Archilya_${safeTool}_${stamp}.${ext}`;
}

function getMimeAndExtFromDataUrl(dataUrl: string, fallbackMimeType = 'image/png') {
  const header = String(dataUrl || '').split(',')[0] || '';
  const mimeMatch = header.match(/^data:([^;]+);base64$/i);
  const mimeType = mimeMatch?.[1] || fallbackMimeType;
  const ext = (mimeType.split('/')[1] || 'png').toLowerCase();
  return { mimeType, ext };
}

function ensureFileExtension(fileName: string, ext: string) {
  const normalizedExt = String(ext || '').replace(/^\./, '').toLowerCase() || 'png';
  const value = String(fileName || '').trim();
  if (!value) return `ai-output.${normalizedExt}`;
  if (value.toLowerCase().endsWith(`.${normalizedExt}`)) return value;
  return `${value}.${normalizedExt}`;
}

function getUniqueFileName(fileName: string, files: any[]) {
  const normalized = String(fileName || '').trim();
  const used = new Set((files || []).map((file) => String(file?.name || '').toLowerCase()));
  if (!used.has(normalized.toLowerCase())) {
    return normalized;
  }

  const parts = normalized.split('.');
  const ext = parts.length > 1 ? parts.pop() : 'png';
  const base = parts.join('.') || 'ai-output';

  let cursor = 2;
  let candidate = `${base}_v${cursor}.${ext}`;
  while (used.has(candidate.toLowerCase())) {
    cursor += 1;
    candidate = `${base}_v${cursor}.${ext}`;
  }
  return candidate;
}

function normalizePromptHistoryToolId(value: string) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!PROMPT_HISTORY_ALLOWED_TOOLS.has(normalized as (typeof AI_STUDIO_TOOLS)[number]['id'])) {
    return '';
  }
  return normalized as (typeof AI_STUDIO_TOOLS)[number]['id'];
}

function sanitizePromptHistoryEntry(entry: any, fallbackToolId = ''): PromptHistoryEntry | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const toolId = normalizePromptHistoryToolId(entry.toolId || fallbackToolId);
  if (!toolId) {
    return null;
  }

  const referenceCountRaw = Math.round(Number(entry.referenceCount || 0));
  const referenceCount = Number.isFinite(referenceCountRaw)
    ? Math.max(0, Math.min(20, referenceCountRaw))
    : 0;
  const outputTypeRaw = String(entry.outputType || '').trim().toLowerCase();

  return {
    id: String(entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).slice(0, 80),
    toolId,
    toolLabel: String(entry.toolLabel || toolId).trim().slice(0, 120),
    outputType: outputTypeRaw === 'text' ? 'text' : 'image',
    style: String(entry.style || '').trim().slice(0, 64),
    sceneEditMode: String(entry.sceneEditMode || '').trim().slice(0, 64),
    referenceCount,
    extraNote: String(entry.extraNote || '').trim().slice(0, 2000),
    generationVariant: String(entry.generationVariant || '').trim().slice(0, 40),
    statusLabel: String(entry.statusLabel || '').trim().slice(0, 120),
    createdAt: String(entry.createdAt || new Date().toISOString()).trim().slice(0, 64),
  };
}

function sanitizePromptHistoryMap(input: any) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const nextMap: Record<string, PromptHistoryEntry[]> = {};
  Object.entries(input).forEach(([rawToolId, rawEntries]) => {
    const toolId = normalizePromptHistoryToolId(rawToolId);
    if (!toolId || !Array.isArray(rawEntries)) {
      return;
    }

    const safeEntries = rawEntries
      .map((entry) => sanitizePromptHistoryEntry(entry, toolId))
      .filter(Boolean)
      .slice(0, MAX_PROMPT_HISTORY) as PromptHistoryEntry[];

    if (safeEntries.length > 0) {
      nextMap[toolId] = safeEntries;
    }
  });

  return nextMap;
}

function buildShareFilePath(mimeType: string) {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Paylasim icin gecici dosya alani bulunamadi.');
  }

  const ext = (String(mimeType || 'image/png').split('/')[1] || 'png').toLowerCase();
  return `${cacheDir}ai-share-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

function buildPreviewFilePath(mimeType: string) {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Onizleme icin gecici dosya alani bulunamadi.');
  }

  const ext = (String(mimeType || 'image/png').split('/')[1] || 'png').toLowerCase();
  return `${cacheDir}ai-preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

function normalizeReplayMode(mode: string): 'retry' | 'variation' {
  return String(mode || '').trim().toLowerCase() === 'variation' ? 'variation' : 'retry';
}

function buildReplayPayloadFromHistoryEntry(entry: any): AiRunPayload | null {
  const sourceImageUri = String(entry?.sourceImageUri || entry?.savedFileUrl || '').trim();
  if (!sourceImageUri) return null;

  const resolvedTool =
    AI_STUDIO_TOOLS.find((tool) => tool.id === String(entry?.toolId || '').trim()) || AI_STUDIO_TOOLS[0];

  const references = (Array.isArray(entry?.sceneReferences) ? entry.sceneReferences : [])
    .map((reference: any, index: number) => {
      const uri = String(reference?.uri || '').trim();
      if (!uri) return null;

      return {
        id: `hist_${entry?.id || Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
        uri,
        name: String(reference?.label || reference?.name || `reference-${index + 1}`).trim(),
        mimeType: String(reference?.mimeType || 'image/jpeg').trim(),
        type: String(reference?.type || 'object').trim(),
        label: String(reference?.label || reference?.name || `Referans ${index + 1}`).trim(),
        note: String(reference?.note || '').trim(),
      };
    })
    .filter(Boolean) as SceneReference[];

  if (resolvedTool.id === 'sceneedit' && references.length === 0) {
    return null;
  }

  return {
    toolId: resolvedTool.id,
    toolLabel: resolvedTool.label,
    style: String(entry?.style || 'modern').trim() || 'modern',
    workflow: String(entry?.workflow || 'scene-compose').trim() || 'scene-compose',
    prompt: String(entry?.promptRaw || entry?.promptPreview || '').trim(),
    sourceProjectId: String(entry?.sourceProjectId || '').trim(),
    sourceImage: {
      uri: sourceImageUri,
      name: String(entry?.sourceImageName || `history-image-${Date.now()}.jpg`).trim(),
      mimeType: String(entry?.sourceImageMimeType || 'image/jpeg').trim(),
    },
    sceneReferences: references,
  };
}

export default function AIStudioScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    toolId?: string;
    sourceImageUri?: string;
    sourceImageName?: string;
    sourceImageMimeType?: string;
    sourceProjectId?: string;
    historyId?: string;
    replayMode?: string;
    replayNonce?: string;
  }>();
  const { projects } = useProjects();
  const { user } = useAuth();
  const { credits } = useCredits();
  const { history, historyWritable, logAiHistory, updateAiHistoryEntry } = useAiHistory();
  const projectList = projects ?? [];

  const [selectedToolId, setSelectedToolId] = useState(AI_STUDIO_TOOLS[0].id);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('modern');
  const [selectedWorkflow, setSelectedWorkflow] = useState('scene-compose');
  const [sceneReferenceType, setSceneReferenceType] = useState('object');
  const [sceneReferenceLabel, setSceneReferenceLabel] = useState('');
  const [sceneReferenceNote, setSceneReferenceNote] = useState('');
  const [prompt, setPrompt] = useState('');
  const [sourceImage, setSourceImage] = useState<PickedImage | null>(null);
  const [sceneReferenceImages, setSceneReferenceImages] = useState<SceneReference[]>([]);
  const [resultText, setResultText] = useState('');
  const [resultImageDataUrl, setResultImageDataUrl] = useState('');
  const [resultImagePreviewUri, setResultImagePreviewUri] = useState('');
  const [resultImageMimeType, setResultImageMimeType] = useState('image/png');
  const [resultPreviewMode, setResultPreviewMode] = useState<ResultPreviewMode>('after');
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [savedResultInfo, setSavedResultInfo] = useState<SavedResultInfo | null>(null);
  const [promptHistoryByTool, setPromptHistoryByTool] = useState<Record<string, PromptHistoryEntry[]>>({});
  const [activeHistoryId, setActiveHistoryId] = useState('');
  const [lastRunPayload, setLastRunPayload] = useState<AiRunPayload | null>(null);
  const [aiErrorMessage, setAiErrorMessage] = useState('');
  const [aiErrorHint, setAiErrorHint] = useState('');
  const replayRequestRef = useRef('');
  const generationLockRef = useRef(false);
  const shareLockRef = useRef(false);
  const mountedRef = useRef(true);

  const selectedTool = useMemo(
    () => AI_STUDIO_TOOLS.find((tool) => tool.id === selectedToolId) || AI_STUDIO_TOOLS[0],
    [selectedToolId]
  );
  const selectedToolPresets = useMemo(() => (AI_TOOL_PRESETS as Record<string, string[]>)[selectedTool.id] ?? [], [selectedTool.id]);
  const activePromptHistory = useMemo(() => promptHistoryByTool[selectedTool.id] || [], [promptHistoryByTool, selectedTool.id]);
  const defaultSaveProjectId = useMemo(() => selectedProject || projectList[0]?.id || '', [projectList, selectedProject]);
  const defaultSaveFileName = useMemo(
    () => buildDefaultAiFileName(lastRunPayload?.toolId || selectedTool.id || 'ai', resultImageMimeType || 'image/png'),
    [lastRunPayload?.toolId, selectedTool.id, resultImageMimeType]
  );

  const canSaveImageResult = selectedTool.outputType === 'image' && Boolean(resultImageDataUrl);

  const applySelectedTool = (toolId: string) => {
    setSelectedToolId(toolId as (typeof AI_STUDIO_TOOLS)[number]['id']);
    setResultText('');
    setResultImageDataUrl('');
    setResultPreviewMode('after');
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        generationLockRef.current = false;
        shareLockRef.current = false;
        setBusy(false);
        setShareBusy(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const toolId = String(params.toolId || '').trim();
    if (!toolId) return;

    const matchedTool = AI_STUDIO_TOOLS.find((tool) => tool.id === toolId);
    if (!matchedTool) return;

    applySelectedTool(matchedTool.id);
  }, [params.toolId]);

  useEffect(() => {
    let cancelled = false;

    const buildPreviewFile = async () => {
      const value = String(resultImageDataUrl || '').trim();
      if (!value.startsWith('data:')) {
        if (resultImagePreviewUri) {
          await FileSystem.deleteAsync(resultImagePreviewUri, { idempotent: true }).catch(() => null);
        }
        if (!cancelled) {
          setResultImagePreviewUri('');
        }
        return;
      }

      const base64 = String(value.split(',')[1] || '').trim();
      if (!base64) {
        if (!cancelled) {
          setResultImagePreviewUri('');
        }
        return;
      }

      const targetPath = buildPreviewFilePath(resultImageMimeType || 'image/png');
      await FileSystem.writeAsStringAsync(targetPath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (cancelled) {
        await FileSystem.deleteAsync(targetPath, { idempotent: true }).catch(() => null);
        return;
      }

      setResultImagePreviewUri((previous) => {
        if (previous && previous !== targetPath) {
          FileSystem.deleteAsync(previous, { idempotent: true }).catch(() => null);
        }
        return targetPath;
      });
    };

    buildPreviewFile().catch(() => {
      if (!cancelled) {
        setResultImagePreviewUri('');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [resultImageDataUrl, resultImageMimeType]);

  useEffect(() => {
    return () => {
      if (resultImagePreviewUri) {
        FileSystem.deleteAsync(resultImagePreviewUri, { idempotent: true }).catch(() => null);
      }
    };
  }, [resultImagePreviewUri]);

  useEffect(() => {
    const sourceImageUri = String(params.sourceImageUri || '').trim();
    if (!sourceImageUri) return;

    setSourceImage({
      uri: sourceImageUri,
      name: String(params.sourceImageName || `project-image-${Date.now()}.jpg`).trim(),
      mimeType: String(params.sourceImageMimeType || 'image/jpeg').trim(),
    });

    const sourceProjectId = String(params.sourceProjectId || '').trim();
    if (sourceProjectId) {
      setSelectedProject(sourceProjectId);
    }
  }, [params.sourceImageMimeType, params.sourceImageName, params.sourceImageUri, params.sourceProjectId]);

  useEffect(() => {
    let mounted = true;

    const loadPromptHistory = async () => {
      if (!user?.uid) {
        if (mounted) {
          setPromptHistoryByTool({});
        }
        return;
      }

      try {
        const result = await getAiPromptHistorySecure();
        if (!mounted) return;
        const safeHistoryMap = sanitizePromptHistoryMap(result?.history);
        setPromptHistoryByTool(safeHistoryMap);
      } catch (error) {
        captureException(error, {
          scope: 'mobile_ai_prompt_history_load',
          uid: user?.uid || '',
        });
        if (mounted) {
          setPromptHistoryByTool({});
        }
      }
    };

    loadPromptHistory();

    return () => {
      mounted = false;
    };
  }, [user?.uid]);

  const addPromptHistoryEntry = (entry: any) => {
    const fallbackToolId = selectedTool?.id || '';
    const safeEntry = sanitizePromptHistoryEntry(entry, fallbackToolId);
    if (!safeEntry) return;

    setPromptHistoryByTool((prev) => {
      const previousToolEntries = Array.isArray(prev[safeEntry.toolId]) ? prev[safeEntry.toolId] : [];
      const nextToolEntries = [
        safeEntry,
        ...previousToolEntries.filter((item) => item.id !== safeEntry.id),
      ].slice(0, MAX_PROMPT_HISTORY);

      return {
        ...prev,
        [safeEntry.toolId]: nextToolEntries,
      };
    });

    if (!user?.uid) {
      return;
    }

    void (async () => {
      try {
        const result = await saveAiPromptHistorySecure(safeEntry.toolId, safeEntry);
        const safeHistoryMap = sanitizePromptHistoryMap(result?.history);
        if (!safeHistoryMap[safeEntry.toolId]) {
          return;
        }

        setPromptHistoryByTool((prev) => ({
          ...prev,
          [safeEntry.toolId]: safeHistoryMap[safeEntry.toolId],
        }));
      } catch {
        // Prompt history write best-effort.
      }
    })();
  };

  const applyPromptHistory = (entry: PromptHistoryEntry) => {
    const tool = AI_STUDIO_TOOLS.find((item) => item.id === entry.toolId);
    if (!tool) return;

    setSelectedToolId(tool.id);
    if (entry.style) setSelectedStyle(entry.style);
    if (entry.sceneEditMode) setSelectedWorkflow(entry.sceneEditMode);
    setPrompt(entry.extraNote || '');
    Alert.alert('Basarili', 'Prompt ayarlari geri yuklendi.');
  };

  const removeSceneReference = (referenceId: string) => {
    setSceneReferenceImages((current) => current.filter((item) => item.id !== referenceId));
  };

  const clearSceneReferences = () => {
    setSceneReferenceImages([]);
  };

  const pickImage = async (target: 'source' | 'reference', source: ImagePickerSource) => {
    setPicking(true);
    try {
      let file = null;
      if (source === 'camera') {
        file = await captureImageWithCamera();
      } else if (source === 'gallery') {
        file = await pickImageFromLibrary();
      } else {
        file = target === 'source' ? await pickAiSourceFromDocument() : await pickImageFromDocument();
      }

      if (!file) return;

      const normalizedMimeType = String(file.mimeType || '').trim().toLowerCase();
      let resolvedSourceFile = file;

      if (target === 'source' && isPdfFile(file.name, normalizedMimeType)) {
        const renderedPdf = await renderPdfFirstPageToImage(file.uri);
        resolvedSourceFile = {
          uri: renderedPdf.uri,
          name: String(file.name || 'pdf').replace(/\.pdf$/i, '') + '-ilk-sayfa.png',
          mimeType: 'image/png',
          size: 0,
        };
        Alert.alert('Bilgi', 'PDF’in ilk sayfası AI için görsel olarak aktarılacak.');
      }

      const payload: PickedImage = {
        uri: resolvedSourceFile.uri,
        name: resolvedSourceFile.name || `image-${Date.now()}.jpg`,
        mimeType: resolvedSourceFile.mimeType,
      };

      if (target === 'source') {
        setSourceImage(payload);
        return;
      }

      setSceneReferenceImages((current) => {
        if (current.length >= 4) {
          Alert.alert('Sinir', 'Sahne duzenleme icin maksimum 4 referans gorsel ekleyebilirsiniz.');
          return current;
        }

        const reference: SceneReference = {
          id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          uri: payload.uri,
          name: payload.name,
          mimeType: payload.mimeType,
          type: sceneReferenceType,
          label: sceneReferenceLabel.trim() || payload.name,
          note: sceneReferenceNote.trim(),
        };

        return [...current, reference];
      });
    } catch (err: any) {
      captureException(err, {
        scope: 'mobile_ai_pick_image',
        target,
        source,
      });
      Alert.alert('Hata', err?.message || 'Gorsel secimi basarisiz oldu.');
    } finally {
      setPicking(false);
    }
  };

  const runGeneration = async (mode: 'normal' | 'retry' | 'variation' = 'normal', payloadOverride: any | null = null) => {
    if (generationLockRef.current || busy) {
      return;
    }

    const fallbackPayload = {
      toolId: selectedTool.id,
      toolLabel: selectedTool.label,
      style: selectedStyle,
      workflow: selectedWorkflow,
      prompt: prompt.trim(),
      sourceProjectId: selectedProject,
      sourceImage,
      sceneReferences: sceneReferenceImages,
    };

    const basePayload = payloadOverride || (mode === 'normal' || !lastRunPayload ? fallbackPayload : lastRunPayload);

    if (!basePayload?.sourceImage?.uri) {
      Alert.alert('Eksik Bilgi', 'Lutfen bir ana gorsel secin.');
      return;
    }

    if (basePayload.toolId === 'sceneedit' && !(Array.isArray(basePayload.sceneReferences) && basePayload.sceneReferences.length)) {
      Alert.alert('Eksik Bilgi', 'Sahne duzenleme icin en az bir referans gorsel secin.');
      return;
    }

    const variationSuffix =
      mode === 'variation'
        ? 'Ayni kompozisyonu koruyarak farkli bir varyasyon uret. Malzeme, isik ve atmosferi degistir.'
        : '';
    const effectivePrompt = [basePayload.prompt, variationSuffix].filter(Boolean).join('\n\n').trim();

    generationLockRef.current = true;
    setBusy(true);
    setResultText('');
    setResultImageDataUrl('');
    setResultImagePreviewUri('');
    setResultPreviewMode('after');
    setSavedResultInfo(null);
    setAiErrorMessage('');
    setAiErrorHint('');

    if (mode === 'normal' || payloadOverride) {
      setLastRunPayload(basePayload);
    }

    let historyId = '';
    try {
      const sceneReferences: any[] =
        basePayload.toolId === 'sceneedit' && Array.isArray(basePayload.sceneReferences)
          ? basePayload.sceneReferences.map((reference: any) => ({
              uri: reference.uri,
              mimeType: reference.mimeType,
              type: reference.type,
              label: reference.label,
              note: reference.note,
            }))
          : [];

      historyId = await logAiHistory({
        toolId: basePayload.toolId,
        toolLabel: basePayload.toolLabel,
        outputType: (AI_STUDIO_TOOLS.find((tool) => tool.id === basePayload.toolId)?.outputType || 'image'),
        mode,
        style: basePayload.style,
        workflow: basePayload.workflow,
        promptRaw: basePayload.prompt,
        promptPreview: effectivePrompt,
        sourceImageUri: basePayload.sourceImage.uri,
        sourceImageName: basePayload.sourceImage.name,
        sourceImageMimeType: basePayload.sourceImage.mimeType,
        sourceProjectId: basePayload.sourceProjectId || selectedProject,
        sceneReferences,
        status: 'running',
      });
      setActiveHistoryId(historyId);

      const result = await runAiStudioToolSecureMobile({
        toolId: basePayload.toolId,
        sourceImageUri: basePayload.sourceImage.uri,
        sourceImageMimeType: basePayload.sourceImage.mimeType,
        style: basePayload.style,
        extraNote: effectivePrompt,
        workflow: basePayload.workflow,
        references: sceneReferences,
      });

      await trackEvent('ai_tool_use', {
        tool_id: basePayload.toolId,
        style: basePayload.style || 'none',
      });

      if (result.outputType === 'text') {
        setResultText(result.text || '');
        setAiErrorMessage('');
        setAiErrorHint('');
        addPromptHistoryEntry({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          toolId: basePayload.toolId,
          toolLabel: basePayload.toolLabel,
          outputType: 'text',
          style: basePayload.style,
          sceneEditMode: basePayload.toolId === 'sceneedit' ? basePayload.workflow : '',
          referenceCount: sceneReferences.length,
          extraNote: basePayload.prompt,
          generationVariant: mode === 'normal' ? 'default' : mode,
          statusLabel: 'Analiz tamamlandi!',
          createdAt: new Date().toISOString(),
        });
        await updateAiHistoryEntry(historyId, {
          status: 'success',
          resultTextPreview: String(result.text || '').slice(0, 4000),
          hasImageResult: false,
          resultMimeType: null,
          errorMessage: null,
        });
        return;
      }

      setResultImageDataUrl(result.dataUrl || '');
      setResultImageMimeType(result.mimeType || 'image/png');
      setAiErrorMessage('');
      setAiErrorHint('');
      addPromptHistoryEntry({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        toolId: basePayload.toolId,
        toolLabel: basePayload.toolLabel,
        outputType: 'image',
        style: basePayload.style,
        sceneEditMode: basePayload.toolId === 'sceneedit' ? basePayload.workflow : '',
        referenceCount: sceneReferences.length,
        extraNote: basePayload.prompt,
        generationVariant: mode === 'normal' ? 'default' : mode,
        statusLabel: basePayload.toolId === 'sceneedit' ? 'Sahne duzenleme tamamlandi!' : 'Gorsel uretildi!',
        createdAt: new Date().toISOString(),
      });
      await updateAiHistoryEntry(historyId, {
        status: 'success',
        hasImageResult: true,
        resultMimeType: result.mimeType || 'image/png',
        resultTextPreview: null,
        errorMessage: null,
      });
    } catch (err: any) {
      captureException(err, {
        scope: 'mobile_ai_generation',
        mode,
        tool_id: basePayload?.toolId || selectedTool.id,
      });
      const message = String(err?.message || 'AI uretimi basarisiz oldu.').trim();
      const lower = message.toLowerCase();
      let hint = '';
      if (lower.includes('ag hatasi') || lower.includes('network')) {
        hint = 'Baglantinizi kontrol edin. Galeriden secilen gorsellerde tekrar denemeden once uygulamayi yeniden acmak faydali olabilir.';
      } else if (lower.includes('buyuk') || lower.includes('limit')) {
        hint = 'Daha kucuk veya daha az detayli bir gorsel secin. Kamera yerine galeriden optimize edilmis bir kopya deneyin.';
      }

      setAiErrorMessage(message);
      setAiErrorHint(hint);

      if (historyId) {
        await updateAiHistoryEntry(historyId, {
          status: 'error',
          errorMessage: message.slice(0, 500),
        }).catch(() => null);
      }
      Alert.alert('Hata', message || 'AI uretimi basarisiz oldu.');
    } finally {
      generationLockRef.current = false;
      if (mountedRef.current) {
        setBusy(false);
      }
    }
  };

  const generate = async () => {
    await runGeneration('normal');
  };

  const generateRetry = async () => {
    if (!lastRunPayload) {
      Alert.alert('Bilgi', 'Tekrar uretim icin once bir sonuc olusturun.');
      return;
    }
    await runGeneration('retry');
  };

  const generateVariation = async () => {
    if (!lastRunPayload) {
      Alert.alert('Bilgi', 'Varyasyon icin once bir sonuc olusturun.');
      return;
    }
    await runGeneration('variation');
  };

  useEffect(() => {
    const historyId = String(params.historyId || '').trim();
    if (!historyId) return;

    const mode = normalizeReplayMode(String(params.replayMode || 'retry'));
    const replayNonce = String(params.replayNonce || '').trim() || 'default';
    const replayKey = `${historyId}:${mode}:${replayNonce}`;
    if (replayRequestRef.current === replayKey) return;

    const entry = history.find((item: any) => item.id === historyId);
    if (!entry) return;

    replayRequestRef.current = replayKey;
    const replayPayload = buildReplayPayloadFromHistoryEntry(entry);

    if (!replayPayload) {
      Alert.alert('Bilgi', 'Bu gecmis kaydi tekrar uretim icin yeterli kaynak bilgi icermiyor.');
      return;
    }

    setSelectedToolId(replayPayload.toolId as (typeof AI_STUDIO_TOOLS)[number]['id']);
    setSelectedStyle(replayPayload.style);
    setSelectedWorkflow(replayPayload.workflow);
    setPrompt(replayPayload.prompt);
    setSourceImage(replayPayload.sourceImage);
    setSceneReferenceImages(replayPayload.sceneReferences);
    setLastRunPayload(replayPayload);

    if (replayPayload.sourceProjectId) {
      setSelectedProject(replayPayload.sourceProjectId);
    }

    runGeneration(mode, replayPayload);
  }, [history, params.historyId, params.replayMode, params.replayNonce]);

  const findProjectById = (projectId: string) => {
    return projectList.find((project) => project.id === projectId) || null;
  };

  const ensureAiOutputsFolder = async (projectData: any) => {
    const folders = projectData?.folders || [];
    const existingFolder = folders.find((folder: any) => {
      const name = String(folder?.name || '').trim().toLowerCase();
      return name === 'ai ciktilari' || name === 'ai outputs' || name === 'ai ciktlari';
    });

    if (existingFolder?.id) {
      return existingFolder.id;
    }

    const result = (await createProjectFolderSecure(projectData.id, AI_OUTPUTS_FOLDER_NAME, `fld_${nanoid()}`)) as CreateFolderResult;
    if (!result?.success || !result?.folder?.id) {
      throw new Error(result?.message || 'AI ciktilari klasoru olusturulamadi.');
    }

    return String(result.folder.id);
  };

  const resolveFolderIdForSave = async (projectData: any, folderTarget: string) => {
    if (folderTarget === 'root') return null;
    if (folderTarget === '__ai_outputs_auto__') {
      return await ensureAiOutputsFolder(projectData);
    }
    return folderTarget || null;
  };

  const useResultAsPrimaryScene = () => {
    if (!resultImageDataUrl) return;
    const fileName = buildDefaultAiFileName(lastRunPayload?.toolId || selectedTool.id || 'ai', resultImageMimeType);
    setSourceImage({
      uri: resultImageDataUrl,
      name: fileName,
      mimeType: resultImageMimeType,
    });
    Alert.alert('Basarili', 'AI sonucu yeni ana sahne olarak atandi.');
  };

  const useResultAsSceneReference = () => {
    if (!resultImageDataUrl) return;
    if (sceneReferenceImages.length >= 4) {
      Alert.alert('Sinir', 'En fazla 4 referans ekleyebilirsiniz.');
      return;
    }

    const reference: SceneReference = {
      id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      uri: resultImageDataUrl,
      name: buildDefaultAiFileName('reference', resultImageMimeType),
      mimeType: resultImageMimeType,
      type: 'style',
      label: 'AI Cikti Referansi',
      note: 'Bu ciktiyi referans olarak kullan',
    };

    setSceneReferenceImages((current) => [...current, reference]);
    Alert.alert('Basarili', 'Sonuc referans panosuna eklendi.');
  };

  const saveResultToProject = async ({
    projectId,
    folderTarget,
    saveMode,
    fileName,
    versionTargetName,
  }: {
    projectId: string;
    folderTarget: string;
    saveMode: 'new' | 'version';
    fileName: string;
    versionTargetName: string;
  }) => {
    if (saving) {
      return;
    }

    if (!resultImageDataUrl) {
      Alert.alert('Bilgi', 'Kaydedilecek bir sonuc bulunamadi.');
      return;
    }

    const projectData = findProjectById(projectId);
    if (!projectData) {
      Alert.alert('Hata', 'Proje bulunamadi.');
      return;
    }

    setSaving(true);
    try {
      const inferred = getMimeAndExtFromDataUrl(resultImageDataUrl, resultImageMimeType || 'image/png');
      const generatedToolId = lastRunPayload?.toolId || selectedTool.id;
      const generatedToolLabel = lastRunPayload?.toolLabel || selectedTool.label;
      const fallbackName = buildDefaultAiFileName(generatedToolId, inferred.mimeType);
      const requestedName = ensureFileExtension(fileName || fallbackName, inferred.ext);

      const currentFiles = Array.isArray(projectData.files) ? [...projectData.files] : [];
      const folderId = await resolveFolderIdForSave(projectData, folderTarget);
      const estimatedSize = estimateDataUrlBytes(resultImageDataUrl);

      let finalFileName = requestedName;
      let versionTarget = '';

      if (saveMode === 'version') {
        const targetFile = currentFiles.find((file: any) => file.name === versionTargetName);
        if (!targetFile) {
          throw new Error('Versiyonlanacak dosya bulunamadi.');
        }

        finalFileName = String(targetFile.name || requestedName);
        versionTarget = String(targetFile.name || '').trim();
      } else {
        finalFileName = getUniqueFileName(requestedName, currentFiles);
      }

      const path = `projects/${projectId}/ai_outputs/${Date.now()}_${finalFileName}`;
      const storageRef = ref(storage, path);
      await uploadString(storageRef, resultImageDataUrl, 'data_url');
      const downloadUrl = await getDownloadURL(storageRef);

      const aiMeta = {
        source: 'ai-studio',
        isAiGenerated: true,
        toolId: generatedToolId,
        toolLabel: generatedToolLabel,
        promptText: String(lastRunPayload?.prompt || prompt || ''),
        style: String(lastRunPayload?.style || selectedStyle || ''),
        editMode: String(lastRunPayload?.workflow || selectedWorkflow || ''),
        referenceCount: Number((lastRunPayload?.sceneReferences || sceneReferenceImages || []).length || 0),
        generatedAt: new Date().toISOString(),
      };

      const saveResult = (await saveAiOutputToProjectSecure({
        projectId,
        saveMode,
        folderId,
        versionTargetName: versionTarget,
        file: {
          name: finalFileName,
          url: downloadUrl,
          path,
          size: estimatedSize,
          type: inferred.ext,
          folderId: folderId || null,
          versions: [],
          aiGenerated: true,
          aiMeta,
          contentType: inferred.mimeType,
          storageProvider: 'firebase',
          objectKey: null,
          createdAt: new Date().toISOString(),
        },
      })) as SaveAiOutputResult;

      if (!saveResult?.success || !saveResult?.file) {
        throw new Error(saveResult?.message || 'Projeye kaydetme basarisiz.');
      }

      const savedFileDoc = saveResult.file;
      const savedFileUrl = String(savedFileDoc?.url || downloadUrl || '').trim();

      if (activeHistoryId) {
        await updateAiHistoryEntry(activeHistoryId, {
          savedProjectId: projectId,
          savedProjectName: projectData.name || null,
          savedFileUrl: savedFileUrl || downloadUrl,
          savedAt: new Date().toISOString(),
        }).catch(() => null);
      }

      setSavedResultInfo({
        projectId,
        projectName: projectData.name,
        fileName: savedFileDoc.name,
        savedAt: new Date().toISOString(),
      });
      setSelectedProject(projectId);
      setSaveModalOpen(false);
      Alert.alert('Basarili', 'AI cikti projeye kaydedildi.');
    } catch (err: any) {
      captureException(err, {
        scope: 'mobile_ai_save_result',
        project_id: projectId,
        save_mode: saveMode,
      });
      Alert.alert('Hata', err?.message || 'Projeye kaydetme basarisiz.');
    } finally {
      setSaving(false);
    }
  };

  const shareResultImage = async () => {
    if (shareLockRef.current || shareBusy) {
      return;
    }

    if (!resultImageDataUrl) {
      Alert.alert('Bilgi', 'Paylasim icin once bir gorsel sonuc olusturun.');
      return;
    }

    shareLockRef.current = true;
    setShareBusy(true);
    try {
      if (resultImageDataUrl.startsWith('data:')) {
        let filePath = String(resultImagePreviewUri || '').trim();
        if (!filePath) {
          const base64 = String(resultImageDataUrl.split(',')[1] || '').trim();
          if (!base64) {
            throw new Error('Paylasim dosyasi olusturulamadi.');
          }

          filePath = buildShareFilePath(resultImageMimeType || 'image/png');
          await FileSystem.writeAsStringAsync(filePath, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }

        const canUseSecureShare = await Sharing.isAvailableAsync();
        if (canUseSecureShare) {
          await Sharing.shareAsync(filePath, {
            mimeType: resultImageMimeType || 'image/png',
            dialogTitle: 'AI sonucunu paylas',
          });
        } else {
          await Share.share({
            title: 'AI sonucu',
            message: 'AI sonucu gorsel eklendi.',
            url: filePath,
          });
        }

        if (filePath !== resultImagePreviewUri) {
          setTimeout(() => {
            FileSystem.deleteAsync(filePath, { idempotent: true }).catch(() => null);
          }, 4000);
        }

        return;
      }

      await Share.share({
        message: `${lastRunPayload?.toolLabel || selectedTool.label} sonucu\n${resultImageDataUrl}`,
        url: resultImageDataUrl,
      });
    } catch (err: any) {
      captureException(err, {
        scope: 'mobile_ai_share_result',
        tool_id: lastRunPayload?.toolId || selectedTool.id,
      });
      Alert.alert('Hata', err?.message || 'AI sonucu paylasilamadi.');
    } finally {
      shareLockRef.current = false;
      if (mountedRef.current) {
        setShareBusy(false);
      }
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0f1115]" style={{ paddingTop: Platform.OS === 'android' ? 36 : 0 }}>
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 24 }}>
        <AIStudioHeader credits={credits} historyCount={history.length} onOpenHistory={() => router.push('/ai-history')} />

        <AIStudioStatusBanners
          historyWritable={historyWritable}
          aiErrorMessage={aiErrorMessage}
          aiErrorHint={aiErrorHint}
        />

        <AIStudioToolSelector tools={AI_STUDIO_TOOLS} selectedToolId={selectedTool.id} onSelectTool={applySelectedTool} />

        {selectedTool.requiresStyle ? (
          <AIStudioStyleSelector styles={AI_STYLE_OPTIONS} selectedStyle={selectedStyle} onSelectStyle={setSelectedStyle} />
        ) : null}

        {selectedTool.supportsSceneReferences ? (
          <AIStudioSceneSettings
            modes={AI_SCENE_EDIT_MODES}
            referenceTypes={AI_SCENE_REFERENCE_TYPES}
            selectedWorkflow={selectedWorkflow}
            selectedReferenceType={sceneReferenceType}
            sceneReferenceLabel={sceneReferenceLabel}
            sceneReferenceNote={sceneReferenceNote}
            sceneReferenceImages={sceneReferenceImages}
            busy={busy}
            picking={picking}
            onSelectWorkflow={setSelectedWorkflow}
            onSelectReferenceType={setSceneReferenceType}
            onChangeSceneReferenceLabel={setSceneReferenceLabel}
            onChangeSceneReferenceNote={setSceneReferenceNote}
            onPickReferenceImage={(source) => pickImage('reference', source)}
            onClearSceneReferences={clearSceneReferences}
            onRemoveSceneReference={removeSceneReference}
          />
        ) : null}

        <AIStudioPromptSection
          prompt={prompt}
          presets={selectedToolPresets}
          onChangePrompt={setPrompt}
          onSelectPreset={setPrompt}
        />

        <AIStudioPromptHistorySection
          entries={activePromptHistory}
          formatDateTime={formatDateTime}
          onSelectEntry={applyPromptHistory}
        />

        <AIStudioSourceImageSection
          sourceImage={sourceImage}
          busy={busy}
          picking={picking}
          onPickSourceImage={(source) => pickImage('source', source)}
        />

        <AIStudioGenerationControls
          busy={busy}
          picking={picking}
          selectedToolCost={selectedTool.cost}
          hasLastRunPayload={Boolean(lastRunPayload)}
          onGenerate={generate}
          onRetry={generateRetry}
          onGenerateVariation={generateVariation}
        />

        {selectedTool.outputType === 'text' && resultText ? <AIStudioTextResultSection resultText={resultText} /> : null}

        {canSaveImageResult ? (
          <AIStudioImageResultSection
            resultPreviewMode={resultPreviewMode}
            previewImageUri={resultImagePreviewUri || resultImageDataUrl}
            originalImageUri={lastRunPayload?.sourceImage?.uri || sourceImage?.uri || ''}
            shareBusy={shareBusy}
            saving={saving}
            selectedToolId={selectedTool.id}
            savedResultInfo={savedResultInfo}
            onChangeResultPreviewMode={setResultPreviewMode}
            onShareResult={shareResultImage}
            onOpenSaveModal={() => setSaveModalOpen(true)}
            onUseResultAsPrimaryScene={useResultAsPrimaryScene}
            onUseResultAsSceneReference={useResultAsSceneReference}
          />
        ) : null}
      </ScrollView>

      <AiSaveResultModal
        visible={saveModalOpen}
        saving={saving}
        projects={projectList}
        initialProjectId={defaultSaveProjectId}
        defaultFileName={defaultSaveFileName}
        onClose={() => setSaveModalOpen(false)}
        onSubmit={saveResultToProject}
      />
    </SafeAreaView>
  );
}
