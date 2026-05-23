import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import type { DocumentData, FirestoreError, QuerySnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../services/analyticsService';
import {
  createProjectSecure,
  hardDeleteProjectSecure,
  restoreProjectSecure,
  softDeleteProjectSecure,
  updateProjectSecure,
} from '../services/entitlementService';
import type { Project, ProjectsContextType } from '../types';

const PROJECTS_CACHE_PREFIX = 'archilya_projects_cache_';

type TimestampLike = { toDate?: () => Date };
type ProjectDoc = QuerySnapshot<DocumentData>['docs'][number];

function hasToDate(value: unknown): value is TimestampLike {
  return Boolean(value && typeof value === 'object' && typeof (value as TimestampLike).toDate === 'function');
}

export function toDate(value: unknown): Date {
  if (hasToDate(value) && value.toDate?.()) return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

export function normalizeProjectDocs(docsA: ProjectDoc[], docsB: ProjectDoc[]): Project[] {
  const byId = new Map<string, ProjectDoc>();
  [...docsA, ...docsB].forEach((d) => {
    byId.set(d.id, d);
  });

  return [...byId.values()]
    .map((d) => {
      const row = d.data();
      return {
        id: d.id,
        ...row,
        createdAt: toDate(row.createdAt),
        updatedAt: toDate(row.updatedAt),
      } as Project;
    })
    .filter((p) => !p.isDeleted)
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
}

export function useProjects(): ProjectsContextType {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect((): Unsubscribe | undefined => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }

    const cacheKey = `${PROJECTS_CACHE_PREFIX}${user.uid}`;
    setLoading(true);

    AsyncStorage.getItem(cacheKey)
      .then((cached) => {
        if (!cached) return;
        const rows: unknown = JSON.parse(cached);
        if (!Array.isArray(rows)) return;

        const hydrated = rows.map((item) => {
          const row = isRecord(item) ? item : {};
          return {
            ...row,
            createdAt: toDate(row.createdAt),
            updatedAt: toDate(row.updatedAt),
          } as Project;
        });

        setProjects(hydrated);
        setLoading(false);
      })
      .catch(() => null);

    let ownerDocs: ProjectDoc[] = [];
    let memberDocs: ProjectDoc[] = [];

    const normalize = (docsA: ProjectDoc[], docsB: ProjectDoc[]): void => {
      const data = normalizeProjectDocs(docsA, docsB);

      setProjects(data);
      AsyncStorage.setItem(cacheKey, JSON.stringify(data)).catch(() => null);
      setLoading(false);
      setError(null);
    };

    const ownerQ = query(
      collection(db, 'projects'),
      where('ownerId', '==', user.uid),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );
    const memberQ = query(
      collection(db, 'projects'),
      where('memberUids', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );

    const unsubOwner: Unsubscribe = onSnapshot(
      ownerQ,
      (snap: QuerySnapshot<DocumentData>) => {
        ownerDocs = snap.docs;
        normalize(ownerDocs, memberDocs);
      },
      (err: FirestoreError) => {
        setError(err.message || 'Proje verileri alinamadi');
        setLoading(false);
      }
    );

    const unsubMember: Unsubscribe = onSnapshot(
      memberQ,
      (snap: QuerySnapshot<DocumentData>) => {
        memberDocs = snap.docs;
        normalize(ownerDocs, memberDocs);
      },
      (err: FirestoreError) => {
        setError(err.message || 'Proje verileri alinamadi');
        setLoading(false);
      }
    );

    return () => {
      unsubOwner();
      unsubMember();
    };
  }, [user]);

  async function addProject(projectData: { name: string; location?: string; status?: string }): ReturnType<ProjectsContextType['addProject']> {
    if (!user) throw new Error('Oturum acmaniz gerekiyor.');

    const result = await createProjectSecure({
      name: projectData?.name,
      location: projectData?.location,
      status: projectData?.status || 'Aktif',
      displayName: user.displayName || '',
      email: user.email || '',
    });

    if (!result?.success) {
      throw new Error(result?.message || 'Proje olusturulamadi.');
    }

    void trackEvent('project_create', {
      project_id: String(result?.project?.id || result?.projectId || ''),
      status: projectData?.status || 'Aktif',
    });

    return result as Awaited<ReturnType<ProjectsContextType['addProject']>>;
  }

  async function updateProject(projectId: string, data: Partial<Project>): ReturnType<ProjectsContextType['updateProject']> {
    if (!projectId) throw new Error('Proje kimligi bulunamadi.');
    const result = await updateProjectSecure(projectId, data || {});
    if (!result?.success) {
      throw new Error(result?.message || 'Proje guncellenemedi.');
    }
    return result;
  }

  async function deleteProject(projectId: string): ReturnType<ProjectsContextType['deleteProject']> {
    if (!projectId) throw new Error('Proje kimligi bulunamadi.');
    const result = await softDeleteProjectSecure(projectId);
    if (!result?.success) {
      throw new Error(result?.message || 'Proje cop kutusuna tasinamadi.');
    }
    return result;
  }

  async function restoreProject(projectId: string): ReturnType<ProjectsContextType['restoreProject']> {
    if (!projectId) throw new Error('Proje kimligi bulunamadi.');
    const result = await restoreProjectSecure(projectId);
    if (!result?.success) {
      throw new Error(result?.message || 'Proje geri yuklenemedi.');
    }
    return result;
  }

  async function hardDeleteProject(projectId: string): ReturnType<ProjectsContextType['hardDeleteProject']> {
    if (!projectId) throw new Error('Proje kimligi bulunamadi.');
    const result = await hardDeleteProjectSecure(projectId);
    if (!result?.success) {
      throw new Error(result?.message || 'Proje kalici olarak silinemedi.');
    }
    return result;
  }

  return {
    projects,
    loading,
    error,
    addProject,
    updateProject,
    deleteProject,
    restoreProject,
    hardDeleteProject,
  };
}
