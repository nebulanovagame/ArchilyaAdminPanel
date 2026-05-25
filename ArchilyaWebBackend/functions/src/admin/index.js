/**
 * Archilya Admin API — Express routes for AdminPanel
 *
 * ⚠️ All routes use service_role Supabase client (bypasses RLS).
 * Admin authorization is verified via JWT + profiles.is_admin check.
 *
 * Security model:
 * 1. Extract Bearer token from Authorization header
 * 2. Verify token via supabase.auth.getUser()
 * 3. Check profiles.is_admin = true for the authenticated user
 * 4. Execute query with service_role client
 * 5. Log all write operations to workspace_activity_logs
 */

const express = require('express');
const Sentry = require('@sentry/node');
const { supabase } = require('../shared/supabase');
const { normalizeText, normalizeEmail } = require('../shared/supabase-helpers');

const router = express.Router();

// ─── Auth Helpers ─────────────────────────────────────

async function resolveAuth(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  return { uid: data.user.id, email: data.user.email || '' };
}

async function requireAdmin(req) {
  const auth = await resolveAuth(req);
  if (!auth) {
    const err = new Error('Authentication required.');
    err.status = 401;
    err.code = 'unauthenticated';
    throw err;
  }

  // Check admin role via profiles.is_admin
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', auth.uid)
    .single();

  if (profileError || !profile || !profile.is_admin) {
    const err = new Error('Admin access required.');
    err.status = 403;
    err.code = 'permission-denied';
    throw err;
  }

  return auth;
}

function errorHandler(err, _req, res, _next) {
  Sentry.captureException(err);
  const status = err.status || 500;
  res.status(status).json({
    error: {
      code: err.code || 'internal',
      message: err.message || 'Beklenmeyen hata.',
    },
  });
}

// ─── Admin User Info ──────────────────────────────────

router.get('/me', async (req, res, next) => {
  try {
    const auth = await requireAdmin(req);

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, display_name, photo_url, is_admin, created_at')
      .eq('id', auth.uid)
      .single();

    res.json({
      data: {
        uid: profile?.id || auth.uid,
        email: profile?.email || auth.email,
        role: profile?.is_admin ? 'admin' : 'user',
        displayName: profile?.display_name || null,
        avatarUrl: profile?.photo_url || null,
        createdAt: profile?.created_at || null,
        lastSignInAt: null,
      },
    });
  } catch (err) { next(err); }
});

// ─── Dashboard Stats ──────────────────────────────────

router.get('/dashboard/stats', async (req, res, next) => {
  try {
    await requireAdmin(req);

    const [
      { count: totalUsers },
      { count: activeWorkspaces },
      { data: creditData },
      { count: activeSubscriptions },
      { count: pendingRenderJobs },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('workspaces').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('profiles').select('credits'),
      supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('ai_studio_jobs').select('*', { count: 'exact', head: true }).in('status', ['pending', 'queued', 'running']),
    ]);

    const totalCreditUsage = (creditData || []).reduce((sum, p) => sum + (p.credits || 0), 0);

    res.json({
      data: {
        totalUsers: totalUsers || 0,
        activeWorkspaces: activeWorkspaces || 0,
        totalCreditUsage,
        activeSubscriptions: activeSubscriptions || 0,
        pendingRenderJobs: pendingRenderJobs || 0,
        systemStatus: 'healthy',
      },
    });
  } catch (err) { next(err); }
});

// ─── Users ────────────────────────────────────────────

router.get('/users', async (req, res, next) => {
  try {
    await requireAdmin(req);

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, photo_url, is_admin, credits, created_at');

    if (error) throw error;

    // Get workspace counts for each user
    const userIds = profiles.map(p => p.id);
    const { data: memberCounts } = await supabase
      .from('workspace_members')
      .select('user_id')
      .in('user_id', userIds);

    const workspaceCountMap = {};
    if (memberCounts) {
      for (const m of memberCounts) {
        workspaceCountMap[m.user_id] = (workspaceCountMap[m.user_id] || 0) + 1;
      }
    }

    const users = profiles.map(p => ({
      id: p.id,
      email: p.email || '',
      displayName: p.display_name || null,
      avatarUrl: p.photo_url || null,
      role: p.is_admin ? 'admin' : 'user',
      status: 'active',
      createdAt: p.created_at || '',
      lastSignInAt: null,
      workspaceCount: workspaceCountMap[p.id] || 0,
      totalCreditsUsed: p.credits || 0,
    }));

    res.json({ data: users });
  } catch (err) { next(err); }
});

router.get('/users/:id', async (req, res, next) => {
  try {
    await requireAdmin(req);
    const { id } = req.params;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, photo_url, is_admin, credits, created_at')
      .eq('id', id)
      .single();

    if (error || !profile) {
      const err = new Error('Kullanici bulunamadi.');
      err.status = 404;
      throw err;
    }

    // Get workspaces
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', id);

    const workspaceIds = (memberships || []).map(m => m.workspace_id);
    const { data: workspaces } = workspaceIds.length
      ? await supabase.from('workspaces').select('id, name').in('id', workspaceIds)
      : { data: [] };

    // Get project count
    const { count: projectCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('uid', id)
      .eq('is_deleted', false);

    res.json({
      data: {
        id: profile.id,
        email: profile.email || '',
        displayName: profile.display_name || null,
        avatarUrl: profile.photo_url || null,
        role: profile.is_admin ? 'admin' : 'user',
        status: 'active',
        createdAt: profile.created_at || '',
        lastSignInAt: null,
        workspaceCount: workspaceIds.length,
        totalCreditsUsed: profile.credits || 0,
      },
    });
  } catch (err) { next(err); }
});

// ─── Workspaces ───────────────────────────────────────

router.get('/workspaces', async (req, res, next) => {
  try {
    await requireAdmin(req);

    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get member counts and owner emails
    const wsIds = workspaces.map(w => w.id);

    const [{ data: memberCounts }, { data: ownerProfiles }] = await Promise.all([
      supabase.from('workspace_members').select('workspace_id').in('workspace_id', wsIds),
      supabase.from('profiles').select('id, email').in('id', workspaces.map(w => w.admin_uid || w.admin_id).filter(Boolean)),
    ]);

    const memberCountMap = {};
    if (memberCounts) {
      for (const m of memberCounts) {
        memberCountMap[m.workspace_id] = (memberCountMap[m.workspace_id] || 0) + 1;
      }
    }

    const ownerEmailMap = {};
    if (ownerProfiles) {
      for (const p of ownerProfiles) {
        ownerEmailMap[p.id] = p.email;
      }
    }

    const result = workspaces.map(w => ({
      id: w.id,
      name: w.name || '',
      ownerEmail: ownerEmailMap[w.admin_uid || w.admin_id] || '',
      projectCount: 0,
      memberCount: memberCountMap[w.id] || 0,
      storageUsed: w.used_storage || 0,
      status: w.is_active ? 'active' : 'archived',
      createdAt: w.created_at || '',
    }));

    res.json({ data: result });
  } catch (err) { next(err); }
});

// ─── Projects ─────────────────────────────────────────

router.get('/projects', async (req, res, next) => {
  try {
    await requireAdmin(req);

    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Get owner emails
    const ownerIds = [...new Set((projects || []).map(p => p.uid || p.owner_id).filter(Boolean))];
    const { data: ownerProfiles } = ownerIds.length
      ? await supabase.from('profiles').select('id, email').in('id', ownerIds)
      : { data: [] };

    const ownerEmailMap = {};
    if (ownerProfiles) {
      for (const p of ownerProfiles) ownerEmailMap[p.id] = p.email;
    }

    const result = (projects || []).map(p => ({
      id: p.id,
      name: p.name || '',
      workspaceId: p.workspace_id || '',
      ownerEmail: ownerEmailMap[p.uid || p.owner_id] || '',
      status: p.status || 'Taslak',
      fileCount: typeof p.file_count === 'object' ? Object.values(p.file_count).reduce((a, b) => a + (b || 0), 0) : 0,
      totalSize: p.total_size || 0,
      createdAt: p.created_at || '',
      updatedAt: p.updated_at || '',
    }));

    res.json({ data: result });
  } catch (err) { next(err); }
});

// ─── Credits (Transactions) ───────────────────────────

router.get('/credits', async (req, res, next) => {
  try {
    await requireAdmin(req);

    const { data: transactions, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Get user emails
    const userIds = [...new Set((transactions || []).map(t => t.user_id).filter(Boolean))];
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id, email').in('id', userIds)
      : { data: [] };

    const emailMap = {};
    if (profiles) {
      for (const p of profiles) emailMap[p.id] = p.email;
    }

    const typeLabelMap = {
      credit_purchase: 'purchase',
      credit_deduct: 'usage',
      credit_refund: 'refund',
      subscription_payment: 'usage',
      subscription_refund: 'refund',
    };

    const result = (transactions || []).map(t => ({
      id: t.id,
      userEmail: emailMap[t.user_id] || t.user_id || '',
      amount: t.amount || 0,
      type: typeLabelMap[t.type] || t.type || 'usage',
      description: t.description || '',
      createdAt: t.created_at || '',
    }));

    res.json({ data: result });
  } catch (err) { next(err); }
});

// ─── Credit Grant ─────────────────────────────────────

router.post('/credits/grant', async (req, res, next) => {
  try {
    await requireAdmin(req);

    const { userId, amount, description } = req.body;

    if (!userId || !amount || !Number.isInteger(amount) || amount <= 0) {
      const err = new Error('Gecersiz parametreler. userId ve pozitif amount (integer) gereklidir.');
      err.status = 400;
      throw err;
    }

    // Check user exists and get current balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, credits')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      const err = new Error('Kullanici profili bulunamadi: ' + userId);
      err.status = 404;
      throw err;
    }

    const currentCredits = profile.credits || 0;
    const newCredits = currentCredits + amount;

    // Update credits
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ credits: newCredits, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Insert transaction record
    const { error: txError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: amount,
        type: 'credit_refund',
        description: description || 'Admin tarafindan kredi yuklemesi',
        balance_after: newCredits,
        source: 'admin_panel',
        metadata: { granted_by: 'admin_panel' },
      });

    if (txError) throw txError;

    res.json({
      data: {
        success: true,
        balanceAfter: newCredits,
        amount,
        userId,
      },
    });
  } catch (err) { next(err); }
});

// ─── Credit Deduct ────────────────────────────────────

router.post('/credits/deduct', async (req, res, next) => {
  try {
    await requireAdmin(req);

    const { userId, amount, description } = req.body;

    if (!userId || !amount || !Number.isInteger(amount) || amount <= 0) {
      const err = new Error('Gecersiz parametreler. userId ve pozitif amount (integer) gereklidir.');
      err.status = 400;
      throw err;
    }

    // Check user exists and get current balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, credits')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      const err = new Error('Kullanici profili bulunamadi: ' + userId);
      err.status = 404;
      throw err;
    }

    const currentCredits = profile.credits || 0;
    const newCredits = Math.max(0, currentCredits - amount);

    // Update credits
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ credits: newCredits, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Insert transaction record
    const { error: txError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: -amount,
        type: 'credit_deduct',
        description: description || 'Admin tarafindan kredi dusumu',
        balance_after: newCredits,
        source: 'admin_panel',
        metadata: { deducted_by: 'admin_panel' },
      });

    if (txError) throw txError;

    res.json({
      data: {
        success: true,
        balanceAfter: newCredits,
        deductedAmount: amount,
        userId,
      },
    });
  } catch (err) { next(err); }
});

// ─── Subscriptions ────────────────────────────────────

router.get('/subscriptions', async (req, res, next) => {
  try {
    await requireAdmin(req);

    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const userIds = [...new Set((subscriptions || []).map(s => s.user_id).filter(Boolean))];
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id, email').in('id', userIds)
      : { data: [] };

    const emailMap = {};
    if (profiles) {
      for (const p of profiles) emailMap[p.id] = p.email;
    }

    const planNames = { free: 'Ücretsiz', solo: 'Solo', pro: 'Profesyonel', studio: 'Studio' };

    const result = (subscriptions || []).map(s => ({
      id: s.id,
      userEmail: emailMap[s.user_id] || s.user_id || '',
      planName: planNames[s.plan] || s.plan || '',
      status: s.status || 'active',
      currentPeriodStart: s.current_period_start || s.created_at || '',
      currentPeriodEnd: s.current_period_end || '',
      amount: 0,
      currency: 'TRY',
    }));

    res.json({ data: result });
  } catch (err) { next(err); }
});

// ─── Render/AI Jobs ───────────────────────────────────

router.get('/render-jobs', async (req, res, next) => {
  try {
    await requireAdmin(req);

    const { data: aiJobs, error } = await supabase
      .from('ai_studio_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const userIds = [...new Set((aiJobs || []).map(j => j.user_id).filter(Boolean))];
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id, email').in('id', userIds)
      : { data: [] };

    const emailMap = {};
    if (profiles) {
      for (const p of profiles) emailMap[p.id] = p.email;
    }

    const statusMap = {
      pending: 'queued', queued: 'queued', running: 'processing',
      completed: 'completed', failed: 'failed', cancelled: 'canceled',
    };

    const result = (aiJobs || []).map(j => ({
      id: j.id,
      type: j.tool_id === 'render' || j.output_type === 'image' ? 'render' : 'ai',
      status: statusMap[j.status] || j.status || 'queued',
      userEmail: emailMap[j.user_id] || j.user_id || '',
      projectName: j.metadata?.projectName || j.tool_id || '',
      progress: j.status === 'completed' ? 100 : j.status === 'running' ? 50 : j.status === 'failed' ? 0 : 10,
      createdAt: j.created_at || '',
      completedAt: j.completed_at || null,
    }));

    res.json({ data: result });
  } catch (err) { next(err); }
});

// ─── Audit Logs (Activity Logs) ───────────────────────

router.get('/audit-logs', async (req, res, next) => {
  try {
    await requireAdmin(req);

    const [wsLogs, projLogs] = await Promise.all([
      supabase.from('workspace_activity_logs').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('project_activity_logs').select('*').order('created_at', { ascending: false }).limit(50),
    ]);

    const combined = [
      ...(wsLogs.data || []).map(l => ({ ...l, _source: 'workspace' })),
      ...(projLogs.data || []).map(l => ({ ...l, _source: 'project' })),
    ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 100);

    const result = combined.map(l => ({
      id: l.id,
      actorEmail: l.actor_email || '',
      action: l.action || 'unknown',
      resource: l._source === 'workspace' ? `ws:${l.workspace_id}` : `project:${l.project_id}`,
      resourceId: l.target_id || l.id,
      details: l.metadata ? JSON.stringify(l.metadata) : null,
      ipAddress: null,
      createdAt: l.created_at || '',
    }));

    res.json({ data: result });
  } catch (err) { next(err); }
});

// ─── Legacy Products ──────────────────────────────────

router.get('/legacy/products', async (req, res, next) => {
  try {
    await requireAdmin(req);

    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const result = (products || []).map(p => ({
      id: p.id,
      name: p.name || '',
      description: p.description || '',
      price: Number(p.price) || 0,
      currency: p.currency || 'TRY',
      active: p.is_active !== false,
      createdAt: p.created_at || '',
    }));

    res.json({ data: result });
  } catch (err) { next(err); }
});

// ─── Health check ─────────────────────────────────────

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'archilya-admin-api' });
});

router.use(errorHandler);

module.exports = router;
