export type ProjectFolderLike = {
  id?: string | null;
  name?: string | null;
  parentFolderId?: string | null;
  [key: string]: unknown;
};

export function normalizeFolderId(value: unknown) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

export function buildFolderMap<T extends ProjectFolderLike>(folders: T[] = []) {
  return new Map<string, T & { parentFolderId: string | null }>(
    (Array.isArray(folders) ? folders : [])
      .filter((folder) => folder?.id)
      .map((folder) => [
        String(folder.id),
        {
          ...folder,
          parentFolderId: normalizeFolderId(folder.parentFolderId),
        },
      ])
  );
}

export function buildFolderPath<T extends ProjectFolderLike>(folderId: string | null, folderMap: Map<string, T>) {
  const path: T[] = [];
  let currentId = normalizeFolderId(folderId);
  const visited = new Set<string>();

  while (currentId && folderMap.has(currentId) && !visited.has(currentId)) {
    visited.add(currentId);
    const folder = folderMap.get(currentId);
    if (!folder) {
      break;
    }
    path.unshift(folder);
    currentId = normalizeFolderId(folder.parentFolderId);
  }

  return path;
}

export function getChildFolders<T extends ProjectFolderLike>(folders: T[] = [], parentFolderId: string | null) {
  return (Array.isArray(folders) ? folders : []).filter(
    (folder) => normalizeFolderId(folder?.parentFolderId) === normalizeFolderId(parentFolderId)
  );
}
