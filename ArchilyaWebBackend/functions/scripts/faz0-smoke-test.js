/**
 * FAZ 0 Smoke Tests
 * ArchilyaWebBackend stabilizasyonu icin basit smoke testler.
 * Calistir: node scripts/faz0-smoke-test.js
 */

const assert = require('assert');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n========================================');
console.log('FAZ 0 Backend Smoke Tests');
console.log('========================================\n');

// Test 1: Tool Pricing Module
console.log('[1] Tool Pricing Module');
const { TOOL_COSTS, getToolCost, getToolCostOrNull, listToolCosts } = require('../src/config/tool-pricing');

test('TOOL_COSTS should have correct values', () => {
  assert.strictEqual(TOOL_COSTS.analysis, 5);
  assert.strictEqual(TOOL_COSTS.img2img, 15);
  assert.strictEqual(TOOL_COSTS.enhance, 15);
  assert.strictEqual(TOOL_COSTS.sceneedit, 25);
  assert.strictEqual(TOOL_COSTS.plancolor, 15);
  assert.strictEqual(TOOL_COSTS.revise, 10);
});

test('getToolCost should return correct cost for known tools', () => {
  assert.strictEqual(getToolCost('analysis'), 5);
  assert.strictEqual(getToolCost('img2img'), 15);
  assert.strictEqual(getToolCost('sceneedit'), 25);
});

test('getToolCost should throw for unknown tool', () => {
  assert.throws(() => getToolCost('unknown-tool'), /Gecersiz AI araci/);
});

test('getToolCostOrNull should return null for unknown tool', () => {
  assert.strictEqual(getToolCostOrNull('unknown-tool'), null);
});

test('listToolCosts should return all tools', () => {
  const list = listToolCosts();
  assert.strictEqual(list.length, 6);
  assert.ok(list.some((item) => item.toolId === 'analysis' && item.cost === 5));
});

// Test 2: Job Events Module
console.log('\n[2] Job Events Module');
const { EVENT_TYPES, recordJobEvent } = require('../src/shared/job-events');

test('EVENT_TYPES should have all required events', () => {
  assert.ok(EVENT_TYPES.QUEUED);
  assert.ok(EVENT_TYPES.CLAIMED);
  assert.ok(EVENT_TYPES.CHARGE_STARTED);
  assert.ok(EVENT_TYPES.CHARGED);
  assert.ok(EVENT_TYPES.STARTED);
  assert.ok(EVENT_TYPES.PROVIDER_CALL_STARTED);
  assert.ok(EVENT_TYPES.PROVIDER_CALL_FAILED);
  assert.ok(EVENT_TYPES.RETRY_SCHEDULED);
  assert.ok(EVENT_TYPES.COMPLETED);
  assert.ok(EVENT_TYPES.FAILED);
  assert.ok(EVENT_TYPES.STALE_RECOVERED);
  assert.ok(EVENT_TYPES.DEAD_LETTERED);
  assert.ok(EVENT_TYPES.MANUAL_RETRY);
});

test('recordJobEvent should handle missing params gracefully', async () => {
  const result = await recordJobEvent({});
  assert.strictEqual(result, null);
});

// Test 3: Health Check Module
console.log('\n[3] Health Check Module');
const { runHealthChecks } = require('../src/shared/health-check');

test('runHealthChecks should return structured response', async () => {
  const health = await runHealthChecks();
  assert.ok(health.status === 'ok' || health.status === 'degraded' || health.status === 'down');
  assert.ok(health.checks);
  assert.ok(health.checks.supabase);
  assert.ok(health.checks.storage);
  assert.ok(health.checks.gemini);
  assert.ok(health.checks.r2);
  assert.ok(health.timestamp);
});

// Test 4: Rate Limiter Module
console.log('\n[4] Rate Limiter Module');
const { checkRateLimit } = require('../src/shared/rate-limiter');

test('checkRateLimit should allow when no identifier', async () => {
  const result = await checkRateLimit({ prefix: 'test' });
  assert.strictEqual(result.allowed, true);
});

// Test 5: Retry Architecture Constants (indirect via processor import)
console.log('\n[5] Processor Module Imports');
const processor = require('../src/ai-jobs/processor');

test('processor should export required functions', () => {
  assert.strictEqual(typeof processor.processAiStudioJob, 'function');
  assert.strictEqual(typeof processor.processQueuedAiStudioJobs, 'function');
  assert.strictEqual(typeof processor.recoverStaleAiStudioJobs, 'function');
});

// Test 6: Gemini Module
console.log('\n[6] Gemini Module');
const gemini = require('../src/ai-jobs/gemini');

test('gemini should export required functions', () => {
  assert.strictEqual(typeof gemini.generateWithFallback, 'function');
  assert.strictEqual(typeof gemini.extractText, 'function');
  assert.strictEqual(typeof gemini.extractImage, 'function');
});

// Test 7: Express Module Imports
console.log('\n[7] Express AI Jobs Module');
const aiJobsExpress = require('../src/ai-jobs/express');

test('express module should export createAiStudioJobSecure', () => {
  assert.strictEqual(typeof aiJobsExpress.createAiStudioJobSecure, 'function');
});

// Summary
console.log('\n========================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}
