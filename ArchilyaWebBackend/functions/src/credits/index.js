const { onCall, HttpsError } = require('../shared/http-callable');
const { supabase, requireAuth, assertPositiveInt, normalizeText, ensureUserProfileDoc, getAuthorizedWorkspaceForUser } = require('../shared/supabase-helpers');
const { chargeUserCredits, refundUserCredits } = require('../shared/credit-ledger');

exports.deductCredits = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const amount = Number(request.data?.amount);
    const description = normalizeText(request.data?.description || 'AI islemi', 240);
    assertPositiveInt(amount, 'amount');

    await ensureUserProfileDoc(uid, { email: request.auth?.token?.email || '' });

    const result = await chargeUserCredits({
      userId: uid,
      amount,
      description,
      idempotencyKey: normalizeText(request.data?.idempotencyKey, 180) || null,
      metadata: { source: 'deductCredits' },
    });

    return { success: true, balanceAfter: result.balance_after, alreadyApplied: result.already_applied };
  }
);

exports.ensureUserProfile = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    await ensureUserProfileDoc(uid, {
      email: request.data?.email || request.auth?.token?.email || '',
      displayName: request.data?.displayName || request.auth?.token?.name || '',
    });
    return { success: true };
  }
);

exports.refundCredits = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const amount = Number(request.data?.amount);
    const description = normalizeText(request.data?.description || 'AI islem iadesi', 240);
    assertPositiveInt(amount, 'amount');

    await ensureUserProfileDoc(uid, { email: request.auth?.token?.email || '' });

    const result = await refundUserCredits({
      userId: uid,
      amount,
      description,
      idempotencyKey: normalizeText(request.data?.idempotencyKey, 180) || null,
      metadata: { source: 'refundCredits' },
    });

    return { success: true, balanceAfter: result.balance_after, alreadyApplied: result.already_applied };
  }
);

exports.deductWorkspacePoolCredits = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const workspaceId = String(request.data?.workspaceId || '').trim();
    const amount = Number(request.data?.amount);
    assertPositiveInt(amount, 'amount');

    if (!workspaceId) {
      throw new HttpsError('invalid-argument', 'workspaceId zorunludur.');
    }

    await getAuthorizedWorkspaceForUser(workspaceId, uid);

    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('pool_credits, credits')
      .eq('id', workspaceId)
      .single();

    if (wsError || !workspace) {
      throw new HttpsError('not-found', 'Workspace bulunamadi.');
    }

    const currentPool = Number(workspace.pool_credits ?? workspace.credits ?? 0);
    if (currentPool < amount) {
      throw new HttpsError('failed-precondition', `Yetersiz havuz kotasi. Mevcut: ${currentPool}, gereken: ${amount}.`);
    }

    const { error: updateError } = await supabase
      .from('workspaces')
      .update({
        pool_credits: currentPool - amount,
        credits: currentPool - amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workspaceId);

    if (updateError) {
      throw new HttpsError('internal', updateError.message);
    }

    return { success: true };
  }
);

exports.refundWorkspacePoolCredits = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const workspaceId = String(request.data?.workspaceId || '').trim();
    const amount = Number(request.data?.amount);
    assertPositiveInt(amount, 'amount');

    if (!workspaceId) {
      throw new HttpsError('invalid-argument', 'workspaceId zorunludur.');
    }

    await getAuthorizedWorkspaceForUser(workspaceId, uid);

    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('pool_credits, credits')
      .eq('id', workspaceId)
      .single();

    if (wsError || !workspace) {
      throw new HttpsError('not-found', 'Workspace bulunamadi.');
    }

    const { error: updateError } = await supabase
      .from('workspaces')
      .update({
        pool_credits: Number(workspace.pool_credits ?? workspace.credits ?? 0) + amount,
        credits: Number(workspace.pool_credits ?? workspace.credits ?? 0) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workspaceId);

    if (updateError) {
      throw new HttpsError('internal', updateError.message);
    }

    return { success: true };
  }
);
