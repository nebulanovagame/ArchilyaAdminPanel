const { onCall, HttpsError } = require('../shared/http-callable');
const {
  supabase,
  requireAuth,
  normalizeText,
  normalizeEmail,
  ensureUserProfileDoc,
  getAuthorizedWorkspaceForUser,
  getWorkspacePlanConfig,
  normalizeMember,
  syncMemberIntoWorkspaceProjects,
  syncMemberRemovalFromWorkspaceProjects,
} = require('../shared/supabase-helpers');

exports.createWorkspaceSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const email = normalizeEmail(request.auth?.token?.email || request.data?.email || '');
    const displayName = normalizeText(request.data?.displayName || '', 120) || email;
    const requestedName = normalizeText(request.data?.name || '', 140);
    const workspaceName = requestedName || `${displayName}'in Calisma Alani`;

    await ensureUserProfileDoc(uid, { email, displayName });

    const { data: existingMembership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', uid)
      .limit(1)
      .single();

    if (existingMembership) {
      throw new HttpsError('failed-precondition', 'Zaten bir calisma alanina baglisiniz.');
    }

    const { data: user } = await supabase
      .from('profiles')
      .select('subscription_plan')
      .eq('id', uid)
      .single();

    const userPlan = user?.subscription_plan || 'free';
    const workspacePlanConfig = getWorkspacePlanConfig(userPlan);
    if (!workspacePlanConfig) {
      throw new HttpsError('permission-denied', 'Calisma alani olusturmak icin Solo, Pro veya Studio paketi gerekir.');
    }

    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .insert({
        name: workspaceName,
        admin_id: uid,
        admin_uid: uid,
        admin_email: email,
        plan: userPlan,
        credits: workspacePlanConfig.poolCredits,
        pool_credits: workspacePlanConfig.poolCredits,
        max_storage: workspacePlanConfig.poolStorage,
        pool_storage: workspacePlanConfig.poolStorage,
        used_storage: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (wsError || !workspace) {
      throw new HttpsError('internal', wsError?.message || 'Workspace olusturulamadi.');
    }

    await supabase.from('workspace_members').insert({
      workspace_id: workspace.id,
      user_id: uid,
      email,
      display_name: displayName,
      role: 'admin',
      joined_at: new Date().toISOString(),
    });

    return { success: true, workspaceId: workspace.id };
  }
);

exports.inviteWorkspaceMemberSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const workspaceId = String(request.data?.workspaceId || '').trim();
    const toEmail = normalizeEmail(request.data?.toEmail || '');
    const fromEmail = normalizeEmail(request.auth?.token?.email || '');
    const fromName = normalizeText(request.auth?.token?.name || request.data?.fromName || fromEmail, 120) || fromEmail;

    if (!workspaceId) {
      throw new HttpsError('invalid-argument', 'workspaceId zorunludur.');
    }
    if (!toEmail) {
      throw new HttpsError('invalid-argument', 'Gecerli bir e-posta girin.');
    }
    if (toEmail === fromEmail) {
      throw new HttpsError('invalid-argument', 'Kendinizi davet edemezsiniz.');
    }

    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    if (wsError || !workspace) {
      throw new HttpsError('not-found', 'Calisma alani bulunamadi.');
    }

    if ((workspace.admin_uid || workspace.admin_id) !== uid) {
      throw new HttpsError('permission-denied', 'Sadece workspace yoneticisi davet gonderebilir.');
    }

    const { data: members } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId);

    const workspacePlanConfig = getWorkspacePlanConfig(workspace.plan);
    const maxMembers = Number(workspacePlanConfig?.maxMembers || 0);
    if (!maxMembers) {
      throw new HttpsError('failed-precondition', 'Bu workspace planinda ekip daveti aktif degil.');
    }
    if ((members?.length || 0) >= maxMembers) {
      throw new HttpsError('failed-precondition', `Maksimum uye sinirina ulasildi. Bu plan en fazla ${maxMembers} kisi destekler.`);
    }
    if (members?.some((m) => normalizeEmail(m.email) === toEmail)) {
      throw new HttpsError('failed-precondition', 'Bu kisi zaten workspace uyesi.');
    }

    const { data: pendingInvite } = await supabase
      .from('workspace_invites')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('to_email', toEmail)
      .eq('status', 'pending')
      .limit(1)
      .single();

    if (pendingInvite) {
      throw new HttpsError('already-exists', 'Bu kisiye zaten bekleyen bir davet var.');
    }

    let toUid = null;
    const { data: userByEmail } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', toEmail)
      .limit(1)
      .single();

    if (userByEmail) {
      toUid = userByEmail.id;
      const { data: otherMemberships } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', toUid)
        .limit(2);

      const hasOther = otherMemberships?.some((m) => m.workspace_id !== workspaceId);
      if (hasOther) {
        throw new HttpsError('failed-precondition', 'Bu kullanici zaten baska bir calisma alanina bagli.');
      }
    }

    const { data: invite, error: inviteError } = await supabase
      .from('workspace_invites')
      .insert({
        workspace_id: workspaceId,
        from_user_id: uid,
        workspace_name: workspace.name || 'Workspace',
        from_uid: uid,
        from_email: fromEmail,
        from_name: fromName,
        to_email: toEmail,
        to_user_id: toUid,
        to_uid: toUid,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (inviteError || !invite) {
      throw new HttpsError('internal', inviteError?.message || 'Davet olusturulamadi.');
    }

    await supabase.from('notifications').insert({
      user_id: toUid,
      email: toEmail,
      to_email: toEmail,
      to_uid: toUid,
      type: 'workspace_invite',
      title: 'Calisma Alanina Davet',
      body: `${fromName} sizi "${workspace.name || 'Workspace'}" calisma alanina davet etti.`,
      workspace_id: workspaceId,
      workspace_name: workspace.name || 'Workspace',
      invite_id: invite.id,
      is_read: false,
      read: false,
      created_at: new Date().toISOString(),
    });

    return { success: true, inviteId: invite.id };
  }
);

exports.acceptWorkspaceInviteSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const inviteId = String(request.data?.inviteId || '').trim();
    const email = normalizeEmail(request.auth?.token?.email || '');

    if (!inviteId) throw new HttpsError('invalid-argument', 'inviteId zorunludur.');

    const { data: invite, error: inviteError } = await supabase
      .from('workspace_invites')
      .select('*')
      .eq('id', inviteId)
      .single();

    if (inviteError || !invite) throw new HttpsError('not-found', 'Davet bulunamadi.');

    const currentStatus = String(invite.status || '');
    if (!['pending', 'accepted_sync_pending', 'accepted'].includes(currentStatus)) {
      throw new HttpsError('failed-precondition', 'Bu davet aktif degil.');
    }

    const allowedByUid = (invite.to_uid || invite.to_user_id) && (invite.to_uid || invite.to_user_id) === uid;
    const allowedByEmail = normalizeEmail(invite.to_email) === email;
    if (!allowedByUid && !allowedByEmail) {
      throw new HttpsError('permission-denied', 'Bu daveti kabul etme yetkiniz yok.');
    }

    const workspaceId = String(invite.workspace_id || '');
    if (!workspaceId) throw new HttpsError('failed-precondition', 'Davet workspace bilgisi eksik.');

    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    if (wsError || !workspace) throw new HttpsError('not-found', 'Calisma alani bulunamadi.');

    const { data: existingMemberships } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', uid)
      .limit(2);

    const hasOtherWorkspace = existingMemberships?.some((m) => m.workspace_id !== workspaceId);
    if (hasOtherWorkspace) {
      throw new HttpsError('failed-precondition', 'Zaten baska bir calisma alanina baglisiniz.');
    }

    const memberEntry = normalizeMember({
      uid,
      email,
      displayName: request.auth?.token?.name || email,
      role: 'member',
      joinedAt: new Date().toISOString(),
    });

    await supabase.from('workspace_members').insert({
      workspace_id: workspaceId,
      user_id: uid,
      email: memberEntry.email,
      display_name: memberEntry.displayName,
      role: 'member',
      joined_at: memberEntry.joinedAt,
    });

    await supabase
      .from('workspace_invites')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', inviteId);

    await syncMemberIntoWorkspaceProjects(workspaceId, memberEntry);

    return { success: true };
  }
);

exports.declineWorkspaceInviteSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const inviteId = String(request.data?.inviteId || '').trim();
    const email = normalizeEmail(request.auth?.token?.email || '');

    if (!inviteId) throw new HttpsError('invalid-argument', 'inviteId zorunludur.');

    const { data: invite, error: inviteError } = await supabase
      .from('workspace_invites')
      .select('*')
      .eq('id', inviteId)
      .single();

    if (inviteError || !invite) throw new HttpsError('not-found', 'Davet bulunamadi.');

    const allowedByUid = (invite.to_uid || invite.to_user_id) && (invite.to_uid || invite.to_user_id) === uid;
    const allowedByEmail = normalizeEmail(invite.to_email) === email;
    if (!allowedByUid && !allowedByEmail) {
      throw new HttpsError('permission-denied', 'Bu daveti reddetme yetkiniz yok.');
    }

    await supabase
      .from('workspace_invites')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', inviteId);

    await supabase
      .from('notifications')
      .update({ read: true, is_read: true, read_at: new Date().toISOString() })
      .eq('invite_id', inviteId);

    return { success: true };
  }
);

exports.removeWorkspaceMemberSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const workspaceId = String(request.data?.workspaceId || '').trim();
    const memberUid = String(request.data?.memberUid || '').trim();

    if (!workspaceId) throw new HttpsError('invalid-argument', 'workspaceId zorunludur.');
    if (!memberUid) throw new HttpsError('invalid-argument', 'memberUid zorunludur.');
    if (memberUid === uid) {
      throw new HttpsError('invalid-argument', 'Kendinizi cikaramazsiniz.');
    }

    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    if (wsError || !workspace) {
      throw new HttpsError('not-found', 'Calisma alani bulunamadi.');
    }

    if ((workspace.admin_uid || workspace.admin_id) !== uid) {
      throw new HttpsError('permission-denied', 'Sadece workspace yoneticisi cikarma yapabilir.');
    }

    const { data: member, error: memberError } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', memberUid)
      .single();

    if (memberError || !member) {
      throw new HttpsError('not-found', 'Uye bulunamadi.');
    }

    await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', memberUid);

    await syncMemberRemovalFromWorkspaceProjects(workspaceId, memberUid, member.email || '');

    return { success: true };
  }
);

exports.deleteWorkspaceSecure = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const workspaceId = String(request.data?.workspaceId || '').trim();
    if (!workspaceId) throw new HttpsError('invalid-argument', 'workspaceId zorunludur.');

    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    if (wsError || !workspace) return { success: true, skipped: true };

    if ((workspace.admin_uid || workspace.admin_id) !== uid) {
      throw new HttpsError('permission-denied', 'Sadece workspace yoneticisi silebilir.');
    }

    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId);

    const workspaceMemberUids = members?.map((m) => m.user_id) || [];

    const { data: projects } = await supabase
      .from('projects')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_deleted', false);

    for (const project of projects || []) {
      const ownerUid = project.uid || project.owner_id;
      const removableUids = new Set(workspaceMemberUids.filter((id) => id !== ownerUid));
      const nextMemberUids = (Array.isArray(project.member_uids) ? project.member_uids : [])
        .filter((id) => !removableUids.has(id));
      if (ownerUid && !nextMemberUids.includes(ownerUid)) nextMemberUids.push(ownerUid);
      const nextTeam = (Array.isArray(project.team) ? project.team : [])
        .filter((member) => !removableUids.has(member.uid));

      const activityLog = Array.isArray(project.activity_log) ? project.activity_log : [];
      activityLog.push({
        action: 'workspace_deleted',
        user: request.auth?.token?.email || uid,
        timestamp: new Date().toISOString(),
        details: `Workspace silindigi icin proje bagimsiz moda gecirildi`,
      });

      await supabase
        .from('projects')
        .update({
          workspace_id: null,
          workspace_name: null,
          member_uids: nextMemberUids,
          team: nextTeam,
          activity_log: activityLog,
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id);
    }

    await supabase
      .from('workspace_invites')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending');

    await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId);

    await supabase
      .from('workspaces')
      .delete()
      .eq('id', workspaceId);

    return { success: true };
  }
);

exports.adjustWorkspaceStorage = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireAuth(request);
    const workspaceId = String(request.data?.workspaceId || '').trim();
    const bytesDelta = Number(request.data?.bytesDelta);

    if (!workspaceId) {
      throw new HttpsError('invalid-argument', 'workspaceId zorunludur.');
    }

    if (!Number.isFinite(bytesDelta) || bytesDelta === 0) {
      throw new HttpsError('invalid-argument', 'bytesDelta sifir disinda sayi olmalidir.');
    }

    await getAuthorizedWorkspaceForUser(workspaceId, uid);

    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('used_storage, pool_storage, max_storage')
      .eq('id', workspaceId)
      .single();

    if (wsError || !workspace) {
      throw new HttpsError('not-found', 'Workspace bulunamadi.');
    }

    const usedStorage = Math.max(0, Number(workspace.used_storage || 0) + bytesDelta);
    const poolStorage = Number(workspace.pool_storage ?? workspace.max_storage ?? 0);

    if (poolStorage > 0 && usedStorage > poolStorage) {
      throw new HttpsError('failed-precondition', 'Calisma alani depolama limiti asildi.');
    }

    const { error: updateError } = await supabase
      .from('workspaces')
      .update({
        used_storage: usedStorage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workspaceId);

    if (updateError) {
      throw new HttpsError('internal', updateError.message);
    }

    return { success: true };
  }
);
