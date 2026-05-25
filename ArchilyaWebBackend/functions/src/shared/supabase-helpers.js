const { HttpsError } = require('./http-callable');
const { supabase } = require('./supabase');

const STUDIO_POOL_CREDITS = 7000;
const STUDIO_POOL_STORAGE = 750 * 1024 * 1024 * 1024;

const WORKSPACE_PLAN_CONFIG = {
  solo: {
    maxMembers: 1,
    poolCredits: 1000,
    poolStorage: 30 * 1024 * 1024 * 1024,
  },
  pro: {
    maxMembers: 5,
    poolCredits: 2200,
    poolStorage: 100 * 1024 * 1024 * 1024,
  },
  studio: {
    maxMembers: 20,
    poolCredits: STUDIO_POOL_CREDITS,
    poolStorage: STUDIO_POOL_STORAGE,
  },
  enterprise: {
    maxMembers: 20,
    poolCredits: STUDIO_POOL_CREDITS,
    poolStorage: STUDIO_POOL_STORAGE,
  },
};

function getWorkspacePlanConfig(planId) {
  const normalizedPlanId = String(planId || '').trim().toLowerCase();
  return WORKSPACE_PLAN_CONFIG[normalizedPlanId] || null;
}

function requireAuth(request) {
  const uid = request.auth?.uid || request.user?.id || request.user?.sub;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Giris yapmaniz gerekiyor.');
  }
  return uid;
}

function assertPositiveInt(value, fieldName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new HttpsError('invalid-argument', `${fieldName} pozitif tam sayi olmalidir.`);
  }
}

function normalizeText(value, maxLength = 500) {
  const normalized = String(value || '').trim();
  if (!maxLength || normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function ensureUserProfileDoc(uid, { email = '', displayName = '' } = {}) {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Kullanici kimligi eksik.');
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: uid,
      email: normalizeEmail(email),
      display_name: normalizeText(displayName, 120),
      updated_at: now,
    }, { onConflict: 'id' });

  if (error) {
    throw new HttpsError('internal', error.message);
  }
}

async function getAuthorizedWorkspaceForUser(workspaceId, uid) {
  const { data: member, error: memberError } = await supabase
    .from('workspace_members')
    .select('workspace_id, user_id, email, display_name, role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', uid)
    .single();

  if (memberError || !member) {
    throw new HttpsError('permission-denied', 'Bu calisma alanina erisim yetkiniz yok.');
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single();

  if (workspaceError || !workspace) {
    throw new HttpsError('not-found', 'Calisma alani bulunamadi.');
  }

  return { workspace, member, role: member.role };
}

function normalizeMember(member) {
  if (!member || !member.uid) return null;
  return {
    uid: String(member.uid),
    email: normalizeEmail(member.email || ''),
    displayName: normalizeText(member.displayName || member.email || '', 120) || normalizeEmail(member.email || ''),
    role: member.role === 'admin' ? 'admin' : 'member',
    joinedAt: member.joinedAt || new Date().toISOString(),
  };
}

async function buildChunkedBatches(items, buildUpdate) {
  const updates = [];
  for (const item of items) {
    const payload = buildUpdate(item);
    if (payload) updates.push(payload);
  }
  return updates;
}

async function getWorkspaceProjects(workspaceId) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_deleted', false);

  if (error) {
    console.warn('[getWorkspaceProjects] error:', error.message);
    return [];
  }

  return data || [];
}

async function syncMemberIntoWorkspaceProjects(workspaceId, memberInfo) {
  const projects = await getWorkspaceProjects(workspaceId);
  if (!projects.length) return;

  const normalizedMember = normalizeMember(memberInfo);
  if (!normalizedMember) return;

  for (const project of projects) {
    const memberUids = Array.isArray(project.member_uids) ? project.member_uids : [];
    if (memberUids.includes(normalizedMember.uid)) continue;

    const team = Array.isArray(project.team) ? project.team : [];
    team.push({
      uid: normalizedMember.uid,
      email: normalizedMember.email,
      role: 'member',
    });

    const activityLog = Array.isArray(project.activity_log) ? project.activity_log : [];
    activityLog.push({
      action: 'member_join',
      user: normalizedMember.email,
      timestamp: new Date().toISOString(),
      details: `${normalizedMember.email} calisma alani uyesi olarak projeye eklendi`,
    });

    await supabase
      .from('projects')
      .update({
        member_uids: [...memberUids, normalizedMember.uid],
        team,
        activity_log: activityLog,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id);
  }
}

async function syncMemberRemovalFromWorkspaceProjects(workspaceId, memberUid, memberEmail) {
  const projects = await getWorkspaceProjects(workspaceId);
  if (!projects.length) return;

  const normalizedUid = String(memberUid);
  const normalizedEmail = normalizeEmail(memberEmail || '');

  for (const project of projects) {
    const memberUids = Array.isArray(project.member_uids) ? project.member_uids : [];
    const team = Array.isArray(project.team) ? project.team : [];

    if (!memberUids.includes(normalizedUid)) continue;

    const activityLog = Array.isArray(project.activity_log) ? project.activity_log : [];

    if (project.uid === normalizedUid) {
      activityLog.push({
        action: 'workspace_detach',
        user: normalizedEmail,
        timestamp: new Date().toISOString(),
        details: `${normalizedEmail} workspace disina alindigi icin sahip oldugu proje bagimsiz moda gecirildi`,
      });

      await supabase
        .from('projects')
        .update({
          workspace_id: null,
          workspace_name: null,
          activity_log: activityLog,
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id);
      continue;
    }

    const nextMemberUids = memberUids.filter((id) => id !== normalizedUid);
    const nextTeam = team.filter((m) => String(m?.uid || '') !== normalizedUid);

    activityLog.push({
      action: 'member_removed',
      user: normalizedEmail,
      timestamp: new Date().toISOString(),
      details: `${normalizedEmail} calisma alanindan cikarildigi icin proje erisimi kaldirildi`,
    });

    await supabase
      .from('projects')
      .update({
        member_uids: nextMemberUids,
        team: nextTeam,
        activity_log: activityLog,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id);
  }
}

module.exports = {
  requireAuth,
  assertPositiveInt,
  normalizeText,
  normalizeEmail,
  ensureUserProfileDoc,
  getAuthorizedWorkspaceForUser,
  getWorkspacePlanConfig,
  normalizeMember,
  buildChunkedBatches,
  getWorkspaceProjects,
  syncMemberIntoWorkspaceProjects,
  syncMemberRemovalFromWorkspaceProjects,
  supabase,
};
