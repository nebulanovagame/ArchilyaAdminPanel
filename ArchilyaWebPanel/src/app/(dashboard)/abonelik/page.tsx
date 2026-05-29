"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  CreditCard, Sparkles, Zap, Crown, Check,
  Clock, ArrowRight, Building2, Loader2, X, Rocket, ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";

import { useAuth } from "@/components/providers/auth-provider";
import { ADD_ON_PACKAGES, SUBSCRIPTION_PLANS } from "@/data/pricing-data";
import { useCredits } from "@/hooks/use-credits";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { useWorkspace } from "@/hooks/use-workspace";
import { logSubscriptionChanged } from "@/lib/analytics/events";
import {
  createIyzicoCheckoutFormSecure,
  verifyIyzicoPaymentSecure,
  cancelSubscriptionSecure,
  reactivateSubscriptionSecure,
  getSubscriptionQuoteSecure,
} from "@/services/entitlement-service";
import type { ProrationQuote } from "@/lib/subscription/types";

type BillingHistoryRow = {
  id: string;
  label?: string;
  credits?: number;
  amount?: number;
  status?: string;
  createdAt?: { toDate?: () => Date } | string | number | null;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const PLAN_ICON_MAP = {
  sparkles: Sparkles,
  zap: Zap,
  rocket: Rocket,
  crown: Crown,
};

function getPlanLabel(planId: string, t: ReturnType<typeof useTranslations>) {
  const planConfig = SUBSCRIPTION_PLANS.find((item) => item.id === planId);
  return planConfig ? t(`dashboard.subscription.plans.${planConfig.id}.name`) : planId || "free";
}

function formatPrice(price: number) {
  return Number(price || 0).toLocaleString("tr-TR");
}

function getRowDate(row: BillingHistoryRow) {
  const value = row?.createdAt;
  if (!value) return null;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value);
  }
  return null;
}

function getStatusMeta(status: string | undefined, t: ReturnType<typeof useTranslations>) {
  switch (String(status || "").toLowerCase()) {
    case "success":
      return { label: t("dashboard.subscription.statusPaid"), className: "bg-emerald-400/10 border-emerald-400/20 text-emerald-400" };
    case "pending":
      return { label: t("dashboard.subscription.statusPending"), className: "bg-amber-400/10 border-amber-400/20 text-amber-300" };
    default:
      return { label: t("dashboard.subscription.statusFailed"), className: "bg-red-400/10 border-red-400/20 text-red-400" };
  }
}

function IyzicoCheckoutModal({
  open,
  content,
  busy,
  onClose,
}: {
  open: boolean;
  content: string;
  busy: boolean;
  onClose: () => Promise<void>;
}) {
  const t = useTranslations("dashboard.subscription");
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !contentRef.current) return;

    const container = contentRef.current;
    container.innerHTML = content || "";

    const scripts = Array.from(container.querySelectorAll("script"));
    scripts.forEach((oldScript) => {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attribute) => {
        newScript.setAttribute(attribute.name, attribute.value);
      });
      newScript.text = oldScript.text;
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });

    return () => {
      container.innerHTML = "";
    };
  }, [open, content]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="w-full max-w-4xl rounded-sm border border-white/10 bg-[#0d0f13] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-primary">Iyzico Sandbox</p>
            <h3 className="text-lg font-serif italic text-white">{t("checkoutForm")}</h3>
          </div>
          <button
            onClick={() => void onClose()}
            disabled={busy}
            className="w-8 h-8 rounded-sm border border-white/10 text-gray-400 hover:text-white disabled:opacity-50 flex items-center justify-center"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          </button>
        </div>

        <div className="p-5">
          <div className="rounded-sm border border-white/10 bg-white min-h-[520px] p-3 overflow-auto">
            <div ref={contentRef} />
          </div>
          <p className="mt-3 text-[11px] text-gray-400 font-sans">
            {t("checkoutHelp")}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AbonelikPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { currentUser } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const { plan, loading, status, endAt } = useCredits();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const verifyingTokenRef = useRef("");

  const [activeCheckoutPlan, setActiveCheckoutPlan] = useState("");
  const [checkoutSession, setCheckoutSession] = useState({ token: "", checkoutFormContent: "", planId: "" });
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteData, setQuoteData] = useState<ProrationQuote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [reactivateBusy, setReactivateBusy] = useState(false);
  const [currentTime] = useState(() => Date.now());

  const userId = currentUser?.uid ?? null;
  const historyFilters = useMemo(
    () => (userId ? [{ column: "user_id", value: userId }] : []),
    [userId],
  );

  const mapHistoryRows = useCallback((rows: Record<string, unknown>[]) => {
    return rows.map((row) => ({
      id: String(row.id || ""),
      label: String(row.description || row.type || ""),
      credits: Number(row.amount || 0),
      amount: 0,
      status: String(row.type || ""),
      createdAt: row.created_at as BillingHistoryRow["createdAt"],
    }));
  }, []);

  const {
    data: historyRows,
    loading: historyLoading,
    loadingMore: historyLoadingMore,
    error: historyError,
    hasMore: historyHasMore,
    loadMore: loadMoreHistory,
  } = usePaginatedQuery({
    table: "credit_transactions",
    filters: historyFilters,
    orderByField: "created_at",
    orderDirection: "desc",
    pageSize: 10,
    mapRows: mapHistoryRows,
    enabled: Boolean(currentUser?.uid),
  });

  const sortedHistory = historyRows;

  const currentPlan = plan || "free";
  const activePlanLabel = getPlanLabel(currentPlan, t);
  const hasSubscriberPricing = currentPlan !== "free";

  useEffect(() => {
    if (historyError) {
      toast.error(t("dashboard.subscription.billingHistoryLoadError"));
    }
  }, [historyError, t]);

  async function verifyPayment(token: string, conversationId = "") {
    const verificationKey = token || conversationId;
    if (!verificationKey || verifyingTokenRef.current === verificationKey) return;
    verifyingTokenRef.current = verificationKey;
    setCheckoutBusy(true);

    try {
      const result = await verifyIyzicoPaymentSecure(token, conversationId);
      if (result?.success) {
        toast.success(t("dashboard.subscription.paymentActivated"));
        logSubscriptionChanged(activeCheckoutPlan || "checkout");
      } else {
        toast.error(result?.message || t("dashboard.subscription.paymentFailed"));
      }
    } catch {
      toast.error(t("dashboard.subscription.paymentFailed"));
    } finally {
      setCheckoutBusy(false);
      verifyingTokenRef.current = "";
    }
  }

  useEffect(() => {
    const hasCallback = searchParams.get("iyzicoCallback") === "1";
    const callbackToken = searchParams.get("token") || "";
    const callbackConversationId = searchParams.get("conversationId") || "";

    if (!currentUser?.uid || !hasCallback || (!callbackToken && !callbackConversationId)) {
      return;
    }

    void verifyPayment(callbackToken, callbackConversationId).finally(() => {
      router.replace(pathname);
    });
  }, [currentUser, pathname, router, searchParams]);

  async function handlePlanCheckout(planConfig: (typeof SUBSCRIPTION_PLANS)[number]) {
    if (!currentUser?.uid || checkoutBusy) return;

    setCheckoutBusy(true);
    setActiveCheckoutPlan(planConfig.id);
    try {
      const result = await createIyzicoCheckoutFormSecure(
        planConfig.id,
        currentUser.uid,
        currentUser.email || "",
        currentUser.name || t("common.user"),
      );

      if (!result?.token || !result?.checkoutFormContent) {
        throw new Error(t("dashboard.subscription.iyzicoFormFailed"));
      }

      setCheckoutSession({
        token: result.token,
        checkoutFormContent: result.checkoutFormContent,
        planId: planConfig.id,
      });
      setCheckoutModalOpen(true);
    } catch {
      toast.error(t("dashboard.subscription.checkoutOpenFailed"));
    } finally {
      setCheckoutBusy(false);
      setActiveCheckoutPlan("");
    }
  }

  async function handleCloseCheckoutModal() {
    const token = checkoutSession.token;
    setCheckoutModalOpen(false);
    setCheckoutSession({ token: "", checkoutFormContent: "", planId: "" });
    await verifyPayment(token);
  }

  async function handleAddOnCheckout(pkgId: string) {
    if (!currentUser?.uid || checkoutBusy) return;

    setCheckoutBusy(true);
    setActiveCheckoutPlan(pkgId);
    try {
      const result = await createIyzicoCheckoutFormSecure(
        pkgId,
        currentUser.uid,
        currentUser.email || "",
        currentUser.name || t("common.user"),
      );

      if (!result?.token || !result?.checkoutFormContent) {
        throw new Error(t("dashboard.subscription.iyzicoFormFailed"));
      }

      setCheckoutSession({
        token: result.token,
        checkoutFormContent: result.checkoutFormContent,
        planId: pkgId,
      });
      setCheckoutModalOpen(true);
    } catch {
      toast.error(t("dashboard.subscription.addOnCheckoutFailed"));
    } finally {
      setCheckoutBusy(false);
      setActiveCheckoutPlan("");
    }
  }

  async function handleCancelSubscription() {
    if (!currentUser?.uid || !activeWorkspace?.id) {
      toast.error(t("dashboard.subscription.workspaceRequired"));
      return;
    }
    setCancelBusy(true);
    try {
      const result = await cancelSubscriptionSecure(activeWorkspace.id);
      if (result.success) {
        toast.success(result.message || t("dashboard.subscription.renewalCancelled"));
        logSubscriptionChanged("cancelled");
      } else {
        toast.error(t("dashboard.subscription.cancelFailed"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.subscription.cancelFailed"));
    } finally {
      setCancelBusy(false);
    }
  }

  async function handleReactivateSubscription() {
    if (!currentUser?.uid || !activeWorkspace?.id) {
      toast.error(t("dashboard.subscription.workspaceRequired"));
      return;
    }
    setReactivateBusy(true);
    try {
      const result = await reactivateSubscriptionSecure(activeWorkspace.id);
      if (result.success) {
        toast.success(result.message || t("dashboard.subscription.reactivated"));
        logSubscriptionChanged("reactivated");
      } else {
        toast.error(t("dashboard.subscription.reactivateFailed"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.subscription.reactivateFailed"));
    } finally {
      setReactivateBusy(false);
    }
  }

  async function handleGetQuote(targetPlanId: string) {
    if (!currentUser?.uid || !activeWorkspace?.id) {
      toast.error(t("dashboard.subscription.workspaceRequired"));
      return;
    }
    setQuoteBusy(true);
    try {
      const quote = await getSubscriptionQuoteSecure(activeWorkspace.id, targetPlanId as import("@/lib/subscription/types").SubscriptionPlanId);
      setQuoteData(quote);
      setQuoteModalOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.subscription.quoteFailed"));
    } finally {
      setQuoteBusy(false);
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-primary text-[10px] uppercase tracking-[0.3em]">{t("dashboard.subscription.eyebrow")}</p>
            <h1 className="text-3xl font-serif text-white italic">{t("dashboard.subscription.title")}</h1>
          </div>
        </div>
        <p className="text-gray-400 text-sm font-sans mt-3">{t("dashboard.subscription.subtitle")}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        <div className="rounded-sm border border-primary/15 bg-primary/5 p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-primary mb-2">{t("dashboard.subscription.pricingExplanation.unitTitle")}</p>
          <p className="text-xs text-gray-400 leading-relaxed">{t("dashboard.subscription.pricingExplanation.unitDescription")}</p>
        </div>
        <div className="rounded-sm border border-white/8 bg-white/3 p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-amber-400 mb-2">{t("dashboard.subscription.annualPoolTitle")}</p>
          <p className="text-xs text-gray-400 leading-relaxed">{t("dashboard.subscription.pricingExplanation.annualNote")} {t("dashboard.subscription.pricingExplanation.studioNote")}</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-12 p-6 bg-white/5 border border-white/10 rounded-sm flex flex-col md:flex-row items-center justify-between gap-6"
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-sm flex items-center justify-center border ${status === "cancelled" ? "bg-red-400/10 border-red-400/20" : "bg-emerald-400/10 border-emerald-400/20"}`}>
            {status === "cancelled" ? <X className="w-6 h-6 text-red-400" /> : <Check className="w-6 h-6 text-emerald-400" />}
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-sans mb-1">{t("dashboard.subscription.activePlan")}</p>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-serif text-white italic uppercase tracking-wider">{loading ? t("common.loading") : activePlanLabel}</h2>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${status === "cancelled" ? "bg-red-400/10 text-red-400 border-red-400/20" : status === "active" ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" : "bg-amber-400/10 text-amber-400 border-amber-400/20"}`}>
                {status === "cancelled" ? t("dashboard.subscription.statusCancelled") : status === "active" ? t("dashboard.subscription.statusActive") : t("dashboard.subscription.statusPending")}
              </span>
            </div>
            {endAt && (
              <p className="text-[11px] text-gray-500 mt-1">
                {status === "cancelled" ? t("dashboard.subscription.accessEnds") : t("dashboard.subscription.renewalDate")} {new Date(endAt).toLocaleDateString(locale)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {status === "active" && (
            <button
              onClick={() => void handleCancelSubscription()}
              disabled={cancelBusy}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-sm text-xs font-sans font-bold uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {cancelBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              {t("dashboard.subscription.cancel")}
            </button>
          )}
          {status === "cancelled" && endAt && new Date(endAt).getTime() > currentTime && (
            <button
              onClick={() => void handleReactivateSubscription()}
              disabled={reactivateBusy}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-sm text-xs font-sans font-bold uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {reactivateBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {t("dashboard.subscription.reactivate")}
            </button>
          )}
        </div>
      </motion.div>

      <div className="mb-16">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-serif text-white italic">{t("dashboard.subscription.upgradePlan")}</h3>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-sans">{t("dashboard.subscription.iyzicoSandboxActive")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {SUBSCRIPTION_PLANS.map((planConfig, index) => {
            const isCurrent = currentPlan === planConfig.id;
            const Icon = PLAN_ICON_MAP[planConfig.iconKey as keyof typeof PLAN_ICON_MAP] || Sparkles;

            return (
              <motion.div
                key={planConfig.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + index * 0.05 }}
                className={cx(
                  "relative p-8 rounded-2xl border flex flex-col backdrop-blur-2xl transition-all duration-500 ease-out hover:-translate-y-2",
                  planConfig.popular && !isCurrent
                    ? "bg-primary/[0.03] border-primary/30 shadow-[0_0_40px_rgba(198,168,124,0.15)] hover:shadow-[0_10px_50px_rgba(198,168,124,0.25)] hover:border-primary/50"
                    : "bg-white/[0.02] border-white/5 hover:border-white/10",
                  isCurrent && "opacity-80 grayscale-[30%] pointer-events-none",
                )}
              >
                {planConfig.popular && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-black text-[10px] font-bold uppercase px-4 py-1.5 rounded-full whitespace-nowrap shadow-[0_0_20px_rgba(198,168,124,0.4)]">
                    {t("dashboard.subscription.popular")}
                  </div>
                )}

                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-400 text-black text-[9px] font-bold uppercase px-3 py-1 rounded-full flex items-center gap-1 whitespace-nowrap">
                    <Check className="w-3 h-3" /> {t("dashboard.subscription.currentPlan")}
                  </div>
                )}

                <div className="mb-4 flex items-start gap-4">
                  <div className={cx(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border backdrop-blur-md",
                    planConfig.popular ? "bg-primary/10 border-primary/20 shadow-[0_0_20px_rgba(198,168,124,0.15)] text-primary" : "bg-white/[0.03] border-white/5 text-gray-400",
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif italic text-white leading-snug">{t(`dashboard.subscription.plans.${planConfig.id}.name`)}</h3>
                  </div>
                </div>

                <p className="text-xs text-gray-400 font-sans leading-relaxed min-h-[3rem] mb-6">{t(`dashboard.subscription.plans.${planConfig.id}.description`)}</p>

                <div className={cx(
                  "mb-8 px-5 py-5 rounded-xl border backdrop-blur-md",
                  planConfig.popular ? "border-primary/20 bg-primary/[0.02]" : "border-white/5 bg-white/[0.02]",
                )}>
                  {planConfig.price === 0 ? (
                    <span className="text-4xl font-serif text-white">{t("dashboard.subscription.free")}</span>
                  ) : (
                    <>
                      <span className="text-4xl font-serif text-white drop-shadow-md">₺{formatPrice(planConfig.price)}</span>
                      <span className="text-gray-500 text-sm ml-1.5 font-sans">{t("dashboard.subscription.perMonth")}</span>
                      {planConfig.priceAnnual && (
                        <p className="text-[10px] text-emerald-400 font-sans mt-2">{t("dashboard.subscription.annualOffer", { price: formatPrice(planConfig.priceAnnual) })}</p>
                      )}
                    </>
                  )}
                </div>

                <div className="flex flex-col gap-2 mb-6 mt-4 pb-6 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Sparkles className={`w-3.5 h-3.5 ${planConfig.color}`} />
                    <p className="text-xs text-gray-300 font-sans font-medium"><span className="font-bold text-white">{formatPrice(planConfig.credits)}</span> {t("dashboard.subscription.transactionQuota")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className={`w-3.5 h-3.5 ${planConfig.color}`} />
                    <p className="text-xs text-gray-300 font-sans"><span className="font-bold text-white">{planConfig.projects}</span></p>
                  </div>
                  {planConfig.teamSize && (
                    <div className="flex items-center gap-2">
                      <Building2 className={`w-3.5 h-3.5 ${planConfig.color}`} />
                      <p className="text-xs text-gray-300 font-sans"><span className="font-bold text-white">{t("dashboard.subscription.teamSize", { count: planConfig.teamSize })}</span> {t("dashboard.subscription.teamPool")}</p>
                    </div>
                  )}
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {planConfig.features.map((_, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-2.5">
                      <Check className={`w-3.5 h-3.5 ${planConfig.color} shrink-0 mt-0.5`} />
                      <span className="text-xs text-gray-400 font-sans leading-relaxed">{t(`dashboard.subscription.plans.${planConfig.id}.features.${featureIndex}`)}</span>
                    </li>
                  ))}
                </ul>

                {!isCurrent ? (
                  <div className="mt-auto">
                    <button
                      onClick={() => void handleGetQuote(planConfig.id)}
                      disabled={checkoutBusy || quoteBusy}
                      className={cx(
                        "flex w-full items-center justify-center rounded-xl border px-6 py-3.5 text-[11px] font-bold uppercase tracking-[0.25em] transition-all duration-500 disabled:opacity-60 hover:shadow-lg",
                        planConfig.popular
                          ? "bg-primary text-black border-primary hover:bg-white hover:border-white shadow-[0_0_20px_rgba(198,168,124,0.3)]"
                          : "bg-white/[0.03] text-gray-300 border-white/10 hover:border-primary/40 hover:bg-primary/10 hover:text-white",
                      )}
                    >
                      {quoteBusy && activeCheckoutPlan === planConfig.id ? <Loader2 className="w-4 h-4 animate-spin" /> : t("dashboard.subscription.changePlan")}
                    </button>
                  </div>
                ) : (
                  <button
                    disabled
                    className={cx(
                      "w-full py-3.5 px-6 rounded-xl text-[11px] font-bold uppercase tracking-[0.25em] transition-all duration-500 border mt-auto",
                      isCurrent ? "bg-white/5 border-transparent text-gray-500 cursor-not-allowed" : "bg-transparent border-white/10 text-gray-500 cursor-not-allowed",
                    )}
                  >
                    {isCurrent ? t("dashboard.subscription.inUse") : t("dashboard.subscription.startFree")}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="mb-16">
        <div className="flex items-center gap-2 mb-6">
          <Zap className="w-4 h-4 text-amber-400" />
          <h3 className="text-lg font-serif text-white italic">{t("dashboard.subscription.addOns")}</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {ADD_ON_PACKAGES.map((pkg, index) => (
            <motion.div
              key={pkg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              className={cx(
                "p-5 rounded-sm border flex items-center justify-between transition-colors",
                pkg.popular ? "bg-amber-400/5 border-amber-400/30" : "bg-[#0d0f13] border-white/5 hover:border-white/15",
              )}
            >
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">{t(`dashboard.subscription.addOnPackages.${pkg.id}.label`)}</p>
                <p className="text-base font-serif text-white mb-0.5">+{formatPrice(pkg.credits)} <span className="text-[10px] text-gray-500 font-sans">{t("dashboard.subscription.transaction")}</span></p>
                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{t(`dashboard.subscription.addOnPackages.${pkg.id}.description`)}</p>
                <p className={cx("text-xs font-bold font-sans mt-2", pkg.popular ? "text-amber-400" : "text-primary")}>
                  {hasSubscriberPricing ? t("dashboard.subscription.subscriberPrice", { price: formatPrice(pkg.subscriberPrice) }) : t("dashboard.subscription.standardPrice", { price: formatPrice(pkg.standardPrice) })}
                </p>
                <p className="text-[10px] text-gray-600 mt-1">{hasSubscriberPricing ? t("dashboard.subscription.standardShort", { price: formatPrice(pkg.standardPrice) }) : t("dashboard.subscription.subscriberShort", { price: formatPrice(pkg.subscriberPrice) })}</p>
              </div>
              <button
                onClick={() => handleAddOnCheckout(pkg.id)}
                disabled={checkoutBusy}
                className="w-8 h-8 rounded-sm border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors text-gray-400 hover:text-white group disabled:opacity-40"
              >
                {checkoutBusy && activeCheckoutPlan === pkg.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                )}
              </button>
            </motion.div>
          ))}
        </div>
        <p className="text-[11px] text-gray-600 mt-4">{t("dashboard.subscription.pricingExplanation.addOnNote")}</p>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-6">
          <Clock className="w-4 h-4 text-gray-500" />
          <h3 className="text-lg font-serif text-white italic">{t("dashboard.subscription.historyTitle")}</h3>
        </div>
        <div className="bg-[#0d0f13] border border-white/5 rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[640px]">
            <thead className="bg-white/2 border-b border-white/5">
              <tr>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">{t("dashboard.subscription.date")}</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">{t("dashboard.subscription.operation")}</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">{t("dashboard.subscription.amount")}</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">{t("dashboard.subscription.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {historyLoading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-500 font-sans">{t("dashboard.subscription.historyLoading")}</td>
                </tr>
              ) : !sortedHistory.length ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-sm border border-white/10 bg-white/5">
                        <Clock className="w-5 h-5 text-gray-500" />
                      </div>
                      <p className="text-sm font-sans text-white">{t("dashboard.subscription.historyEmptyTitle")}</p>
                      <p className="mt-1 text-xs font-sans text-gray-500 max-w-md">{t("dashboard.subscription.historyEmptyDesc")}</p>
                    </div>
                  </td>
                </tr>
              ) : sortedHistory.map((row) => {
                const status = getStatusMeta(row.status, t);
                const createdAt = getRowDate(row);

                return (
                  <tr key={row.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-5 py-4 text-xs font-sans text-gray-400">
                      {createdAt ? createdAt.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : "-"}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-xs font-sans text-white">{row.label || t("dashboard.subscription.operation")}</p>
                      <p className="text-[10px] font-sans text-emerald-400 mt-0.5">{t("dashboard.subscription.quotaLine", { credits: formatPrice(row.credits || 0) })}</p>
                    </td>
                    <td className="px-5 py-4 text-xs font-sans text-white text-right">₺{formatPrice(row.amount || 0)}</td>
                    <td className="px-5 py-4 text-right">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border text-[9px] font-bold uppercase tracking-widest ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
          {historyHasMore && (
            <div className="flex justify-center py-5 border-t border-white/5">
              <button
                onClick={() => void loadMoreHistory()}
                disabled={historyLoadingMore}
                className="flex items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 rounded-sm text-xs font-sans font-bold uppercase tracking-widest text-gray-300 hover:border-primary/40 hover:text-white transition-all disabled:opacity-50"
              >
                {historyLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                {t("dashboard.subscription.loadMore")}
              </button>
            </div>
          )}
        </div>
      </div>

      <IyzicoCheckoutModal
        open={checkoutModalOpen}
        content={checkoutSession.checkoutFormContent}
        busy={checkoutBusy}
        onClose={handleCloseCheckoutModal}
      />

      {quoteModalOpen && quoteData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setQuoteModalOpen(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-[#0d0f13] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-serif text-white italic">{t("dashboard.subscription.quoteTitle")}</h3>
              <button onClick={() => setQuoteModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm font-sans">
                <span className="text-gray-400">{t("dashboard.subscription.newPlan")}</span>
                <span className="text-white font-medium">{getPlanLabel(quoteData.targetPlanId, t)}</span>
              </div>
              <div className="flex justify-between text-sm font-sans">
                <span className="text-gray-400">{t("dashboard.subscription.changeType")}</span>
                <span className="text-white font-medium">{quoteData.changeType === "upgrade" ? t("dashboard.subscription.upgrade") : quoteData.changeType === "downgrade" ? t("dashboard.subscription.downgrade") : t("dashboard.subscription.change")}</span>
              </div>
              <div className="flex justify-between text-sm font-sans">
                <span className="text-gray-400">{t("dashboard.subscription.daysRemaining")}</span>
                <span className="text-white font-medium">{t("dashboard.subscription.days", { count: quoteData.daysRemaining })}</span>
              </div>
              <div className="flex justify-between text-sm font-sans">
                <span className="text-gray-400">{t("dashboard.subscription.poolCredit")}</span>
                <span className="text-emerald-400 font-medium">-₺{formatPrice(quoteData.billingCreditKurus)}</span>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex justify-between text-sm font-sans">
                <span className="text-gray-400">{t("dashboard.subscription.amountDueToday")}</span>
                <span className="text-primary font-bold text-lg">₺{formatPrice(quoteData.amountDueKurus)}</span>
              </div>
              {quoteData.effectiveAt && (
                <div className="flex justify-between text-xs font-sans text-gray-500">
                  <span>{t("dashboard.subscription.effectiveDate")}</span>
                  <span>{new Date(quoteData.effectiveAt).toLocaleDateString(locale)}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setQuoteModalOpen(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-300 hover:bg-white/5 text-xs font-bold uppercase tracking-widest transition-all"
              >
                {t("common.close")}
              </button>
              <button
                onClick={() => {
                  setQuoteModalOpen(false);
                  const planConfig = SUBSCRIPTION_PLANS.find((p) => p.id === quoteData.targetPlanId);
                  if (planConfig) void handlePlanCheckout(planConfig);
                }}
                disabled={checkoutBusy}
                className="flex-1 py-3 rounded-xl bg-primary text-black hover:bg-white text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50"
              >
                {checkoutBusy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t("dashboard.subscription.startPayment")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
