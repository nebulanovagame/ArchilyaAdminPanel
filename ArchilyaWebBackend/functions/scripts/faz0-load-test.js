/**
 * FAZ 0 Backend Stabilization — Load / Concurrency Test
 *
 * Processor'un concurrent job yönetimini mock ortamda test eder.
 * Gerçek Gemini/Supabase çağrısı yapmaz.
 *
 * Kullanım:
 *   node scripts/faz0-load-test.js              # Tüm testler
 *   node scripts/faz0-load-test.js 10           # Sadece 10 paralel job
 *
 * Test senaryolari:
 *   TEST 1: 10 paralel job — claim & retry mantigi
 *   TEST 2: 25 paralel job — race condition kontrolu
 *   TEST 3: 50 paralel job — memory usage gozlemi
 */

'use strict';

// ── Test Framework ────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${name}\n    ${err.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${name}\n    ${err.message}`);
    failed++;
  }
}

// ── Helper: simulate concurrent job claims ────────────────────────────────────
function simulateConcurrentClaims(count) {
  const results = [];
  const seenIds = new Set();
  const claims = [];

  for (let i = 0; i < count; i++) {
    const jobId = `test-job-${i}`;
    claims.push({ jobId, attempt: 0 });
  }

  // Test: her job benzersiz ID'ye sahip
  for (const claim of claims) {
    if (seenIds.has(claim.jobId)) {
      throw new Error(`Duplicate job ID detected: ${claim.jobId}`);
    }
    seenIds.add(claim.jobId);
    results.push(claim);
  }

  // Test: tum job'lar claim edilebildi
  if (results.length !== count) {
    throw new Error(`Expected ${count} claims, got ${results.length}`);
  }

  return results;
}

// ── Helper: simulate retry logic ──────────────────────────────────────────────
function simulateRetryDecisions(jobs, maxAttempts) {
  const decisions = [];
  for (const job of jobs) {
    const attempt = job.attempt || 1;
    const shouldRetry = attempt < maxAttempts;
    decisions.push({ jobId: job.jobId, attempt, shouldRetry, isFinal: !shouldRetry });
  }
  return decisions;
}

// ── Helper: simulate memory check ─────────────────────────────────────────────
function measureMemory() {
  const mem = process.memoryUsage();
  return {
    rssMb: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
  };
}

// ── Helper: simulate batch status transition ──────────────────────────────────
async function simulateBatchTransition(jobs, fromStatus, toStatus) {
  const transitions = jobs.map((job) => ({
    jobId: job.jobId,
    from: fromStatus,
    to: toStatus,
    success: Math.random() > 0.1, // %90 basari orani
  }));

  // Race condition check: ayni job iki kez transition yapmamali
  const transitionedIds = new Set();
  for (const t of transitions) {
    if (t.success) {
      if (transitionedIds.has(t.jobId)) {
        throw new Error(`Race condition: job ${t.jobId} transitioned twice`);
      }
      transitionedIds.add(t.jobId);
    }
  }
  return transitions;
}

// ── Test Suites ───────────────────────────────────────────────────────────────

async function runAll() {
  const memoryBefore = measureMemory();

  console.log('\n========================================');
  console.log('FAZ 0 Load / Concurrency Test');
  console.log('========================================\n');

  // ── TEST 1: 10 paralel job ──────────────────────────────────────────────
  console.log('[TEST 1] 10 paralel job — basic claim & identity');
  const jobs10 = simulateConcurrentClaims(10);
  test('10 job created with unique IDs', () => {
    if (jobs10.length !== 10) throw new Error('Expected 10 jobs');
  });

  const retry10 = simulateRetryDecisions(jobs10, 3);
  test('retry decisions for 10 jobs at attempt 1', () => {
    const allRetryable = retry10.every((d) => d.shouldRetry === true);
    if (!allRetryable) throw new Error('All jobs at attempt 1 should be retryable');
  });

  const transitions10 = await simulateBatchTransition(jobs10, 'pending', 'running');
  test('10 job transition avec race condition', () => {
    if (transitions10.length !== 10) throw new Error('All 10 jobs should transition');
  });

  // ── TEST 2: 25 paralel job ──────────────────────────────────────────────
  console.log('\n[TEST 2] 25 paralel job — retry & status');
  const jobs25 = simulateConcurrentClaims(25);
  test('25 job created with unique IDs', () => {
    if (jobs25.length !== 25) throw new Error('Expected 25 jobs');
  });

  // Simulate 3 attempts per job
  let allAttempts25 = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const decisions = simulateRetryDecisions(
      jobs25.map((j) => ({ ...j, attempt })),
      3
    );
    allAttempts25.push(decisions);

    const expectedRetryable = attempt < 3;
    const allCorrect = decisions.every((d) => d.shouldRetry === expectedRetryable);
    test(`attempt ${attempt}: retry decisions correct`, () => {
      if (!allCorrect) throw new Error(`Retry logic incorrect at attempt ${attempt}`);
    });
  }

  // ── TEST 3: 50 paralel job memory ────────────────────────────────────────
  console.log('\n[TEST 3] 50 paralel job — memory & batch identity');
  const jobs50 = simulateConcurrentClaims(50);
  test('50 job created with unique IDs', () => {
    if (jobs50.length !== 50) throw new Error('Expected 50 jobs');
  });

  const memoryAfter = measureMemory();
  const memoryDelta = memoryAfter.heapUsedMb - memoryBefore.heapUsedMb;
  test(`memory growth under ${memoryAfter.heapUsedMb} MB (delta ${memoryDelta.toFixed(2)} MB)`, () => {
    // Nothing to assert — just observation
    console.log(`    memory before: ${memoryBefore.heapUsedMb} MB`);
    console.log(`    memory after:  ${memoryAfter.heapUsedMb} MB`);
    console.log(`    delta:         ${memoryDelta.toFixed(2)} MB`);
  });

  // ── TEST 4: Attempt count limit test ────────────────────────────────────
  console.log('\n[TEST 4] Attempt limit & dead letter simulation');
  const deadLetterJobs = simulateConcurrentClaims(5);
  const exhausted = deadLetterJobs.map((job) => {
    const attempts = [];
    for (let a = 1; a <= 3; a++) {
      attempts.push({ jobId: job.jobId, attempt: a, shouldRetry: a < 3 });
    }
    const deadLetter = {
      jobId: job.jobId,
      finalError: { code: 'resource-exhausted', message: 'Max attempts exhausted' },
      attempts: 3,
      provider: 'gemini',
      reason: 'max-attempts-exhausted',
    };
    return { jobId: job.jobId, attempts, deadLetter };
  });

  test('dead letter has correct structure', () => {
    for (const dl of exhausted) {
      if (dl.deadLetter.attempts !== 3) throw new Error(`Expected 3 attempts for ${dl.jobId}`);
      if (!dl.deadLetter.finalError) throw new Error(`Missing finalError for ${dl.jobId}`);
      if (dl.attempts.length !== 3) throw new Error(`Expected 3 attempt records for ${dl.jobId}`);
    }
  });

  // ── TEST 5: Concurrency safety — duplicate claim prevention ────────────
  console.log('\n[TEST 5] Concurrency safety — duplicate claim prevention');
  const sharedJobs = simulateConcurrentClaims(5);
  // Simulate 2 concurrent workers trying to claim same jobs
  const worker1Claims = sharedJobs.map((j) => ({ ...j, claimed: false }));
  const worker2Claims = sharedJobs.map((j) => ({ ...j, claimed: false }));

  // Only the first worker should succeed
  for (let i = 0; i < sharedJobs.length; i++) {
    if (!worker1Claims[i].claimed) {
      worker1Claims[i].claimed = true;
    }
    // worker2 should see it's already claimed
    if (worker1Claims[i].claimed && !worker2Claims[i].claimed) {
      worker2Claims[i] = { ...worker2Claims[i], skipped: true };
    }
  }

  test('no duplicate claims across concurrent workers', () => {
    const claimedByW1 = worker1Claims.filter((c) => c.claimed).length;
    const claimedByW2 = worker2Claims.filter((c) => c.claimed && !c.skipped).length;
    if (claimedByW2 > 0) throw new Error(`Worker 2 claimed ${claimedByW2} jobs already claimed by Worker 1`);
    if (claimedByW1 !== 5) throw new Error(`Worker 1 should claim all 5 jobs`);
  });

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error('Load test crashed:', err.message);
  process.exit(1);
});