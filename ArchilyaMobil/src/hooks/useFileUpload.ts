import { useRef } from 'react';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import type { UploadTask, UploadTaskSnapshot } from 'firebase/storage';
import { storage } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import type { FileUploadContextType, UploadResult } from '../types';

export function useFileUpload(): FileUploadContextType {
  const { user } = useAuth();
  const abortRef = useRef<UploadTask | null>(null);

  async function uploadFile(file: File | Blob, projectId: string, onProgress?: (percent: number) => void): Promise<UploadResult> {
    if (!user) throw new Error('Oturum acmaniz gerekiyor.');

    const namedFile = file as File;
    const ext = namedFile.name.split('.').pop()!.toLowerCase();
    const path = `users/${user.uid}/projects/${projectId}/${Date.now()}_${namedFile.name}`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);
    abortRef.current = task;

    return new Promise<UploadResult>((resolve, reject) => {
      task.on(
        'state_changed',
        (snapshot: UploadTaskSnapshot) => {
          const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (onProgress) onProgress(percent);
        },
        (error) => reject(error),
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve({
            url,
            name: namedFile.name,
            size: namedFile.size,
            type: ext,
            path,
          });
        }
      );
    });
  }

  function cancelUpload(): void {
    if (abortRef.current) {
      abortRef.current.cancel();
    }
  }

  return { uploadFile, cancelUpload };
}
