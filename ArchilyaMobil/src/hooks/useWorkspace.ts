import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import type { DocumentData, FirestoreError, QuerySnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import {
  acceptWorkspaceInviteSecure,
  createWorkspaceSecure,
  declineWorkspaceInviteSecure,
  deleteWorkspaceSecure,
  inviteWorkspaceMemberSecure,
  removeWorkspaceMemberSecure,
} from '../services/entitlementService';
import type { Workspace, WorkspaceContextType, WorkspaceInvite } from '../types';

function normalizeEmail(value: string): string {
  return String(value || '').trim().toLowerCase();
}

export function useWorkspace(): WorkspaceContextType {
  const { user } = useAuth();
  const [adminWorkspace, setAdminWorkspace] = useState<Workspace | null>(null);
  const [memberWorkspace, setMemberWorkspace] = useState<Workspace | null>(null);
  const [workspaceInvites, setWorkspaceInvites] = useState<WorkspaceInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const activeWorkspace = adminWorkspace || memberWorkspace;
  const isAdmin = Boolean(adminWorkspace);

  useEffect((): Unsubscribe | undefined => {
    if (!user?.uid) {
      setAdminWorkspace(null);
      setMemberWorkspace(null);
      setWorkspaceInvites([]);
      setLoading(false);
      return;
    }

    const adminQ = query(collection(db, 'workspaces'), where('adminUid', '==', user.uid));
    const unsubAdmin: Unsubscribe = onSnapshot(adminQ, (snap: QuerySnapshot<DocumentData>) => {
      setAdminWorkspace(snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as Workspace));
    });

    const memberQ = query(collection(db, 'workspaces'), where('memberUids', 'array-contains', user.uid));
    const unsubMember: Unsubscribe = onSnapshot(memberQ, (snap: QuerySnapshot<DocumentData>) => {
      const nonAdminWorkspace = snap.docs.find((item) => item.data()?.adminUid !== user.uid);
      setMemberWorkspace(nonAdminWorkspace ? ({ id: nonAdminWorkspace.id, ...nonAdminWorkspace.data() } as Workspace) : null);
      setLoading(false);
    });

    const inviteQ = query(
      collection(db, 'workspaceInvites'),
      where('toEmail', '==', normalizeEmail(user.email || '')),
      where('status', '==', 'pending')
    );
    const unsubInvite: Unsubscribe = onSnapshot(
      inviteQ,
      (snap: QuerySnapshot<DocumentData>) => {
        const rows = snap.docs.map((item) => ({
          id: item.id,
          ...item.data(),
          createdAt: item.data()?.createdAt?.toDate?.() ?? new Date(),
        })) as WorkspaceInvite[];
        setWorkspaceInvites(rows);
      },
      (_error: FirestoreError) => undefined
    );

    return () => {
      unsubAdmin();
      unsubMember();
      unsubInvite();
    };
  }, [user?.uid, user?.email]);

  async function createWorkspace(name: string): ReturnType<WorkspaceContextType['createWorkspace']> {
    if (!user?.uid) throw new Error('Oturum acmaniz gerekiyor.');

    const result = await createWorkspaceSecure(
      String(name || '').trim(),
      (user.displayName || user.email) as string | undefined,
      user.email
    );

    if (!result?.success) {
      throw new Error('Calisma alani olusturulamadi.');
    }

    return result;
  }

  async function inviteMember(toEmail: string): ReturnType<WorkspaceContextType['inviteMember']> {
    if (!user?.uid) throw new Error('Oturum acmaniz gerekiyor.');
    if (!adminWorkspace?.id) throw new Error('Sadece workspace yoneticisi uye davet edebilir.');

    const targetEmail = normalizeEmail(toEmail);
    if (!targetEmail) throw new Error('Gecerli bir e-posta girin.');
    if (targetEmail === normalizeEmail(user.email || '')) throw new Error('Kendinizi davet edemezsiniz.');

    const result = await inviteWorkspaceMemberSecure(adminWorkspace.id, targetEmail);
    if (!result?.success) {
      throw new Error('Workspace daveti gonderilemedi.');
    }

    return result;
  }

  async function acceptWorkspaceInvite(inviteId: string): ReturnType<WorkspaceContextType['acceptWorkspaceInvite']> {
    if (!user?.uid) throw new Error('Oturum acmaniz gerekiyor.');

    const result = await acceptWorkspaceInviteSecure(inviteId);
    if (!result?.success) {
      throw new Error('Workspace daveti kabul edilemedi.');
    }

    return result;
  }

  async function declineWorkspaceInvite(inviteId: string): ReturnType<WorkspaceContextType['declineWorkspaceInvite']> {
    if (!user?.uid) throw new Error('Oturum acmaniz gerekiyor.');

    const result = await declineWorkspaceInviteSecure(inviteId);
    if (!result?.success) {
      throw new Error('Workspace daveti reddedilemedi.');
    }

    return result;
  }

  async function removeMember(memberUid: string): ReturnType<WorkspaceContextType['removeMember']> {
    if (!user?.uid) throw new Error('Oturum acmaniz gerekiyor.');
    if (!adminWorkspace?.id) throw new Error('Sadece workspace yoneticisi uye cikarabilir.');

    const result = await removeWorkspaceMemberSecure(adminWorkspace.id, memberUid);
    if (!result?.success) {
      throw new Error('Uye cikarma islemi tamamlanamadi.');
    }

    return result;
  }

  async function deleteWorkspace(): ReturnType<WorkspaceContextType['deleteWorkspace']> {
    if (!user?.uid) throw new Error('Oturum acmaniz gerekiyor.');
    if (!adminWorkspace?.id) throw new Error('Sadece workspace yoneticisi workspace silebilir.');

    const result = await deleteWorkspaceSecure(adminWorkspace.id);
    if (!result?.success) {
      throw new Error('Calisma alani silinemedi.');
    }

    return result;
  }

  return {
    adminWorkspace,
    memberWorkspace,
    activeWorkspace,
    workspaceInvites,
    isAdmin,
    loading,
    createWorkspace,
    inviteMember,
    acceptWorkspaceInvite,
    declineWorkspaceInvite,
    removeMember,
    deleteWorkspace,
  };
}
