export interface MockFileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size: string;
  date: string;
  syncStatus: 'cloud' | 'synced' | 'downloading' | 'uploading';
  parentId: string | null;
  aiSuggestedName?: string;
  lockStatus: 'unlocked' | 'locked' | 'locked_by_me';
  lockedBy?: string;
}

export interface MockFolderNode {
  id: string;
  name: string;
  children: MockFolderNode[];
}

export const MOCK_FILE_ITEMS: MockFileItem[] = [
  // ─── Root Level ────────────────────────────────────────────────────────────
  { id: 'root-1', name: 'Proje_Klasor.md', type: 'file', size: '4 KB', date: '2 dk önce', syncStatus: 'synced', parentId: null, lockStatus: 'unlocked' },

  // ─── 01_Raporlar_ve_Konsept ────────────────────────────────────────────────
  { id: 'f01', name: '01_Raporlar_ve_Konsept', type: 'folder', size: '5 dosya', date: 'Dün', syncStatus: 'cloud', parentId: null, lockStatus: 'unlocked' },
  { id: 'f01-1', name: 'Villa_Alpha_Konsept_Raporu.pdf', type: 'file', size: '18 MB', date: '1 saat önce', syncStatus: 'synced', parentId: 'f01', lockStatus: 'unlocked' },
  { id: 'f01-2', name: 'Konsept_Kroki_Set_v2.pdf', type: 'file', size: '24 MB', date: '2 gün önce', syncStatus: 'synced', parentId: 'f01', lockStatus: 'locked', lockedBy: 'Ayşe Hanım' },
  { id: 'f01-3', name: 'Yapi_Yakit_Analizi.xlsx', type: 'file', size: '2 MB', date: '3 gün önce', syncStatus: 'synced', parentId: 'f01', lockStatus: 'unlocked' },
  { id: 'f01-4', name: 'Musteri_Sunum_Konsept.pptx', type: 'file', size: '64 MB', date: '4 gün önce', syncStatus: 'uploading', parentId: 'f01', lockStatus: 'unlocked' },
  { id: 'ai-1', name: 'rapor_final_2024_eski.pdf', type: 'file', size: '22 MB', date: '2 gün önce', syncStatus: 'cloud', parentId: 'f01', aiSuggestedName: 'Teknik_Rapor_Maliyet_v2024.pdf', lockStatus: 'unlocked' },

  // ─── 02_Cizimler_DWG ───────────────────────────────────────────────────────
  { id: 'f02', name: '02_Cizimler_DWG', type: 'folder', size: '8 dosya', date: 'Dün', syncStatus: 'cloud', parentId: null, lockStatus: 'unlocked' },
  { id: 'f02-1', name: 'Zemin_Kat_Plan.dwg', type: 'file', size: '156 MB', date: '2 dk önce', syncStatus: 'synced', parentId: 'f02', lockStatus: 'locked', lockedBy: 'Ahmet Bey' },
  { id: 'f02-2', name: 'Giris_Kat_Plan_v3.dwg', type: 'file', size: '148 MB', date: '1 saat önce', syncStatus: 'synced', parentId: 'f02', lockStatus: 'unlocked' },
  { id: 'f02-3', name: 'Ust_Kat_Plan_v2.dwg', type: 'file', size: '142 MB', date: '3 saat önce', syncStatus: 'synced', parentId: 'f02', lockStatus: 'unlocked' },
  { id: 'f02-4', name: 'Kesit_A-A_Kolon_Detay.dwg', type: 'file', size: '89 MB', date: 'Dün', syncStatus: 'cloud', parentId: 'f02', lockStatus: 'unlocked' },
  { id: 'f02-5', name: 'Kesit_B-B_Merdiven.dwg', type: 'file', size: '74 MB', date: 'Dün', syncStatus: 'cloud', parentId: 'f02', lockStatus: 'unlocked' },
  { id: 'f02-6', name: 'Cephe_Gorunus_Guney.dwg', type: 'file', size: '98 MB', date: '3 gün önce', syncStatus: 'synced', parentId: 'f02', lockStatus: 'unlocked' },
  { id: 'f02-7', name: 'Cephe_Gorunus_Kuzey.dwg', type: 'file', size: '95 MB', date: '3 gün önce', syncStatus: 'synced', parentId: 'f02', lockStatus: 'unlocked' },
  { id: 'ai-2', name: 'kesin_son_v4_asdf.dwg', type: 'file', size: '134 MB', date: 'Dün', syncStatus: 'synced', parentId: 'f02', aiSuggestedName: 'Zemin_Kat_Plani_v4.dwg', lockStatus: 'unlocked' },

  // ─── 03_3D_ve_VR ───────────────────────────────────────────────────────────
  { id: 'f03', name: '03_3D_ve_VR', type: 'folder', size: '5 dosya', date: '2 gün önce', syncStatus: 'cloud', parentId: null, lockStatus: 'unlocked' },
  { id: 'f03-1', name: 'Villa_Alpha_Model_v3.rvt', type: 'file', size: '412 MB', date: '4 gün önce', syncStatus: 'downloading', parentId: 'f03', lockStatus: 'unlocked' },
  { id: 'f03-2', name: 'Cephe_Tasarim_v2.skp', type: 'file', size: '234 MB', date: '1 saat önce', syncStatus: 'downloading', parentId: 'f03', lockStatus: 'unlocked' },
  { id: 'f03-3', name: 'Ic_Mekan_Model.skp', type: 'file', size: '187 MB', date: '3 gün önce', syncStatus: 'synced', parentId: 'f03', lockStatus: 'unlocked' },
  { id: 'f03-4', name: 'Yapi_Bilgi_Modeli.ifc', type: 'file', size: '156 MB', date: '2 gün önce', syncStatus: 'synced', parentId: 'f03', lockStatus: 'unlocked' },
  { id: 'f03-5', name: 'BIM_Aile_Kutuphanesi.rfa', type: 'file', size: '28 MB', date: '1 hafta önce', syncStatus: 'cloud', parentId: 'f03', lockStatus: 'unlocked' },

  // ─── 04_Sartnameler_ve_Evraklar ────────────────────────────────────────────
  { id: 'f04', name: '04_Sartnameler_ve_Evraklar', type: 'folder', size: '4 dosya', date: '3 gün önce', syncStatus: 'cloud', parentId: null, lockStatus: 'unlocked' },
  { id: 'f04-1', name: 'Malzeme_Sartnamesi.docx', type: 'file', size: '8 MB', date: 'Dün', syncStatus: 'synced', parentId: 'f04', lockStatus: 'unlocked' },
  { id: 'f04-2', name: 'Is_Sartnamesi.docx', type: 'file', size: '5 MB', date: '2 gün önce', syncStatus: 'synced', parentId: 'f04', lockStatus: 'unlocked' },
  { id: 'f04-3', name: 'Maliyet_Analizi_Detayli.xlsx', type: 'file', size: '3 MB', date: '2 gün önce', syncStatus: 'synced', parentId: 'f04', lockStatus: 'unlocked' },
  { id: 'f04-4', name: 'Elektrik_Sartnamesi.docx', type: 'file', size: '6 MB', date: '3 gün önce', syncStatus: 'synced', parentId: 'f04', lockStatus: 'unlocked' },

  // ─── 05_Musteri_Sunumlari ──────────────────────────────────────────────────
  { id: 'f05', name: '05_Musteri_Sunumlari', type: 'folder', size: '5 dosya', date: '1 hafta önce', syncStatus: 'cloud', parentId: null, lockStatus: 'unlocked' },
  { id: 'f05-1', name: 'Ic_Mekan_Render_Final.jpg', type: 'file', size: '45 MB', date: '2 gün önce', syncStatus: 'synced', parentId: 'f05', lockStatus: 'unlocked' },
  { id: 'f05-2', name: 'Cephe_Render_Gece.jpg', type: 'file', size: '52 MB', date: '3 gün önce', syncStatus: 'cloud', parentId: 'f05', lockStatus: 'unlocked' },
  { id: 'f05-3', name: 'Ic_Mekan_Render_Salon.jpg', type: 'file', size: '38 MB', date: '5 gün önce', syncStatus: 'synced', parentId: 'f05', lockStatus: 'unlocked' },
  { id: 'f05-4', name: 'Villa_Alpha_Sunum_Tum_Fazlar.pdf', type: 'file', size: '64 MB', date: '4 gün önce', syncStatus: 'uploading', parentId: 'f05', lockStatus: 'unlocked' },
  { id: 'f05-5', name: 'VR_Tur_Exported.mp4', type: 'file', size: '210 MB', date: '1 hafta önce', syncStatus: 'cloud', parentId: 'f05', lockStatus: 'unlocked' },
];

export const MOCK_FOLDER_TREE: MockFolderNode[] = [
  { id: 'f01', name: '01_Raporlar_ve_Konsept', children: [] },
  { id: 'f02', name: '02_Cizimler_DWG', children: [] },
  { id: 'f03', name: '03_3D_ve_VR', children: [] },
  { id: 'f04', name: '04_Sartnameler_ve_Evraklar', children: [] },
  { id: 'f05', name: '05_Musteri_Sunumlari', children: [] },
];
