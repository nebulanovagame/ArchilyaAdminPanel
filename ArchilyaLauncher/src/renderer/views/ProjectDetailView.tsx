import React, { useEffect, useRef } from 'react';
import { ProjectFileBreadcrumb } from '../components/ProjectFileBreadcrumb';
import { ProjectFolderTree, type TreeNode } from '../components/ProjectFolderTree';
import { ProjectFileTable, type FileTableItem } from '../components/ProjectFileTable';
import { ProjectFileGallery } from '../components/ProjectFileGallery';
import { ProjectFileInspector } from '../components/ProjectFileInspector';
import type { FsItem } from '../../shared/fsTypes';
import type { FileVersionRecord } from '../../shared/versionTypes';

interface ProjectDetailViewProps {
  projectName: string;
  projectId?: string;
  projectPath?: string;
  onBack: () => void;
  workMode?: 'solo' | 'office';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({ projectName, projectId, projectPath, onBack, workMode = 'office' }) => {
  const [selectedFolderId, setSelectedFolderId] = React.useState<string>('root');
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set(['root']));
  const [selectedFileIds, setSelectedFileIds] = React.useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = React.useState<'list' | 'gallery'>('list');
  const [inspectorItem, setInspectorItem] = React.useState<FileTableItem | null>(null);
  const [fileNames, setFileNames] = React.useState<Map<string, string>>(new Map());
  const [fileLocks, setFileLocks] = React.useState<Map<string, { lockStatus: FileTableItem['lockStatus']; lockedBy?: string }>>(new Map());
  const [fsItems, setFsItems] = React.useState<FsItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [syncStatusMap, setSyncStatusMap] = React.useState<Map<string, { status: FileTableItem['syncStatus']; percent?: number }>>(new Map());
  const [fileVersions, setFileVersions] = React.useState<FileVersionRecord[]>([]);
  const [isVersionsLoading, setIsVersionsLoading] = React.useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const folderTree: TreeNode[] = React.useMemo(() => {
    const root: TreeNode = { id: 'root', name: projectName, children: [] };
    const folders = fsItems.filter((item) => item.isDirectory);
    root.children = folders.map((folder) => ({ id: folder.relativePath, name: folder.name }));
    return [root];
  }, [fsItems, projectName]);

  const currentFolder = folderTree.find((f) => f.id === selectedFolderId)?.name ?? projectName;
  const selectedFileCount = selectedFileIds.size;
  const hasSelectedFiles = selectedFileCount > 0;

  const filteredItems: FileTableItem[] = React.useMemo(() => {
    const itemsToShow = selectedFolderId === 'root'
      ? fsItems
      : fsItems.filter((item) => item.relativePath.startsWith(selectedFolderId + '/'));

    return itemsToShow.map((item) => {
      const lockOverride = fileLocks.get(item.relativePath);
      const syncOverride = syncStatusMap.get(item.relativePath);
      return {
        id: item.relativePath,
        name: fileNames.get(item.relativePath) ?? item.name,
        type: item.isDirectory ? 'folder' : 'file',
        size: formatBytes(item.size),
        date: new Date(item.modifiedAt).toLocaleDateString('tr-TR'),
        syncStatus: syncOverride?.status ?? ('synced' as const),
        aiSuggestedName: undefined,
        lockStatus: lockOverride?.lockStatus ?? 'unlocked',
        lockedBy: lockOverride?.lockedBy,
      };
    });
  }, [fsItems, selectedFolderId, fileNames, fileLocks, syncStatusMap]);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setInspectorItem(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // FAZ 2.5: Inspector açıldığında versiyonları çek
  useEffect(() => {
    if (!inspectorItem || !projectId) {
      setFileVersions([]);
      return;
    }

    const loadVersions = async () => {
      setIsVersionsLoading(true);
      try {
        const response = await window.api.listFileVersions(projectId, inspectorItem.name);
        if (response.success) {
          setFileVersions(response.versions);
        } else {
          console.error('[ProjectDetailView] Versiyon listeleme hatası:', response.error);
        }
      } catch (err) {
        console.error('[ProjectDetailView] Versiyon listeleme exception:', err);
      } finally {
        setIsVersionsLoading(false);
      }
    };

    loadVersions();
  }, [inspectorItem, projectId]);

  // Dosya sistemi listeleme ve izleme
  useEffect(() => {
    if (!projectPath) return;

    const loadFiles = async () => {
      setIsLoading(true);
      try {
        const response = await window.api.listDirectory(projectPath);
        if (response.success) {
          setFsItems(response.items);
        } else {
          console.error('[ProjectDetailView] listDirectory error:', response.error);
        }
      } catch (err) {
        console.error('[ProjectDetailView] listDirectory exception:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadFiles();

    window.api.watchDirectory(projectPath, projectId).catch((err) => {
      console.error('[ProjectDetailView] watchDirectory error:', err);
    });

    const unsubscribe = window.api.onDirectoryChanged(() => {
      loadFiles();
    });

    // FAZ 2.3: Oto-Kilit istihbaratı — .dwl dosyası oluştuğunda/bittiğinde
    const unsubscribeLock = window.api.onFileLockChanged((lockEvent) => {
      setFileLocks((prev) => {
        const next = new Map(prev);
        if (lockEvent.status === 'locked') {
          next.set(lockEvent.relativePath, {
            lockStatus: 'locked',
            lockedBy: lockEvent.lockedBy || 'Bilinmeyen Kullanici',
          });
        } else {
          next.set(lockEvent.relativePath, { lockStatus: 'unlocked' });
        }
        return next;
      });
    });

    // FAZ 2.4: Yükleme ilerlemesi dinleyicileri
    const unsubscribeUploadProgress = window.api.onUploadProgress((event) => {
      setSyncStatusMap((prev) => {
        const next = new Map(prev);
        next.set(event.fileName, { status: 'uploading', percent: event.percent });
        return next;
      });
    });

    const unsubscribeUploadComplete = window.api.onUploadComplete((event) => {
      setSyncStatusMap((prev) => {
        const next = new Map(prev);
        next.set(event.fileName, { status: 'synced' });
        return next;
      });
    });

    const unsubscribeUploadError = window.api.onUploadError((event) => {
      setSyncStatusMap((prev) => {
        const next = new Map(prev);
        next.set(event.fileName, { status: 'synced' });
        return next;
      });
      console.error(`[ProjectDetailView] Yükleme hatası (${event.fileName}):`, event.error);
    });

    return () => {
      unsubscribe();
      unsubscribeLock();
      unsubscribeUploadProgress();
      unsubscribeUploadComplete();
      unsubscribeUploadError();
      window.api.unwatchDirectory(projectPath);
    };
  }, [projectPath, projectId]);

  const handleToggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelect = (id: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedFileIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(filteredItems.map((item) => item.id)));
    }
  };

  const handleFolderSelect = (id: string) => {
    setSelectedFolderId(id);
    setSelectedFileIds(new Set());
    setInspectorItem(null);
  };

  const handleSelectItem = (id: string) => {
    const item = filteredItems.find((f) => f.id === id);
    if (item && item.type === 'file') {
      setInspectorItem(item);
    }
  };

  const handleCloseInspector = () => {
    setInspectorItem(null);
  };

  const handleAiRename = (id: string, newName: string) => {
    setFileNames((prev) => {
      const next = new Map(prev);
      next.set(id, newName);
      return next;
    });
  };

  const handleLock = (id: string) => {
    setFileLocks((prev) => {
      const next = new Map(prev);
      next.set(id, { lockStatus: 'locked_by_me', lockedBy: 'Ahmet Yilmaz' });
      return next;
    });
  };

  const handleUnlock = (id: string) => {
    setFileLocks((prev) => {
      const next = new Map(prev);
      next.set(id, { lockStatus: 'unlocked' });
      return next;
    });
  };

  const handleOpenFile = async (id: string) => {
    const item = filteredItems.find((f) => f.id === id);
    if (!item || !projectPath) return;
    const absolutePath = `${projectPath}\\${item.id}`;
    console.log(`[Zaman Makinesi] Dosya açılıyor: ${absolutePath}`);
    try {
      const result = await window.api.openFile(absolutePath);
      if (!result.success) {
        console.error(`[ProjectDetailView] Dosya açılamadı: ${result.error}`);
        alert(`Dosya açılamadı: ${result.error || 'Bilinmeyen hata'}`);
      }
    } catch (err) {
      console.error('[ProjectDetailView] openFile exception:', err);
      alert('Dosya açılırken bir hata oluştu.');
    }
  };

  const handleDropzoneClick = () => {
    fileInputRef.current?.click();
  };

  const handleDropzoneFilesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const names = files.map((file) => file.name);
    console.log('Selected files:', names);

    if (!projectPath || files.length === 0) {
      event.target.value = '';
      return;
    }

    const filePaths = files.map((file) => (file as any).path).filter(Boolean) as string[];
    if (filePaths.length === 0) {
      console.warn('[ProjectDetailView] Dosya yolları alınamadı.');
      event.target.value = '';
      return;
    }

    try {
      const result = await window.api.copyFiles(projectPath, filePaths);
      if (result.success) {
        console.log(`[ProjectDetailView] ${result.copied?.length ?? 0} dosya kopyalandı:`, result.copied);
      } else {
        console.error('[ProjectDetailView] Dosya kopyalama hatası:', result.error);
        alert(`Dosyalar kopyalanamadı: ${result.error || 'Bilinmeyen hata'}`);
      }
    } catch (err) {
      console.error('[ProjectDetailView] copyFiles exception:', err);
      alert('Dosyalar kopyalanırken bir hata oluştu.');
    }

    event.target.value = '';
  };

  const selectedFileIdList = Array.from(selectedFileIds);

  const handleBatchDownload = async () => {
    if (selectedFileIdList.length === 0) return;
    const downloadPromises: Promise<void>[] = [];
    for (const fileId of selectedFileIdList) {
      const file = filteredItems.find((item) => item.id === fileId);
      if (file && file.type === 'file') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FileTableItem may carry url from future data sources
        const url = (file as any).url;
        if (url) {
          downloadPromises.push(
            window.api.downloadFile(url, file.name).then((result) => {
              if (!result.success && result.error) {
                console.error(`Download failed for ${file.name}:`, result.error);
              }
            }).catch((err) => {
              console.error(`Download error for ${file.name}:`, err);
            })
          );
        }
      }
    }
    if (downloadPromises.length === 0) {
      alert('Indirme baglantisi bulunamadi.');
      return;
    }
    await Promise.all(downloadPromises);
  };

  // TODO: Implement folder picker UI and move IPC handler for batch move
  const handleBatchMove = () => {
    alert('Toplu tasima henuz desteklenmiyor.');
  };

  const handleBatchDelete = async () => {
    if (selectedFileIdList.length === 0) return;
    if (!projectId) {
      alert('Proje ID bulunamadi.');
      return;
    }
    const confirmed = window.confirm(
      `${selectedFileIdList.length} dosyayi kalici olarak silmek istediginize emin misiniz? Bu islem geri alinemaz.`
    );
    if (!confirmed) return;
    let errorCount = 0;
    for (const fileId of selectedFileIdList) {
      const fsItem = fsItems.find((item) => item.relativePath === fileId);
      if (fsItem && !fsItem.isDirectory) {
        const file = {
          name: fsItem.name,
          url: '',
          path: fsItem.relativePath,
          size: fsItem.size,
          type: fsItem.name.split('.').pop() ?? '',
          folderId: selectedFolderId === 'root' ? null : selectedFolderId,
          createdAt: fsItem.createdAt,
        };
        try {
          const result = await window.api.deleteFile(projectId, file);
          if (!result.success) {
            console.error(`[ProjectDetailView] Dosya silinemedi: ${fsItem.name}`, result.error);
            errorCount++;
          }
        } catch (err) {
          console.error(`[ProjectDetailView] Dosya silme hatasi: ${fsItem.name}`, err);
          errorCount++;
        }
      }
    }
    setSelectedFileIds(new Set());
    setInspectorItem(null);
    if (projectPath) {
      const response = await window.api.listDirectory(projectPath);
      if (response.success) {
        setFsItems(response.items);
      }
    }
    if (errorCount > 0) {
      alert(`${errorCount} dosya silinirken hata olustu.`);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
      {/* Header: Back Button + Breadcrumb */}
      <div className="border-b border-white/[0.03] bg-[#0a0a0a]/70">
        <div className="flex items-center gap-3 px-6 py-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-archilya-gold/25 bg-archilya-gold/[0.08] px-4 text-[11px] font-display tracking-widest text-archilya-gold transition-all hover:border-archilya-gold/45 hover:bg-archilya-gold/15 hover:text-[#F4CF57] focus:outline-none focus:ring-1 focus:ring-archilya-gold/40"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Tüm Projeler
          </button>
          <div className="min-w-0 flex-1">
            <ProjectFileBreadcrumb
              projectName={projectName}
              currentFolder={currentFolder}
              onNavigateHome={onBack}
              onNavigateProject={() => {}}
            />
          </div>
        </div>
      </div>

      {/* Main Content: Sidebar + File Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sol: Klasör Ağacı */}
        <aside className="w-[210px] flex-shrink-0 flex flex-col border-r border-white/[0.03] bg-[#0a0a0a]/50">
          <ProjectFolderTree
            nodes={folderTree}
            selectedId={selectedFolderId}
            onSelect={handleFolderSelect}
            onToggleExpand={handleToggleExpand}
            expandedIds={expandedIds}
          />
        </aside>

        {/* Sağ: Dosya Alanı */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Toolbar: View Toggle */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.03]">
            <span className="text-[10px] font-mono tracking-wider text-archilya-text-dim/40 uppercase">
              {filteredItems.length} dosya
            </span>
            <div className="flex items-center rounded-lg border border-white/[0.06] overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`w-8 h-8 flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-white/[0.06] text-archilya-gold' : 'text-archilya-text-dim/40 hover:text-archilya-text/70 hover:bg-white/[0.03]'}`}
                title="Liste görünümü"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
              <button
                onClick={() => setViewMode('gallery')}
                className={`w-8 h-8 flex items-center justify-center transition-colors ${viewMode === 'gallery' ? 'bg-white/[0.06] text-archilya-gold' : 'text-archilya-text-dim/40 hover:text-archilya-text/70 hover:bg-white/[0.03]'}`}
                title="Galeri görünümü"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
              </button>
            </div>
          </div>

          {/* Upload Dropzone */}
          <button
            type="button"
            onClick={handleDropzoneClick}
            className="mx-6 mt-6 mb-2 rounded-xl border border-dashed border-archilya-gold/10 bg-white/[0.03] hover:border-archilya-gold/25 hover:bg-white/[0.02] transition-all duration-300 flex flex-col items-center justify-center py-8 focus:outline-none focus:ring-1 focus:ring-archilya-gold/30"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleDropzoneFilesChange}
            />
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-archilya-gold/50 mb-3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <p className="text-[12px] text-archilya-text-dim/60 tracking-wide">Dosyaları buraya sürükleyin veya yüklemek için tıklayın</p>
          </button>

          {/* Empty State */}
          {filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 mx-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-archilya-text-dim/20 mb-4">
                <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.3-.5l-2.8-2A2 2 0 0 0 6.8 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
              </svg>
              <p className="text-[13px] text-archilya-text-dim/60 tracking-wide mb-2">Bu klasörde dosya bulunmuyor.</p>
              <p className="text-[11px] text-archilya-text-dim/40 tracking-wide">Dosya yüklemek için yukarıdaki alanı kullanın veya sürükleyip bırakın.</p>
            </div>
          )}

          {/* File Views */}
          {viewMode === 'list' ? (
            <ProjectFileTable
              items={filteredItems}
              selectedIds={selectedFileIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onSelectItem={handleSelectItem}
              onAiRename={handleAiRename}
              onLock={handleLock}
              onUnlock={handleUnlock}
              onOpenFile={handleOpenFile}
              isLoading={isLoading}
              onDownload={(id) => console.log('Download', id)}
              onShare={(id) => console.log('Share', id)}
              workMode={workMode}
            />
          ) : (
            <ProjectFileGallery
              items={filteredItems}
              selectedIds={selectedFileIds}
              onToggleSelect={handleToggleSelect}
              onSelectItem={handleSelectItem}
              onAiRename={handleAiRename}
              onLock={handleLock}
              onUnlock={handleUnlock}
              isLoading={false}
              workMode={workMode}
            />
          )}
        </div>
      </div>

      {/* Batch Action Bar */}
      {hasSelectedFiles && (
        <div className="fixed bottom-8 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-archilya-gold/20 bg-[#101010]/95 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <span className="border-r border-white/[0.08] pr-4 text-[11px] font-mono tracking-wider text-archilya-text">
            {selectedFileCount} dosya seçildi
          </span>
          <button
            type="button"
            onClick={handleBatchDownload}
            className="h-8 rounded-lg border border-archilya-gold/25 bg-archilya-gold/[0.08] px-3 text-[10px] font-display tracking-widest text-archilya-gold transition-colors hover:bg-archilya-gold hover:text-black"
          >
            Toplu İndir
          </button>
          <button
            type="button"
            onClick={handleBatchMove}
            className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[10px] font-display tracking-widest text-archilya-text-dim transition-colors hover:border-archilya-gold/25 hover:text-archilya-gold"
          >
            Taşı
          </button>
          <button
            type="button"
            onClick={handleBatchDelete}
            className="h-8 rounded-lg border border-red-400/20 bg-red-500/[0.06] px-3 text-[10px] font-display tracking-widest text-red-300 transition-colors hover:border-red-400/40 hover:bg-red-500/15 hover:text-red-200"
          >
            Sil
          </button>
        </div>
      )}

      {/* Inspector Panel */}
      <ProjectFileInspector
        item={inspectorItem}
        isOpen={inspectorItem !== null}
        onClose={handleCloseInspector}
        isLoading={isVersionsLoading}
        versions={fileVersions.map((v) => ({
          id: v.id,
          versionCode: v.name,
          createdAt: v.createdAt,
          size: formatBytes(v.size),
          author: v.uploadedBy,
          changeNote: v.changeNote,
        }))}
        onCreateVersion={() => {
          const note = window.prompt('Bu revizyonda ne değişti? (Opsiyonel)');
          if (note && inspectorItem && projectId) {
            // En son versiyona not ekle
            const latest = fileVersions[0];
            if (latest) {
              window.api.updateVersionNote({
                projectId,
                versionId: latest.id,
                changeNote: note,
              }).catch((err) => console.error('Not güncelleme hatası:', err));
            }
          }
        }}
        onRestoreVersion={async (versionId) => {
          if (!projectId || !inspectorItem) return;
          const confirmed = window.confirm(
            `${inspectorItem.name} dosyasını seçilen versiyona geri yüklemek istiyor musunuz?\nMevcut dosya .backup olarak kaydedilecektir.`
          );
          if (!confirmed) return;
          try {
            const result = await window.api.restoreFileVersion(projectId, versionId, projectPath);
            if (result.success) {
              alert('Versiyon başarıyla geri yüklendi!');
              // Dosya listesini yenile
              const response = await window.api.listDirectory(projectPath || '');
              if (response.success) setFsItems(response.items);
            } else {
              alert(`Geri yükleme başarısız: ${result.error}`);
            }
          } catch (err) {
            console.error('[ProjectDetailView] Geri yükleme hatası:', err);
            alert('Geri yükleme sırasında bir hata oluştu.');
          }
        }}
        workMode={workMode}
        onCheckOut={() => {
          if (inspectorItem) handleLock(inspectorItem.id);
        }}
        onReadOnlyOpen={() => {
          if (inspectorItem) {
            console.log(`[Salt Okunur] Dosya açılıyor: ${inspectorItem.name}`);
          }
        }}
      />
    </div>
  );
};
