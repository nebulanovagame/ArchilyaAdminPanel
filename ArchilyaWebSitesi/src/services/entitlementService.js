import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { captureException } from './errorTracking';

async function callSecure(callable, payload, fallback) {
  try {
    const result = await callable(payload);
    return result?.data ?? fallback;
  } catch (error) {
    captureException(error, { scope: 'site_cloud_function' });
    throw error;
  }
}

const submitContactFormSecureCallable = httpsCallable(functions, 'submitContactFormSecure');

export async function submitContactFormSecure(payload) {
  return await callSecure(submitContactFormSecureCallable, payload, { success: false });
}
