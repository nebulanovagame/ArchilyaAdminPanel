import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getCurrentUser } from './authService';
import type { VrProject, VrProjectFile } from '../../shared/types';
import log from 'electron-log';

/**
 * Admin Paneli Firestore şeması (products koleksiyonu):
 *   title      : string
 *   mapName    : string  ← Admin Panel camelCase kullanıyor
 *   chunkId    : number
 *   files      : { name, url, size }[]
 *   assignedTo : string  (UID)
 *   createdAt  : Timestamp
 *
 * Kullanıcı belgesi (users/{uid}):
 *   owned_project_ids : string[]  ← sahip olunan product ID'leri
 */

/** Firestore products dokümanını VrProject tipine dönüştür */
const PUBLIC_DEMO_CATEGORY = 'demo_map';

function asNonEmptyString(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function normalizeCategory(value: unknown): string | undefined {
  const category = asNonEmptyString(value).toLowerCase();
  return category || undefined;
}

function extractR2ObjectKey(url: string): string {
  const trimmedUrl = asNonEmptyString(url);
  if (!trimmedUrl.toLowerCase().startsWith('r2://')) {
    return '';
  }

  return trimmedUrl.slice(5).trim();
}

function normalizeStorageProvider(value: unknown): string | undefined {
  const provider = asNonEmptyString(value).toLowerCase();
  return provider || undefined;
}

function mapProductFiles(filesValue: unknown): VrProjectFile[] {
  if (!Array.isArray(filesValue)) {
    return [];
  }

  return filesValue
    .map((file) => {
      const fileData = (file || {}) as Record<string, unknown>;
      const name = asNonEmptyString(fileData.name);
      const url = asNonEmptyString(fileData.url);
      const objectKey = asNonEmptyString(fileData.objectKey) || extractR2ObjectKey(url);
      const storageProvider = normalizeStorageProvider(fileData.storageProvider)
        || (objectKey ? 'r2' : undefined);
      const contentType = asNonEmptyString(fileData.contentType) || undefined;

      if (!name || !url) {
        return null;
      }

      const rawSize = fileData.size;
      const parsedSize =
        typeof rawSize === 'number'
          ? rawSize
          : typeof rawSize === 'string'
            ? Number(rawSize)
            : 0;

      const mappedFile: VrProjectFile = {
        name,
        url,
        size: Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : 0,
      };

      if (storageProvider) {
        mappedFile.storageProvider = storageProvider;
      }

      if (objectKey) {
        mappedFile.objectKey = objectKey;
      }

      if (contentType) {
        mappedFile.contentType = contentType;
      }

      return mappedFile;
    })
    .filter((file): file is VrProjectFile => Boolean(file));
}

function mapProductDoc(id: string, data: Record<string, unknown>): VrProject | null {
  const mapName = asNonEmptyString(data.mapName) || asNonEmptyString(data.map_name);
  const files = mapProductFiles(data.files);

  if (!mapName || files.length === 0) {
    return null;
  }

  const category = normalizeCategory(data.category);

  return {
    id,
    title: asNonEmptyString(data.title) || 'İsimsiz Proje',
    map_name: mapName,
    vrMapName: asNonEmptyString(data.vrMapName) || asNonEmptyString(data.vr_map_name) || mapName,
    webShareMapName: asNonEmptyString(data.webShareMapName) || asNonEmptyString(data.web_share_map_name) || mapName,
    category,
    isPublicDemo: category === PUBLIC_DEMO_CATEGORY,
    files,
  };
}

async function fetchProductsByIds(ids: string[]): Promise<VrProject[]> {
  if (ids.length === 0) {
    return [];
  }

  const normalizedIds = ids.map((id) => asNonEmptyString(id)).filter(Boolean);
  if (normalizedIds.length === 0) {
    return [];
  }

  const uniqueIds = Array.from(new Set(normalizedIds));
  const projectsById = new Map<string, VrProject>();
  const CHUNK_SIZE = 30;

  for (let index = 0; index < uniqueIds.length; index += CHUNK_SIZE) {
    const chunk = uniqueIds.slice(index, index + CHUNK_SIZE);
    const chunkResults = await Promise.allSettled(
      chunk.map((productId) => getDoc(doc(db, 'products', productId))),
    );

    chunkResults.forEach((result, chunkIndex) => {
      if (result.status !== 'fulfilled') {
        log.warn('[vrProjectService] fetchProductsByIds read failed:', {
          productId: chunk[chunkIndex],
          error: result.reason,
        });
        return;
      }

      const productSnap = result.value;
      if (!productSnap.exists()) {
        return;
      }

      const project = mapProductDoc(productSnap.id, productSnap.data() as Record<string, unknown>);
      if (project) {
        projectsById.set(project.id, project);
      }
    });
  }

  return uniqueIds
    .map((productId) => projectsById.get(productId))
    .filter((project): project is VrProject => Boolean(project));
}

async function fetchProductsByAssignedUser(uid: string): Promise<VrProject[]> {
  const productsQuery = query(
    collection(db, 'products'),
    where('assignedTo', '==', uid),
  );
  const snapshot = await getDocs(productsQuery);

  return snapshot.docs
    .map((productDoc) => mapProductDoc(productDoc.id, productDoc.data() as Record<string, unknown>))
    .filter((project): project is VrProject => Boolean(project));
}

async function fetchPublicDemoProducts(): Promise<VrProject[]> {
  const publicDemoQuery = query(
    collection(db, 'products'),
    where('category', '==', PUBLIC_DEMO_CATEGORY),
  );
  const snapshot = await getDocs(publicDemoQuery);

  return snapshot.docs
    .map((productDoc) => mapProductDoc(productDoc.id, productDoc.data() as Record<string, unknown>))
    .filter((project): project is VrProject => Boolean(project));
}

function mergeOwnedAndAssignedProjects(
  ownedIds: string[],
  ownedProjects: VrProject[],
  assignedProjects: VrProject[],
): VrProject[] {
  const mergedProjects = new Map<string, VrProject>();
  const idOrder = new Map<string, number>();

  ownedIds.forEach((id, index) => {
    idOrder.set(id, index);
  });

  let assignedOrder = ownedIds.length;
  for (const project of assignedProjects) {
    if (!idOrder.has(project.id)) {
      idOrder.set(project.id, assignedOrder);
      assignedOrder += 1;
    }
    mergedProjects.set(project.id, project);
  }

  for (const project of ownedProjects) {
    mergedProjects.set(project.id, project);
  }

  return Array.from(mergedProjects.values()).sort(
    (left, right) =>
      (idOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (idOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  );
}

function mergeProjectsInPriorityOrder(...groups: VrProject[][]): VrProject[] {
  const seenIds = new Set<string>();
  const merged: VrProject[] = [];

  for (const group of groups) {
    for (const project of group) {
      if (seenIds.has(project.id)) {
        continue;
      }
      seenIds.add(project.id);
      merged.push(project);
    }
  }

  return merged;
}

/**
 * Oturum açmış kullanıcının sahip olduğu VR projelerini çeker.
 * Adımlar:
 *  1. users/{uid} belgesinden owned_project_ids dizisini oku
 *  2. Her ID için products/{id} belgesini getir
 *  3. VrProject dizisine dönüştür
 */
export async function getVrProjects(): Promise<VrProject[]> {
  let publicDemoProjects: VrProject[] = [];

  try {
    publicDemoProjects = await fetchPublicDemoProducts();
  } catch (err) {
    log.error('[vrProjectService] fetchPublicDemoProducts error:', {
      error: err,
    });
  }

  const user = getCurrentUser();
  if (!user || user.isGuest) {
    return mergeProjectsInPriorityOrder(publicDemoProjects);
  }

  try {
    const userRef  = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    const ownedIds: string[] = userSnap.exists()
      ? ((userSnap.data().owned_project_ids || []) as string[])
      : [];

    const [ownedProjects, assignedProjects] = await Promise.all([
      fetchProductsByIds(ownedIds),
      fetchProductsByAssignedUser(user.uid),
    ]);

    const ownedAndAssignedProjects = mergeOwnedAndAssignedProjects(
      ownedIds,
      ownedProjects,
      assignedProjects,
    );

    return mergeProjectsInPriorityOrder(
      publicDemoProjects,
      ownedAndAssignedProjects,
    );
  } catch (err) {
    log.error('[vrProjectService] getVrProjects error:', {
      uid: user.uid,
      email: user.email,
      error: err,
    });
    return mergeProjectsInPriorityOrder(publicDemoProjects);
  }
}

export async function getAssignedVrProjects(uid: string): Promise<VrProject[]> {
  const assignedProjects = await fetchProductsByAssignedUser(uid);
  return mergeProjectsInPriorityOrder(assignedProjects);
}
