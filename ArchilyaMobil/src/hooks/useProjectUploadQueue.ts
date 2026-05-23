import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '../context/AuthContext';
import { drainProjectUploadQueue } from '../services/projectUploadQueue';
import { captureException } from '../services/errorTracking';

export function useProjectUploadQueue() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    let active = true;

    const requestDrain = async (reason: string) => {
      try {
        const state = await NetInfo.fetch();
        if (!active) return;
        if (!state.isConnected || state.isInternetReachable === false) {
          return;
        }

        await drainProjectUploadQueue({
          userId: user.uid,
          reason,
        });
      } catch (error) {
        captureException(error, {
          scope: 'mobile_project_upload_queue_lifecycle',
          reason,
        });
      }
    };

    void requestDrain('auth_ready');

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void requestDrain('connectivity_regained');
      }
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void requestDrain('app_foreground');
      }
    });

    return () => {
      active = false;
      unsubscribeNetInfo();
      appStateSubscription.remove();
    };
  }, [user?.uid]);
}
