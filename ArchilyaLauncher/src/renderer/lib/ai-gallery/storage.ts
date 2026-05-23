import type { AiGenerationRecord } from '../../types/ai-gallery';

const STORAGE_KEY = 'archilya-ai-gallery';
const DB_NAME = 'archilya-ai-gallery';
const DB_VERSION = 1;
const STORE_NAME = 'generations';
const CREATED_AT_INDEX = 'createdAt';
const PROJECT_ID_INDEX = 'projectId';

let databasePromise: Promise<IDBDatabase> | null = null;

function getIndexedDB(): IDBFactory {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available in this environment.');
  }

  return indexedDB;
}

function getLocalStorage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

function createObjectStore(db: IDBDatabase): IDBObjectStore {
  const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
  store.createIndex(CREATED_AT_INDEX, CREATED_AT_INDEX);
  store.createIndex(PROJECT_ID_INDEX, PROJECT_ID_INDEX);
  return store;
}

function ensureIndexes(store: IDBObjectStore) {
  if (!store.indexNames.contains(CREATED_AT_INDEX)) {
    store.createIndex(CREATED_AT_INDEX, CREATED_AT_INDEX);
  }

  if (!store.indexNames.contains(PROJECT_ID_INDEX)) {
    store.createIndex(PROJECT_ID_INDEX, PROJECT_ID_INDEX);
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = getIndexedDB().open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.objectStoreNames.contains(STORE_NAME)
          ? request.transaction?.objectStore(STORE_NAME)
          : createObjectStore(db);

        if (store) {
          ensureIndexes(store);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();

        migrateLocalStorage(db)
          .then(() => resolve(db))
          .catch((error) => {
            console.error('Failed to migrate AI gallery localStorage data:', error);
            reject(error);
          });
      };

      request.onerror = () => {
        console.error('Failed to open AI gallery IndexedDB:', request.error);
        reject(request.error ?? new Error('Failed to open AI gallery IndexedDB.'));
      };

      request.onblocked = () => {
        console.error('AI gallery IndexedDB open is blocked by another connection.');
      };
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}

async function migrateLocalStorage(db: IDBDatabase): Promise<void> {
  const storage = getLocalStorage();
  const raw = storage?.getItem(STORAGE_KEY);
  if (!raw) return;

  let records: AiGenerationRecord[];

  try {
    records = JSON.parse(raw) as AiGenerationRecord[];
  } catch (error) {
    console.error('Failed to parse AI gallery localStorage data:', error);
    throw error;
  }

  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  records.forEach((record) => {
    store.put(record);
  });

  await transactionDone(transaction);
  storage.removeItem(STORAGE_KEY);
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, mode);
  const request = callback(transaction.objectStore(STORE_NAME));
  const [result] = await Promise.all([requestToPromise(request), transactionDone(transaction)]);
  return result;
}

export async function saveGeneration(record: AiGenerationRecord): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.put(record));
  } catch (error) {
    console.error('Failed to save AI generation:', error);
    throw error;
  }
}

export async function getGenerations(): Promise<AiGenerationRecord[]> {
  try {
    const records = await withStore('readonly', (store) => store.getAll());
    return records.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('Failed to load AI generations:', error);
    throw error;
  }
}

export async function deleteGeneration(id: string): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.delete(id));
  } catch (error) {
    console.error('Failed to delete AI generation:', error);
    throw error;
  }
}

export async function updateGeneration(
  id: string,
  partial: Partial<AiGenerationRecord>
): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const existing = request.result as AiGenerationRecord | undefined;
        if (existing) {
          store.put({ ...existing, ...partial });
        }
      };

      request.onerror = () => {
        reject(request.error ?? new Error('Failed to read AI generation for update.'));
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
    });
  } catch (error) {
    console.error('Failed to update AI generation:', error);
    throw error;
  }
}

export async function clearAllGenerations(): Promise<void> {
  try {
    await withStore('readwrite', (store) => store.clear());
    getLocalStorage()?.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear AI generations:', error);
    throw error;
  }
}

export async function getGenerationsByProject(projectId: string): Promise<AiGenerationRecord[]> {
  try {
    const records = await withStore('readonly', (store) =>
      store.index(PROJECT_ID_INDEX).getAll(projectId)
    );
    return records.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('Failed to load AI generations by project:', error);
    throw error;
  }
}
