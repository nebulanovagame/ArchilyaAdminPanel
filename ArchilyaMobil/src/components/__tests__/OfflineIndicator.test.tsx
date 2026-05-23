import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import OfflineIndicator from '../OfflineIndicator';

const mockAddEventListener = jest.fn();
const mockUnsubscribe = jest.fn();

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
  },
}));

describe('OfflineIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddEventListener.mockImplementation(() => mockUnsubscribe);
  });

  it('renders nothing when online', () => {
    const { queryByText } = render(<OfflineIndicator />);

    const callback = mockAddEventListener.mock.calls[0][0];
    callback({ isConnected: true, isInternetReachable: true });

    expect(queryByText(/offline/)).toBeNull();
  });

  it('shows offline banner when isConnected is false', async () => {
    const { getByText } = render(<OfflineIndicator />);

    const callback = mockAddEventListener.mock.calls[0][0];
    callback({ isConnected: false, isInternetReachable: true });

    await waitFor(() => {
      expect(getByText('offline')).toBeTruthy();
    });
  });

  it('shows offline banner when isInternetReachable is false', async () => {
    const { getByText } = render(<OfflineIndicator />);

    const callback = mockAddEventListener.mock.calls[0][0];
    callback({ isConnected: true, isInternetReachable: false });

    await waitFor(() => {
      expect(getByText('offline')).toBeTruthy();
    });
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = render(<OfflineIndicator />);
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
