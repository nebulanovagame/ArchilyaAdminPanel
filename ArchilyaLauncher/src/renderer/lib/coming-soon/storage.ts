export interface ComingSoonInterest {
  toolId: string;
  email: string;
  submittedAt: number;
}

const STORAGE_KEY = 'archilya-coming-soon-interests';

export function saveInterest(interest: ComingSoonInterest): void {
  try {
    const existing = getAllInterests();
    const filtered = existing.filter(
      (i) => !(i.toolId === interest.toolId && i.email === interest.email)
    );
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([interest, ...filtered])
    );
  } catch {
    // storage full or disabled
  }
}

export function getAllInterests(): ComingSoonInterest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ComingSoonInterest[];
  } catch {
    return [];
  }
}

export function hasInterest(toolId: string, email: string): boolean {
  return getAllInterests().some(
    (i) => i.toolId === toolId && i.email === email
  );
}
