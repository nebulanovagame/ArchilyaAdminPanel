/**
 * Archilya AI Studio — Canonical Tool Pricing
 *
 * Tüm AI tool credit maliyetleri buradan okunur.
 * Başka dosyada hardcoded pricing kullanma.
 */

const TOOL_COSTS = {
  analysis: 5,
  img2img: 15,
  enhance: 15,
  sceneedit: 25,
  plancolor: 15,
  revise: 10,
};

const REVISION_CREDIT_COST = 10;

function getToolCost(toolId) {
  const normalized = String(toolId || '').trim().toLowerCase();
  const cost = TOOL_COSTS[normalized];
  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error(`Gecersiz AI araci veya fiyati: ${toolId}`);
  }
  return cost;
}

function getToolCostOrNull(toolId) {
  try {
    return getToolCost(toolId);
  } catch {
    return null;
  }
}

function listToolCosts() {
  return Object.entries(TOOL_COSTS).map(([toolId, cost]) => ({ toolId, cost }));
}

module.exports = {
  TOOL_COSTS,
  REVISION_CREDIT_COST,
  getToolCost,
  getToolCostOrNull,
  listToolCosts,
};
