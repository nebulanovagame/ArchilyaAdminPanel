/// <reference types="jest" />

import {
  buildFolderMap,
  buildFolderPath,
  getChildFolders,
  normalizeFolderId,
} from '../projectFileTree';

describe('projectFileTree helpers', () => {
  const folders = [
    { id: 'root-design', name: 'Tasarim', parentFolderId: null },
    { id: 'kitchen', name: 'Mutfak', parentFolderId: 'root-design' },
    { id: 'renders', name: 'Renderlar', parentFolderId: 'kitchen' },
    { id: 'site', name: 'Santiye', parentFolderId: null },
  ];

  it('normalizes empty folder ids to null', () => {
    expect(normalizeFolderId('')).toBeNull();
    expect(normalizeFolderId('  ')).toBeNull();
    expect(normalizeFolderId('abc')).toBe('abc');
  });

  it('builds a parent-aware folder map and path', () => {
    const folderMap = buildFolderMap(folders);
    const path = buildFolderPath('renders', folderMap);

    expect(path.map((folder) => folder.name)).toEqual(['Tasarim', 'Mutfak', 'Renderlar']);
  });

  it('returns immediate child folders for the current level', () => {
    expect(getChildFolders(folders, null).map((folder) => folder.name)).toEqual(['Tasarim', 'Santiye']);
    expect(getChildFolders(folders, 'root-design').map((folder) => folder.name)).toEqual(['Mutfak']);
    expect(getChildFolders(folders, 'kitchen').map((folder) => folder.name)).toEqual(['Renderlar']);
  });
});
