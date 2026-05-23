/// <reference types="jest" />

jest.mock('../../config/firebase', () => ({ app: {}, db: {}, storage: {}, auth: {} }));
jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(() => jest.fn()),
}));
jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  copyAsync: jest.fn(),
  downloadAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}));
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

import { normalizeMimeType, normalizeSceneWorkflow, normalizeStyle } from '../aiStudioService';

describe('aiStudioService pure helpers', () => {
  it('normalizes known style values and falls back to modern', () => {
    expect(normalizeStyle('SCANDINAVIAN')).toBe('scandinavian');
    expect(normalizeStyle('  brutalist  ')).toBe('brutalist');
    expect(normalizeStyle('bilinmeyen-stil')).toBe('modern');
  });

  it('normalizes scene workflow and falls back to scene-compose', () => {
    expect(normalizeSceneWorkflow('PLACE')).toBe('place');
    expect(normalizeSceneWorkflow(' material-swap ')).toBe('material-swap');
    expect(normalizeSceneWorkflow('invalid')).toBe('scene-compose');
  });

  it('normalizes image mime types', () => {
    expect(normalizeMimeType('image/jpg')).toBe('image/jpeg');
    expect(normalizeMimeType(' IMAGE/PNG ')).toBe('image/png');
    expect(normalizeMimeType('')).toBe('');
  });
});
