"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  User, Mail, Lock, Camera, Save, Loader2,
  Eye, EyeOff, ShieldCheck, Trash2, AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

import { useAuth } from "@/components/providers/auth-provider";
import { useWorkspace } from "@/hooks/use-workspace";
import { getFirebaseAuthErrorMessage } from "@/lib/firebase/auth-errors";
import { updateWorkspaceBrandingSecure, uploadWorkspaceLogoSecure } from "@/services/entitlement-service";

function validatePasswordPolicy(password: string): boolean {
  const hasMinimumLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecialCharacter = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?]/.test(password);

  return (
    hasMinimumLength &&
    hasUppercase &&
    hasLowercase &&
    hasDigit &&
    hasSpecialCharacter
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-[#0d0f13] border border-white/5 rounded-sm p-6 md:p-8"
    >
      <div className="mb-6 pb-4 border-b border-white/5">
        <h2 className="text-lg font-serif text-white italic">{title}</h2>
        {subtitle && <p className="text-xs font-sans text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-sans text-gray-500 uppercase tracking-widest mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "w-full bg-white/5 border border-white/10 rounded-sm px-4 py-2.5 text-sm text-white font-sans placeholder:text-gray-700 focus:outline-none focus:border-primary/50 transition-colors";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AyarlarPage() {
  const t = useTranslations();
  const { currentUser, updateDisplayName, updateUserEmail, updateUserPassword, deleteUserAccount } = useAuth();
  const { activeWorkspace, isAdmin } = useWorkspace();
  const deleteConfirmationText = t("dashboard.settings.deleteConfirmationToken");
  const router = useRouter();
  const isGoogleUser = useMemo(
    () => currentUser?.providerData?.some((provider) => provider?.providerId === "google.com") ?? false,
    [currentUser],
  );

  const [displayName, setDisplayName] = useState("");
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newEmailTouched, setNewEmailTouched] = useState(false);
  const [emailPassword, setEmailPassword] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [brandColor, setBrandColor] = useState(activeWorkspace?.branding?.primaryColor || "#c6a87c");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState(activeWorkspace?.branding?.logoUrl || "");
  const [brandingLoading, setBrandingLoading] = useState(false);

  const displayNameValue = displayNameTouched
    ? displayName
    : (currentUser?.displayName || "");
  const newEmailValue = newEmailTouched
    ? newEmail
    : (currentUser?.email || "");

  async function handleProfileUpdate(e: React.FormEvent) {
    e.preventDefault();

    if (!displayNameValue.trim()) {
      toast.error(t("dashboard.settings.displayNameRequired"));
      return;
    }

    try {
      setProfileLoading(true);
      await updateDisplayName(displayNameValue);
      toast.success(t("dashboard.settings.profileUpdated"));
      setDisplayNameTouched(false);
      router.refresh();
    } catch (error) {
      toast.error(getFirebaseAuthErrorMessage(error));
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleEmailUpdate(e: React.FormEvent) {
    e.preventDefault();

    if (!currentUser?.email) {
      toast.error(t("dashboard.settings.emailMissing"));
      return;
    }

    if (newEmailValue.trim() === currentUser.email) {
      toast.error(t("dashboard.settings.emailSame"));
      return;
    }

    try {
      setEmailLoading(true);
      await updateUserEmail(newEmailValue, emailPassword);
      toast.success(t("dashboard.settings.verificationSent"));
      setEmailPassword("");
    } catch (error) {
      toast.error(getFirebaseAuthErrorMessage(error));
    } finally {
      setEmailLoading(false);
    }
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();

    if (newPwd !== confirmPwd) {
      toast.error(t("dashboard.settings.passwordMismatch"));
      return;
    }

    if (!validatePasswordPolicy(newPwd)) {
      toast.error(t("dashboard.settings.passwordPolicy"));
      return;
    }

    try {
      setPwdLoading(true);
      await updateUserPassword(currentPwd, newPwd);
      toast.success(t("dashboard.settings.passwordChanged"));
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } catch (error) {
      toast.error(getFirebaseAuthErrorMessage(error));
    } finally {
      setPwdLoading(false);
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();

    if (deleteConfirm !== deleteConfirmationText) {
      toast.error(t("dashboard.settings.deleteConfirmError"));
      return;
    }

    try {
      setDeleteLoading(true);
      await deleteUserAccount(isGoogleUser ? undefined : deletePassword);
      toast.success(t("dashboard.settings.accountDeleted"));
      router.replace("/giris");
      router.refresh();
    } catch (error) {
      toast.error(getFirebaseAuthErrorMessage(error));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleBrandingUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkspace || !isAdmin) {
      toast.error(t("dashboard.settings.brandingAdminOnly"));
      return;
    }

    setBrandingLoading(true);
    try {
      let logoUrl = logoPreview;
      if (logoFile) {
        const uploadResult = await uploadWorkspaceLogoSecure(activeWorkspace.id, logoFile);
        if (uploadResult.success && uploadResult.logoUrl) {
          logoUrl = uploadResult.logoUrl;
          setLogoPreview(logoUrl);
        }
      }

      const result = await updateWorkspaceBrandingSecure(activeWorkspace.id, {
        primaryColor: brandColor,
        logoUrl,
      });

      if (result.success) {
        toast.success(t("dashboard.settings.brandingUpdated"));
        setLogoFile(null);
        router.refresh();
      } else {
        toast.error(t("dashboard.settings.brandingFailed"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("errors.generic"));
    } finally {
      setBrandingLoading(false);
    }
  }

  const displayNamePreview = displayNameValue.trim() || currentUser?.displayName || t("dashboard.settings.unnamedUser");
  const emailPreview = currentUser?.email || "";
  const avatarInitial = (displayNamePreview[0] || emailPreview[0] || "?").toUpperCase();

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <p className="text-primary text-xs uppercase tracking-[0.25em] font-sans mb-1">{t("dashboard.settings.eyebrow")}</p>
        <h1 className="text-3xl font-serif text-white italic">{t("dashboard.settings.title")}</h1>
        <p className="text-gray-500 font-sans text-sm mt-1">{t("dashboard.settings.subtitle")}</p>
      </motion.div>

      <div className="space-y-6">
        {/* Profile */}
        <SectionCard title={t("dashboard.settings.profileTitle")} subtitle={t("dashboard.settings.profileSubtitle")}>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-black font-bold text-xl overflow-hidden">
                    <span>{avatarInitial}</span>
                  </div>
                  {currentUser?.photoURL && (
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                      <Camera className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-sans text-white font-medium">{displayNamePreview}</p>
                  <p className="text-xs font-sans text-gray-500">{emailPreview}</p>
                  {isGoogleUser && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-sans bg-blue-500/10 text-blue-400 border border-blue-400/20 px-2 py-0.5 rounded-full mt-1">
                      <ShieldCheck className="w-2.5 h-2.5" /> {t("dashboard.settings.googleAccount")}
                    </span>
                  )}
                </div>
              </div>

            <FormField label={t("dashboard.settings.fullName")}>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                  type="text"
                    value={displayNameValue}
                    onChange={(e) => {
                      setDisplayNameTouched(true);
                      setDisplayName(e.target.value);
                    }}
                  placeholder={t("dashboard.settings.fullNamePlaceholder")}
                  className={`${inputClass} pl-10`}
                />
              </div>
            </FormField>

              <button
                type="submit"
                disabled={profileLoading}
                className="flex items-center gap-2 bg-primary text-black text-xs font-sans font-bold uppercase tracking-widest px-6 py-2.5 rounded-sm hover:bg-white transition-colors disabled:opacity-50"
              >
                {profileLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {profileLoading ? t("common.saving") : t("common.save")}
              </button>
            </form>
          </SectionCard>

          {/* Email */}
          {!isGoogleUser && (
          <SectionCard title={t("dashboard.settings.emailTitle")} subtitle={t("dashboard.settings.emailSubtitle")}>
            <form onSubmit={handleEmailUpdate} className="space-y-4">
            <FormField label={t("dashboard.settings.newEmail")}>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                  type="email"
                      value={newEmailValue}
                      onChange={(e) => {
                        setNewEmailTouched(true);
                        setNewEmail(e.target.value);
                      }}
                  required
                  className={`${inputClass} pl-10`}
                />
              </div>
            </FormField>

            <FormField label={t("dashboard.settings.currentPasswordConfirm")}>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                  type="password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </FormField>

              <button
                type="submit"
                disabled={emailLoading}
                className="flex items-center gap-2 bg-primary text-black text-xs font-sans font-bold uppercase tracking-widest px-6 py-2.5 rounded-sm hover:bg-white transition-colors disabled:opacity-50"
              >
                {emailLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {emailLoading ? t("dashboard.settings.updating") : t("dashboard.settings.updateEmail")}
              </button>
            </form>
          </SectionCard>
          )}

          {/* Password */}
          {!isGoogleUser && (
          <SectionCard title={t("dashboard.settings.passwordTitle")} subtitle={t("dashboard.settings.passwordSubtitle")}>
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
            {[
              { label: t("dashboard.settings.currentPassword"),  value: currentPwd, set: setCurrentPwd, show: showCurrent, setShow: setShowCurrent },
              { label: t("dashboard.settings.newPassword"),    value: newPwd,     set: setNewPwd,     show: showNew,     setShow: setShowNew     },
              { label: t("dashboard.settings.confirmNewPassword"), value: confirmPwd, set: setConfirmPwd, show: showConfirm, setShow: setShowConfirm },
            ].map(({ label, value, set, show, setShow }) => (
              <FormField key={label} label={label}>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                  <input
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    required
                    placeholder="••••••••"
                    className={`${inputClass} pl-10 pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition-colors"
                  >
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </FormField>
            ))}

              <button
                type="submit"
                disabled={pwdLoading}
                className="flex items-center gap-2 bg-primary text-black text-xs font-sans font-bold uppercase tracking-widest px-6 py-2.5 rounded-sm hover:bg-white transition-colors disabled:opacity-50"
              >
                {pwdLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />} {pwdLoading ? t("dashboard.settings.changing") : t("dashboard.settings.changePassword")}
              </button>
            </form>
          </SectionCard>
          )}

        {/* Workspace Branding */}
        {isAdmin && activeWorkspace && (
          <SectionCard title={t("dashboard.settings.brandingTitle")} subtitle={t("dashboard.settings.brandingSubtitle")}>
            <form onSubmit={handleBrandingUpdate} className="space-y-5">
              <FormField label={t("dashboard.settings.logo")}>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="h-12 w-auto object-contain rounded-sm border border-white/10 bg-white/5 px-2" />
                  ) : (
                    <div className="h-12 w-12 rounded-sm border border-white/10 bg-white/5 flex items-center justify-center text-gray-500 text-xs">{t("dashboard.settings.none")}</div>
                  )}
                  <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-sm text-xs font-sans font-bold uppercase tracking-widest text-gray-300 hover:bg-white/10 transition-colors">
                    <Camera className="w-3.5 h-3.5" />
                    {logoFile ? logoFile.name : t("dashboard.settings.uploadLogo")}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setLogoFile(file);
                          const reader = new FileReader();
                          reader.onload = (ev) => setLogoPreview(String(ev.target?.result || ""));
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </FormField>

              <FormField label={t("dashboard.settings.primaryColor")}>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="w-10 h-10 rounded-sm border border-white/10 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className={inputClass}
                    placeholder="#c6a87c"
                  />
                </div>
              </FormField>

              <button
                type="submit"
                disabled={brandingLoading}
                className="flex items-center gap-2 bg-primary text-black text-xs font-sans font-bold uppercase tracking-widest px-6 py-2.5 rounded-sm hover:bg-white transition-colors disabled:opacity-50"
              >
                {brandingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {brandingLoading ? t("common.saving") : t("dashboard.settings.saveBranding")}
              </button>
            </form>
          </SectionCard>
        )}

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-red-500/5 border border-red-500/15 rounded-sm p-6 md:p-8"
        >
          <div className="flex items-start gap-3 mb-6 pb-4 border-b border-red-500/10">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-serif text-red-400 italic">{t("dashboard.settings.dangerTitle")}</h2>
              <p className="text-xs font-sans text-gray-500 mt-1">{t("dashboard.settings.dangerSubtitle")}</p>
            </div>
          </div>

          <form onSubmit={handleDeleteAccount} className="space-y-4">
            <p className="text-sm font-sans text-gray-400">
              {t("dashboard.settings.deleteInstruction")} <span className="font-bold text-white font-mono">{deleteConfirmationText}</span> {t("dashboard.settings.deleteInstructionSuffix")}
            </p>

            <FormField label={t("dashboard.settings.deleteConfirmationLabel")}>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={deleteConfirmationText}
                className={`${inputClass} border-red-500/20 focus:border-red-400/50`}
              />
            </FormField>

            {!isGoogleUser && <FormField label={t("dashboard.settings.deletePasswordLabel")}>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputClass} pl-10 border-red-500/20 focus:border-red-400/50`}
                />
              </div>
            </FormField>}

            <button
              type="submit"
              disabled={deleteLoading || deleteConfirm !== deleteConfirmationText}
              className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white text-xs font-sans font-bold uppercase tracking-widest px-6 py-2.5 rounded-sm transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {deleteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} {deleteLoading ? t("common.deleting") : t("dashboard.settings.deleteAccount")}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
