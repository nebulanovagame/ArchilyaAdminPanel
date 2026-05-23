import { doc, updateDoc, arrayUnion, arrayRemove, getDoc, query, collection, where, getDocs, orderBy, serverTimestamp, runTransaction } from 'firebase/firestore';
import { ref as storageRef, getDownloadURL, getBytes } from 'firebase/storage';
import { db, storage } from '../firebase';
import type { FileVersionRecord, VersionListResponse, VersionRestoreResponse } from '../../shared/versionTypes.js';
import type { ProjectFile } from '../../shared/types';
import log from 'electron-log';

// ════════════════════════════════════════════════════════════
// VERSİYON SERVİSİ — Dosya versiyonlama, listeleme, geri yükleme
// ════════════════════════════════════════════════════════════

/** Bir dosya için bir sonraki versiyon numarasını hesapla */
async function getNextVersionNumber(projectId: string, fileId: string): Promise<number> {
  try {
    const versionsRef = collection(db, 'projects', projectId, 'fileVersions');
    const q = query(
      versionsRef,
      where('fileId', '==', fileId),
      orderBy('versionNumber', 'desc')
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return 1;
    return (snapshot.docs[0].data()?.versionNumber || 0) + 1;
  } catch {
    return 1;
  }
}

/**
 * Yeni bir dosya versiyonu kaydet (upload sonrası çağrılır)
 */
export async function saveFileVersion(
  projectId: string,
  file: ProjectFile
): Promise<{ success: boolean; version?: FileVersionRecord; error?: string }> {
  try {
    const versionNumber = await getNextVersionNumber(projectId, file.name);

    const version: FileVersionRecord = {
      id: `ver_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fileId: file.name, // dosya adı benzersiz kimlik olarak kullanılır
      name: file.name,
      url: file.url,
      path: file.path,
      size: file.size,
      type: file.type,
      storageProvider: file.storageProvider || 'firebase',
      objectKey: file.objectKey,
      contentType: file.contentType || 'application/octet-stream',
      createdAt: new Date().toISOString(),
      uploadedBy: file.uploadedBy || 'Bilinmeyen',
      versionNumber,
    };

    const versionRef = doc(db, 'projects', projectId, 'fileVersions', version.id);
    await updateDoc(versionRef, { ...version });

    // Projeye activityLog ekle
    await updateDoc(doc(db, 'projects', projectId), {
      activityLog: arrayUnion({
        action: 'version_created',
        user: version.uploadedBy,
        timestamp: version.createdAt,
        details: `${file.name} için v${versionNumber} versiyonu oluşturuldu (${formatBytes(file.size)})`,
      }),
      updatedAt: serverTimestamp(),
    });

    return { success: true, version };
  } catch (err: any) {
    log.error('[VersionService] saveFileVersion error:', err);
    return { success: false, error: err.message || 'Versiyon kaydedilemedi.' };
  }
}

/**
 * Bir dosyanın tüm versiyonlarını listele
 */
export async function getFileVersions(
  projectId: string,
  fileId: string
): Promise<VersionListResponse> {
  try {
    const versionsRef = collection(db, 'projects', projectId, 'fileVersions');
    const q = query(
      versionsRef,
      where('fileId', '==', fileId),
      orderBy('versionNumber', 'desc')
    );
    const snapshot = await getDocs(q);

    const versions: FileVersionRecord[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        fileId: data.fileId,
        name: data.name,
        url: data.url,
        path: data.path,
        size: data.size,
        type: data.type,
        storageProvider: data.storageProvider,
        objectKey: data.objectKey,
        contentType: data.contentType,
        createdAt: data.createdAt,
        uploadedBy: data.uploadedBy,
        changeNote: data.changeNote,
        versionNumber: data.versionNumber,
      };
    });

    return { success: true, versions };
  } catch (err: any) {
    log.error('[VersionService] getFileVersions error:', err);
    return { success: false, versions: [], error: err.message || 'Versiyonlar listelenemedi.' };
  }
}

/**
 * Bir versiyonu geri yükle (yerel dosyayı indir + Firestore güncelle)
 */
export async function restoreFileVersion(
  projectId: string,
  versionId: string,
  localDirPath?: string
): Promise<VersionRestoreResponse> {
  try {
    // Versiyonu bul
    const versionRef = doc(db, 'projects', projectId, 'fileVersions', versionId);
    const versionSnap = await getDoc(versionRef);
    if (!versionSnap.exists()) {
      return { success: false, error: 'Versiyon bulunamadı.' };
    }

    const version = versionSnap.data() as FileVersionRecord;

    // Projeyi oku
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) {
      return { success: false, error: 'Proje bulunamadı.' };
    }

    const projectData = projectSnap.data();
    const currentFiles: ProjectFile[] = projectData.files || [];
    const oldFile = currentFiles.find((f) => f.name === version.name);

    // Eğer yerel dizin verildiyse, yerel dosyayı yedekle ve yenisini indir
    if (localDirPath) {
      const fs = await import('fs');
      const path = await import('path');
      const localFilePath = path.join(localDirPath, version.name);

      // Eski dosyayı yedekle (varsa)
      if (fs.existsSync(localFilePath)) {
        const backupName = `${version.name}.backup_${Date.now()}`;
        fs.renameSync(localFilePath, path.join(localDirPath, backupName));
      }

      // Versiyonu indir
      try {
        if (version.storageProvider === 'firebase' && version.path) {
          const sRef = storageRef(storage, version.path);
          const blob = await getBytes(sRef);
          fs.writeFileSync(localFilePath, Buffer.from(blob));
        } else if (version.url) {
          const response = await fetch(version.url);
          const buffer = Buffer.from(await response.arrayBuffer());
          fs.writeFileSync(localFilePath, buffer);
        }
      } catch (downloadErr: any) {
        log.error('[VersionService] İndirme hatası:', downloadErr);
        return { success: false, error: `İndirme hatası: ${downloadErr.message}` };
      }
    }

    // Firestore'daki files[] dizisini güncelle
    // arrayRemove + arrayUnion atomik olarak yapılamaz, ama Firestore updateDoc
    // tek bir çağrıda iki alanı da güncelleyebilir
    const updatedFile: ProjectFile = {
      name: version.name,
      url: version.url,
      path: version.path,
      size: version.size,
      type: version.type,
      storageProvider: version.storageProvider,
      objectKey: version.objectKey,
      contentType: version.contentType,
      folderId: oldFile?.folderId || null,
      createdAt: new Date().toISOString(),
      uploadedBy: version.uploadedBy,
      status: 'active',
    };

    await runTransaction(db, async (transaction) => {
      const projectDoc = await transaction.get(projectRef);
      if (!projectDoc.exists()) {
        throw new Error('Proje bulunamadi.');
      }
      const data = projectDoc.data();
      const currentFiles = (data?.files || []) as ProjectFile[];
      const newFiles = currentFiles
        .filter((f) => f.name !== version.name)
        .concat(updatedFile);
      transaction.update(projectRef, {
        files: newFiles,
        activityLog: arrayUnion({
          action: 'version_restored',
          user: version.uploadedBy,
          timestamp: new Date().toISOString(),
          details: `${version.name} v${version.versionNumber} versiyonuna geri yüklendi`,
        }),
        updatedAt: serverTimestamp(),
      });
    });

    return { success: true, restoredUrl: version.url };
  } catch (err: any) {
    log.error('[VersionService] restoreFileVersion error:', err);
    return { success: false, error: err.message || 'Versiyon geri yüklenemedi.' };
  }
}

/**
 * Versiyona revizyon notu ekle/güncelle
 */
export async function updateVersionNote(
  projectId: string,
  versionId: string,
  changeNote: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const versionRef = doc(db, 'projects', projectId, 'fileVersions', versionId);
    await updateDoc(versionRef, { changeNote });
    return { success: true };
  } catch (err: any) {
    log.error('[VersionService] updateVersionNote error:', err);
    return { success: false, error: err.message || 'Not güncellenemedi.' };
  }
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
