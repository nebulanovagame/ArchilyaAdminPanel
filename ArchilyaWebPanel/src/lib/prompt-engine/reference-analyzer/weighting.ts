import type { ReferenceBrief, ReferenceType } from "./types";

const BASE_WEIGHTS: Record<ReferenceType, number> = {
  style: 0.6,
  material: 0.8,
  object: 0.5,
  lighting: 0.6,
  layout: 0.3,
  scene: 0.4,
};

const MAX_TOTAL_WEIGHT = 2.0;

function clampWeight(weight: number): number {
  return Math.min(1, Math.max(0, weight));
}

function roundWeight(weight: number): number {
  return Number(weight.toFixed(4));
}

export class ReferenceWeighter {
  calculateWeight(type: ReferenceType, index: number, totalCount: number): number {
    let weight = BASE_WEIGHTS[type];

    if (index === 0) {
      weight += 0.1;
    }

    if (totalCount > 1 && index === totalCount - 1) {
      weight -= 0.05;
    }

    return roundWeight(clampWeight(weight));
  }

  normalizeWeights(refs: ReferenceBrief[]): ReferenceBrief[] {
    const totalWeight = refs.reduce((sum, ref) => sum + ref.weight, 0);

    if (totalWeight <= MAX_TOTAL_WEIGHT) {
      return refs;
    }

    const scale = MAX_TOTAL_WEIGHT / totalWeight;

    return refs.map((ref) => ({
      ...ref,
      weight: roundWeight(clampWeight(ref.weight * scale)),
    }));
  }
}

export function calculateWeight(type: ReferenceType, index: number, totalCount: number): number {
  return new ReferenceWeighter().calculateWeight(type, index, totalCount);
}

export function normalizeWeights(refs: ReferenceBrief[]): ReferenceBrief[] {
  return new ReferenceWeighter().normalizeWeights(refs);
}
