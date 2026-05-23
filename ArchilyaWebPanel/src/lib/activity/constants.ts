import type { ActivityAction, ActivityCategory } from "./types";

export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  member: "Ekip",
  project: "Proje",
  credit: "Kredi",
  ai: "AI",
  subscription: "Abonelik",
  file: "Dosya",
  workspace: "Calisma Alani",
};

export const ACTION_LABELS: Record<ActivityAction, string> = {
  createWorkspace: "çalışma alanı oluşturdu",
  inviteMember: "üyeyi davet etti",
  acceptInvite: "daveti kabul etti",
  declineInvite: "daveti reddetti",
  removeMember: "üyeyi kaldırdı",
  deleteWorkspace: "çalışma alanını sildi",
  createProject: "proje oluşturdu",
  softDeleteProject: "projeyi çöp kutusuna taşıdı",
  restoreProject: "projeyi geri yükledi",
  hardDeleteProject: "projeyi kalıcı olarak sildi",
  uploadFile: "dosya yükledi",
  deleteFile: "dosyayı sildi",
  restoreFile: "dosyayı geri yükledi",
  permanentlyDeleteFile: "dosyayı kalıcı olarak sildi",
  aiJobQueued: "AI işini kuyruğa aldı",
  aiJobCompleted: "AI işini tamamladı",
  aiJobFailed: "AI işinde hata aldı",
  creditDeducted: "kredi düşüldü",
  creditRefunded: "kredi iade edildi",
  subscriptionUpgraded: "aboneliği yükseltti",
  subscriptionDowngraded: "aboneliği düşürdü",
  subscriptionCancelled: "aboneliği iptal etti",
  subscriptionReactivated: "aboneliği yeniden etkinleştirdi",
};

export const CATEGORY_COLORS: Record<ActivityCategory, string> = {
  member: "bg-sky-100 text-sky-700",
  project: "bg-emerald-100 text-emerald-700",
  credit: "bg-amber-100 text-amber-700",
  ai: "bg-violet-100 text-violet-700",
  subscription: "bg-fuchsia-100 text-fuchsia-700",
  file: "bg-zinc-100 text-zinc-700",
  workspace: "bg-cyan-100 text-cyan-700",
};
