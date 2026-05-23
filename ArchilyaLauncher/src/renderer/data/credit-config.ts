import { AI_TOOLS } from './aiStudioMockData';

const CREDITS_STORAGE_KEY = 'archilya-mock-credits';
const DEFAULT_CREDITS = 840;
const LOW_CREDITS_THRESHOLD = 50;

export interface CreditConfig {
  balance: number;
  isLow: boolean;
}

export function getCreditBalance(): number {
  try {
    const raw = localStorage.getItem(CREDITS_STORAGE_KEY);
    if (raw === null) return DEFAULT_CREDITS;
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) ? DEFAULT_CREDITS : parsed;
  } catch {
    return DEFAULT_CREDITS;
  }
}

export function setCreditBalance(amount: number): void {
  try {
    localStorage.setItem(CREDITS_STORAGE_KEY, String(Math.max(0, amount)));
  } catch {
    // storage full or disabled
  }
}

export function getCreditConfig(): CreditConfig {
  const balance = getCreditBalance();
  return {
    balance,
    isLow: balance < LOW_CREDITS_THRESHOLD,
  };
}

export function getToolCreditCost(toolId: string): number {
  const tool = AI_TOOLS.find((t) => t.id === toolId);
  return tool?.creditCost ?? 0;
}

export function hasEnoughCredits(toolId: string): boolean {
  return getCreditBalance() >= getToolCreditCost(toolId);
}

export function deductCredits(amount: number): boolean {
  const current = getCreditBalance();
  if (current < amount) return false;
  setCreditBalance(current - amount);
  return true;
}

export function addCredits(amount: number): void {
  setCreditBalance(getCreditBalance() + amount);
}
