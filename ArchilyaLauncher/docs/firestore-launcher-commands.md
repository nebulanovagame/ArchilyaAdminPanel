# Firestore Launcher Commands

Bu dokuman, `Archilya Launcher` uzaktan tetikleme akisini tanimlar.

## Koleksiyon

- Koleksiyon adi: `launcherCommands`

## Komut Dokumani Alani

```ts
{
  targetMachineId: string; // zorunlu
  command: 'START_STREAM' | 'STOP_STREAM'; // zorunlu
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'ignored'; // zorunlu

  // opsiyonel
  projectId?: string;
  mapName?: string;
  requestedBy?: string;
  expiresAt?: Timestamp;

  // launcher tarafi doldurur
  resultUrl?: string | null;
  errorMessage?: string | null;
  processingStartedAt?: Timestamp;
  processedAt?: Timestamp;
  processedByMachineId?: string;
}
```

## Islem Akisi

1. Backend komutu `status: 'pending'` ile yazar.
2. Launcher sadece kendi `targetMachineId` degerini dinler.
3. Launcher komutu `processing` durumuna ceker.
4. Komut calistirilir:
   - `START_STREAM` -> Pixel Streaming baslatilir.
   - `STOP_STREAM` -> Aktif yayin sonlandirilir.
5. Sonuc Firestore'a geri yazilir:
   - basariliysa `completed`
   - hatada `failed`
   - kurala takilirsa `ignored`

## Kurallar

- Ayni anda tek komut islenir.
- `expiresAt` gecmis komutlar `ignored` olur.
- Aktif yayin varken ikinci `START_STREAM` komutu `ignored` olur.
- Aktif yayin yokken `STOP_STREAM` komutu `ignored` olur.

## Ornek START_STREAM

```json
{
  "targetMachineId": "arch-1234abcd",
  "command": "START_STREAM",
  "status": "pending",
  "projectId": "villa-projesi",
  "mapName": "002_Main_Map_vr",
  "requestedBy": "admin@archilya.com"
}
```

## Ornek STOP_STREAM

```json
{
  "targetMachineId": "arch-1234abcd",
  "command": "STOP_STREAM",
  "status": "pending",
  "requestedBy": "admin@archilya.com"
}
```

## Notlar

- Launcher acildiginda dinleyici otomatik devreye girer.
- Launcher kapanirken dinleyici ve aktif yayin surecleri durdurulur.
- Firestore rules tarafinda launcher istemcisi icin `machineId` custom claim beklenir.
- Backend komut yazimi icin `admin=true` veya `role=backend/server` claim kullanilir.
