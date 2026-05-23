jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  onSnapshot: jest.fn(() => jest.fn()),
  query: jest.fn(),
  where: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../../services/analyticsService', () => ({ trackEvent: jest.fn() }));
jest.mock('../../services/entitlementService', () => ({
  createProjectSecure: jest.fn(),
  hardDeleteProjectSecure: jest.fn(),
  restoreProjectSecure: jest.fn(),
  softDeleteProjectSecure: jest.fn(),
  updateProjectSecure: jest.fn(),
}));

import { toDate, normalizeProjectDocs } from '../../hooks/useProjects';
import type { Project } from '../../types';

describe('toDate', () => {
  it('returns Date from TimestampLike', () => {
    const expected = new Date('2024-01-15');
    const timestamp = { toDate: () => expected };
    expect(toDate(timestamp)).toEqual(expected);
  });

  it('parses valid date string', () => {
    expect(toDate('2024-03-20')).toEqual(new Date('2024-03-20'));
  });

  it('parses valid timestamp number', () => {
    const ts = 1700000000000;
    expect(toDate(ts)).toEqual(new Date(ts));
  });

  it('falls back to current Date for invalid input', () => {
    const before = new Date();
    const result = toDate('not-a-date');
    const after = new Date();
    expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('falls back to current Date for null', () => {
    const before = new Date();
    const result = toDate(null);
    const after = new Date();
    expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe('normalizeProjectDocs', () => {
  const createDoc = (id: string, data: Record<string, unknown>) => ({
    id,
    data: () => data,
  });

  it('merges owner and member docs by id', () => {
    const docsA = [createDoc('p1', { name: 'Proje A', isDeleted: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' })];
    const docsB = [createDoc('p2', { name: 'Proje B', isDeleted: false, createdAt: '2024-01-02', updatedAt: '2024-01-02' })];

    const result = normalizeProjectDocs(docsA as any, docsB as any);

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toContain('p1');
    expect(result.map((p) => p.id)).toContain('p2');
  });

  it('deduplicates overlapping docs by id', () => {
    const docsA = [createDoc('p1', { name: 'Proje A', isDeleted: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' })];
    const docsB = [createDoc('p1', { name: 'Proje A', isDeleted: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' })];

    const result = normalizeProjectDocs(docsA as any, docsB as any);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('filters out deleted projects', () => {
    const docsA = [
      createDoc('p1', { name: 'Aktif', isDeleted: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' }),
      createDoc('p2', { name: 'Silinmis', isDeleted: true, createdAt: '2024-01-02', updatedAt: '2024-01-02' }),
    ];

    const result = normalizeProjectDocs(docsA as any, []);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
  });

  it('sorts by createdAt descending', () => {
    const docsA = [
      createDoc('p1', { name: 'Eski', isDeleted: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' }),
      createDoc('p2', { name: 'Yeni', isDeleted: false, createdAt: '2024-01-05', updatedAt: '2024-01-05' }),
      createDoc('p3', { name: 'Orta', isDeleted: false, createdAt: '2024-01-03', updatedAt: '2024-01-03' }),
    ];

    const result = normalizeProjectDocs(docsA as any, []);

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('p2');
    expect(result[1].id).toBe('p3');
    expect(result[2].id).toBe('p1');
  });
});
