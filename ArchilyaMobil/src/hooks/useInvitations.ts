import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import type { DocumentData, FirestoreError, QuerySnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import {
  acceptProjectInviteSecure,
  declineProjectInviteSecure,
  sendProjectInviteSecure,
} from '../services/entitlementService';
import type { Invitation, InvitationsContextType } from '../types';

function normalizeEmail(email: string | null | undefined): string {
  return String(email || '').trim().toLowerCase();
}

export function useInvitations(): InvitationsContextType {
  const { user } = useAuth();
  const [sentInvites, setSentInvites] = useState<Invitation[]>([]);
  const [receivedInvites, setReceivedInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect((): Unsubscribe | undefined => {
    if (!user) {
      setSentInvites([]);
      setReceivedInvites([]);
      setLoading(false);
      return;
    }

    const sentQ = query(collection(db, 'invitations'), where('fromUid', '==', user.uid));
    const unsubSent: Unsubscribe = onSnapshot(
      sentQ,
      (snap: QuerySnapshot<DocumentData>) => {
        setSentInvites(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
          })) as Invitation[]
        );
      },
      (_error: FirestoreError) => undefined
    );

    const recvQ = query(
      collection(db, 'invitations'),
      where('toEmail', '==', user.email),
      where('status', '==', 'pending')
    );
    const unsubRecv: Unsubscribe = onSnapshot(
      recvQ,
      (snap: QuerySnapshot<DocumentData>) => {
        setReceivedInvites(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
          })) as Invitation[]
        );
        setLoading(false);
      },
      (_error: FirestoreError) => undefined
    );

    return () => {
      unsubSent();
      unsubRecv();
    };
  }, [user]);

  async function sendInvite({ toEmail, projectId, projectName, role = 'member' }: Parameters<InvitationsContextType['sendInvite']>[0]): ReturnType<InvitationsContextType['sendInvite']> {
    if (!user) throw new Error('Oturum acmaniz gerekiyor.');
    const targetEmail = normalizeEmail(toEmail);
    const currentEmail = normalizeEmail(user.email);

    if (!targetEmail) throw new Error('Gecerli bir e-posta adresi girin.');
    if (targetEmail === currentEmail) throw new Error('Kendinizi davet edemezsiniz.');

    const result = await sendProjectInviteSecure({
      toEmail: targetEmail,
      projectId,
      projectName,
      role,
      fromName: user.displayName || user.email,
    });

    if (!result?.success) {
      throw new Error('Davet gonderilemedi.');
    }

    return result;
  }

  async function acceptInvite(invite: Invitation): ReturnType<InvitationsContextType['acceptInvite']> {
    if (!user) throw new Error('Oturum acmaniz gerekiyor.');
    if (normalizeEmail(invite.toEmail) !== normalizeEmail(user.email)) {
      throw new Error('Bu daveti kabul etme yetkiniz yok.');
    }

    const result = await acceptProjectInviteSecure(invite.id);
    if (!result?.success) {
      throw new Error('Davet kabul edilemedi.');
    }
  }

  async function declineInvite(inviteId: string): ReturnType<InvitationsContextType['declineInvite']> {
    if (!user) throw new Error('Oturum acmaniz gerekiyor.');
    const result = await declineProjectInviteSecure(inviteId);
    if (!result?.success) {
      throw new Error('Davet reddedilemedi.');
    }
  }

  return {
    sentInvites,
    receivedInvites,
    loading,
    sendInvite,
    acceptInvite,
    declineInvite,
  };
}
