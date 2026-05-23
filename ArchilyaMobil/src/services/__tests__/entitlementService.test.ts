/// <reference types="jest" />

jest.mock('../../config/firebase', () => ({ app: {}, db: {}, storage: {}, auth: {} }));
jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(() => jest.fn()),
}));

import { extractCallableData } from '../entitlementService';

describe('entitlementService helpers', () => {
  it('extracts callable data when present', () => {
    expect(extractCallableData({ data: { success: true, value: 42 } })).toEqual({ success: true, value: 42 });
  });

  it('falls back to a failure object when data is missing', () => {
    expect(extractCallableData(undefined)).toEqual({ success: false });
    expect(extractCallableData({})).toEqual({ success: false });
  });
});
