export interface FileVersion {
  id: string;
  versionCode: string;
  createdAt: string;
  size: string;
  author: string;
  changeNote?: string;
}

export const PROJECT_FILE_VERSIONS: Map<string, FileVersion[]> = new Map([
  [
    'f02-1',
    [
      {
        id: 'v-f02-1-4',
        versionCode: 'Zemin_Kat_Plan_Revizyon_B_2026-05-02_1430.dwg',
        createdAt: '2026-05-02T14:30:00.000Z',
        size: '156 MB',
        author: 'Ahmet Yilmaz',
      },
      {
        id: 'v-f02-1-3',
        versionCode: 'Zemin_Kat_Plan_Revizyon_A_2026-04-29_1545.dwg',
        createdAt: '2026-04-29T15:45:00.000Z',
        size: '148 MB',
        author: 'Ayşe Hanım',
      },
      {
        id: 'v-f02-1-2',
        versionCode: 'Zemin_Kat_Plan_v3_2026-04-25_0900.dwg',
        createdAt: '2026-04-25T09:00:00.000Z',
        size: '142 MB',
        author: 'Ahmet Yilmaz',
      },
      {
        id: 'v-f02-1-1',
        versionCode: 'Zemin_Kat_Plan_v2_2026-04-20_1130.dwg',
        createdAt: '2026-04-20T11:30:00.000Z',
        size: '138 MB',
        author: 'Mehmet Bey',
      },
    ],
  ],
  [
    'f02-3',
    [
      {
        id: 'v-f02-3-3',
        versionCode: 'Ust_Kat_Plan_v2_2026-05-01_1020.dwg',
        createdAt: '2026-05-01T10:20:00.000Z',
        size: '142 MB',
        author: 'Ahmet Yilmaz',
      },
      {
        id: 'v-f02-3-2',
        versionCode: 'Ust_Kat_Plan_v1_2026-04-28_1630.dwg',
        createdAt: '2026-04-28T16:30:00.000Z',
        size: '140 MB',
        author: 'Ayşe Hanım',
      },
      {
        id: 'v-f02-3-1',
        versionCode: 'Ust_Kat_Plan_Taslak_2026-04-22_0815.dwg',
        createdAt: '2026-04-22T08:15:00.000Z',
        size: '135 MB',
        author: 'Ahmet Yilmaz',
      },
    ],
  ],
  [
    'f03-1',
    [
      {
        id: 'v-f03-1-3',
        versionCode: 'Villa_Alpha_Model_v3_2026-04-30_1210.rvt',
        createdAt: '2026-04-30T12:10:00.000Z',
        size: '412 MB',
        author: 'Mehmet Bey',
      },
      {
        id: 'v-f03-1-2',
        versionCode: 'Villa_Alpha_Model_v2_2026-04-20_1015.rvt',
        createdAt: '2026-04-20T10:15:00.000Z',
        size: '405 MB',
        author: 'Selin Arslan',
      },
      {
        id: 'v-f03-1-1',
        versionCode: 'Villa_Alpha_Model_v1_2026-04-15_0945.rvt',
        createdAt: '2026-04-15T09:45:00.000Z',
        size: '398 MB',
        author: 'Ahmet Yilmaz',
      },
    ],
  ],
  [
    'f01-1',
    [
      {
        id: 'v-f01-1-4',
        versionCode: 'Villa_Alpha_Konsept_Raporu_2026-05-02_0900.pdf',
        createdAt: '2026-05-02T09:00:00.000Z',
        size: '18 MB',
        author: 'Ahmet Yilmaz',
      },
      {
        id: 'v-f01-1-3',
        versionCode: 'Villa_Alpha_Konsept_Raporu_2026-04-28_1400.pdf',
        createdAt: '2026-04-28T14:00:00.000Z',
        size: '17 MB',
        author: 'Ayşe Hanım',
      },
      {
        id: 'v-f01-1-2',
        versionCode: 'Villa_Alpha_Konsept_Raporu_2026-04-22_1100.pdf',
        createdAt: '2026-04-22T11:00:00.000Z',
        size: '16 MB',
        author: 'Mehmet Bey',
      },
      {
        id: 'v-f01-1-1',
        versionCode: 'Villa_Alpha_Konsept_Raporu_2026-04-10_1600.pdf',
        createdAt: '2026-04-10T16:00:00.000Z',
        size: '15 MB',
        author: 'Ahmet Yilmaz',
      },
    ],
  ],
]);
