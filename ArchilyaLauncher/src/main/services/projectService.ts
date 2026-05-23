import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  arrayUnion,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import type {
  FirebaseProject,
  FirebaseProjectStatus,
  ProjectFile,
  PakFile,
  VrBuild,
  ActivityEntry,
  CreateProjectData,
} from '../../shared/types';
import log from 'electron-log';

// Firestore doc → FirebaseProject objesi
function mapDoc(d: any): FirebaseProject {
  const allFiles = (d.files || []) as ProjectFile[];
  const activeFiles = allFiles.filter((f) => (f as any).status !== 'trashed');
  const deletedFiles = [
    ...((d.deletedFiles || []) as ProjectFile[]),
    ...allFiles.filter((f) => (f as any).status === 'trashed'),
  ];

  return {
    id:           d.id,
    name:         d.name          || '',
    description:  d.description   || '',
    status:       (d.status as FirebaseProjectStatus) || 'Aktif',
    location:     d.location      || '',
    uid:          d.uid           || '',
    memberUids:   d.memberUids    || [],
    team:         (d.team         || []) as { uid: string; email: string; role: string }[],

    // ── Mimari dosyalar (web paneli) ──
    files:        activeFiles,
    deletedFiles,
    fileCount:    d.fileCount     || { pdf: 0, dwg: 0, img: 0 },
    totalSize:    d.totalSize     || 0,

    // ── PAK / VR Build sistemi (sadece Launcher) ──
    pak_files:    (d.pak_files    || []) as PakFile[],
    map_name:     d.map_name      || '',
    vr_builds:    (d.vr_builds    || []) as VrBuild[],

    activityLog:  (d.activityLog  || []) as ActivityEntry[],
    isDeleted:    d.isDeleted     || false,
    createdAt:    d.createdAt?.toDate?.() ?? new Date(),
    updatedAt:    d.updatedAt?.toDate?.() ?? new Date(),
  };
}

// ── Real-time Subscribe ──────────────────────────────────────────────────────
export function subscribeToProjects(
  uid: string,
  callback: (projects: FirebaseProject[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'projects'),
    where('memberUids', 'array-contains', uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const projects = snapshot.docs
        .map((d) => mapDoc({ id: d.id, ...d.data() }))
        .filter((p) => !p.isDeleted)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      callback(projects);
    },
    (err) => {
      log.error('[projectService] Firestore snapshot error:', err);
      onError?.(err);
    }
  );
}

// ── Add Project ──────────────────────────────────────────────────────────────
export async function addProject(
  data: CreateProjectData
): Promise<{ success: boolean; id?: string; error?: string }> {
  const user = auth.currentUser;
  if (!user) return { success: false, error: 'Oturum açmanız gerekiyor.' };

  try {
    const ref = await addDoc(collection(db, 'projects'), {
      name:        data.name.trim(),
      description: data.description.trim(),
      status:      data.status,
      location:    data.location.trim(),
      uid:         user.uid,
      memberUids:  [user.uid],

      // Mimari dosyalar — boş başlar
      files:        [],
      deletedFiles: [],
      fileCount:    { pdf: 0, dwg: 0, img: 0 },
      totalSize:    0,

      // PAK sistemi — boş başlar, sadece Launcher doldurur
      pak_files:    [],
      map_name:     '',
      vr_builds:    [],

      activityLog: [{
        action:    'create',
        user:      user.displayName || user.email,
        timestamp: new Date().toISOString(),
        details:   'Proje oluşturuldu (Launcher)',
      }],
      team:        [{ uid: user.uid, email: user.email, role: 'owner' }],
      invites:     [],
      isDeleted:   false,
      deletedAt:   null,
      createdAt:   serverTimestamp(),
      updatedAt:   serverTimestamp(),
    });
    return { success: true, id: ref.id };
  } catch (err: any) {
    log.error('[projectService] addProject error:', err);
    return { success: false, error: err.message };
  }
}

// ── Update Project (mimari bilgiler) ─────────────────────────────────────────
export async function updateProject(
  projectId: string,
  data: Partial<Pick<FirebaseProject, 'name' | 'description' | 'status' | 'location'>>
): Promise<{ success: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user) return { success: false, error: 'Oturum açmanız gerekiyor.' };

  try {
    await updateDoc(doc(db, 'projects', projectId), {
      ...data,
      activityLog: arrayUnion({
        action:    'update',
        user:      user.displayName || user.email,
        timestamp: new Date().toISOString(),
        details:   'Proje bilgileri güncellendi (Launcher)',
      }),
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Soft Delete ──────────────────────────────────────────────────────────────
export async function deleteProject(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user) return { success: false, error: 'Oturum açmanız gerekiyor.' };

  try {
    await updateDoc(doc(db, 'projects', projectId), {
      isDeleted:   true,
      deletedAt:   serverTimestamp(),
      activityLog: arrayUnion({
        action:    'delete',
        user:      user.displayName || user.email,
        timestamp: new Date().toISOString(),
        details:   'Proje çöp kutusuna taşındı (Launcher)',
      }),
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
