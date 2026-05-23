import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { PurchasesPackage } from 'react-native-purchases';
import { ArrowLeft, Check, CreditCard, ExternalLink, RefreshCcw, Sparkles, Zap } from 'lucide-react-native';
import { useCredits } from '../src/hooks/useCredits';
import { useRevenueCat } from '../src/hooks/useRevenueCat';
import { useAuth } from '../src/context/AuthContext';
import { trackEvent } from '../src/services/analyticsService';
import { CREDIT_PACKAGES, PLANS, getCreditPackageByProductId, type PlanId, type SubscriptionPlan } from '../src/constants/subscriptionCatalog';

type SubscriptionTab = 'plans' | 'credits' | 'billing';
type BillingCycle = 'monthly' | 'annual';

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('tr-TR');
}

function formatPrice(value: number) {
  return `₺${Number(value || 0).toLocaleString('tr-TR')}`;
}

function getPlanProductId(planId: PlanId, billingCycle: BillingCycle) {
  if (planId === 'free') return '';
  return `${planId}_${billingCycle}`;
}

function getPackageProductId(pkg: PurchasesPackage) {
  return pkg.product.identifier || pkg.identifier;
}

function getPackagePlanId(pkg: PurchasesPackage): PlanId | null {
  const searchable = `${pkg.identifier} ${pkg.product.identifier} ${pkg.product.title}`.toLowerCase();
  if (searchable.includes('studio')) return 'studio';
  if (searchable.includes('pro')) return 'pro';
  if (searchable.includes('solo')) return 'solo';
  return null;
}

export default function SubscriptionScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { credits, loading, refetchCredits, creditTransactions, creditTransactionsLoading, creditTransactionsLoaded, creditTransactionsError, fetchCreditTransactions } = useCredits();
  const revenueCat = useRevenueCat();
  const [activeTab, setActiveTab] = useState<SubscriptionTab>('plans');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [subscriptionViewTracked, setSubscriptionViewTracked] = useState(false);

  const isRevenueCatBusy = revenueCat.loading || Boolean(revenueCat.purchasingPackageId) || revenueCat.restoring;
  const activePlanConfig = PLANS.find((plan) => plan.id === revenueCat.activePlan) ?? PLANS[0];
  const hasActiveSubscription = revenueCat.activePlan !== 'free';

  const activeProductIds = useMemo(
    () =>
      Object.values(revenueCat.customerInfo?.entitlements.active ?? {})
        .map((entitlement: any) => String(entitlement?.productIdentifier || ''))
        .filter(Boolean),
    [revenueCat.customerInfo]
  );

  const subscriptionPackageByProductId = useMemo(() => {
    const packageMap: Record<string, PurchasesPackage> = {};
    revenueCat.subscriptionPackages.forEach((pkg) => {
      packageMap[pkg.identifier] = pkg;
      packageMap[pkg.product.identifier] = pkg;
    });
    return packageMap;
  }, [revenueCat.subscriptionPackages]);

  const creditPackageByProductId = useMemo(() => {
    const packageMap: Record<string, PurchasesPackage> = {};
    revenueCat.creditPackages.forEach((pkg) => {
      packageMap[pkg.identifier] = pkg;
      packageMap[pkg.product.identifier] = pkg;
    });
    return packageMap;
  }, [revenueCat.creditPackages]);

  useEffect(() => {
    if (loading || revenueCat.loading || subscriptionViewTracked) return;
    setSubscriptionViewTracked(true);
    void trackEvent('subscription_view', {
      current_plan: revenueCat.activePlan,
      profile_plan: userData?.plan || 'free',
    });
  }, [loading, revenueCat.activePlan, revenueCat.loading, subscriptionViewTracked, userData?.plan]);

  useEffect(() => {
    if (activeTab === 'billing' && !creditTransactionsLoaded && !creditTransactionsLoading) {
      void fetchCreditTransactions();
    }
  }, [activeTab, creditTransactionsLoaded, creditTransactionsLoading, fetchCreditTransactions]);

  useEffect(() => {
    if (revenueCat.error) {
      Alert.alert(t('subscription.purchaseErrorTitle'), revenueCat.error);
    }
  }, [revenueCat.error, t]);

  const getTransactionTypeLabel = (type: string) => (type === 'spend' ? t('subscription.spend') : t('subscription.earn'));
  const getTransactionAmountColor = (type: string) => (type === 'spend' ? 'text-red-400' : 'text-emerald-400');
  const getTransactionPrefix = (type: string) => (type === 'spend' ? '-' : '+');

  const isPackageActive = (pkg: PurchasesPackage) => {
    const packagePlanId = getPackagePlanId(pkg);
    return activeProductIds.includes(getPackageProductId(pkg)) || (packagePlanId !== null && packagePlanId === revenueCat.activePlan);
  };

  const handlePurchaseSubscription = async (plan: SubscriptionPlan, pkg: PurchasesPackage | undefined) => {
    if (!pkg || isRevenueCatBusy || plan.id === 'free' || revenueCat.activePlan === plan.id) return;

    await trackEvent('plan_upgrade_click', {
      plan_id: plan.id,
      billing_cycle: billingCycle,
      package_id: pkg.identifier,
      product_id: pkg.product.identifier,
    });

    const purchased = await revenueCat.purchaseSubscription(pkg);
    if (purchased) {
      await refetchCredits();
      await fetchCreditTransactions(true);
      Alert.alert(t('subscription.purchaseSuccess'), t('subscription.planActivated', { plan: t(`subscription.${plan.id}Plan`) }));
    } else {
      Alert.alert(t('subscription.purchaseErrorTitle'), t('subscription.purchaseErrorMessage'));
    }
  };

  const handlePurchaseCredits = async (pkg: PurchasesPackage | undefined) => {
    if (!pkg || isRevenueCatBusy) return;

    const catalogPackage = getCreditPackageByProductId(getPackageProductId(pkg));
    await trackEvent('credits_purchase_click', {
      package_id: pkg.identifier,
      product_id: pkg.product.identifier,
      credits: catalogPackage?.credits || 0,
      subscriber_price: hasActiveSubscription,
    });

    const purchased = await revenueCat.purchaseCredits(pkg);
    if (purchased) {
      await refetchCredits();
      await fetchCreditTransactions(true);
      Alert.alert(t('subscription.purchaseSuccess'), t('subscription.creditPurchaseSuccess'));
    } else {
      Alert.alert(t('subscription.purchaseErrorTitle'), t('subscription.purchaseErrorMessage'));
    }
  };

  const handleRestorePurchases = async () => {
    if (isRevenueCatBusy) return;

    const restored = await revenueCat.restore();
    if (restored) {
      await refetchCredits();
      await fetchCreditTransactions(true);
      Alert.alert(t('subscription.restoreSuccess'));
    } else {
      Alert.alert(t('subscription.restoreErrorTitle'), t('subscription.restoreErrorMessage'));
    }
  };

  const handleManageSubscription = async () => {
    const url = Platform.select({
      ios: 'https://apps.apple.com/account/subscriptions',
      android: 'https://play.google.com/store/account/subscriptions',
      default: 'https://play.google.com/store/account/subscriptions',
    });
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert(t('subscription.cancelSubscription'), t('subscription.cancelSubscriptionDesc'));
    }
  };

  const renderTabButton = (tab: SubscriptionTab, label: string) => (
    <TouchableOpacity
      className={`flex-1 py-3 rounded-xl items-center ${activeTab === tab ? 'bg-[#c6a87c]' : 'bg-transparent'}`}
      onPress={() => setActiveTab(tab)}
    >
      <Text className={activeTab === tab ? 'text-[#0f1115] font-bold text-xs' : 'text-white font-semibold text-xs'}>{label}</Text>
    </TouchableOpacity>
  );

  const renderCurrentPlanBadge = (isActive: boolean) =>
    isActive ? (
      <View className="bg-[#c6a87c] px-3 py-1 rounded-full">
        <Text className="text-[#0f1115] text-[11px] font-bold">{t('subscription.currentPlan')}</Text>
      </View>
    ) : null;

  const renderPlanMeta = (plan: SubscriptionPlan) => (
    <View className="flex-row flex-wrap mt-3">
      <View className="bg-[#1a1c23] border border-[#2a2d36] rounded-full px-3 py-1 mr-2 mb-2">
        <Text className="text-[#c6a87c] text-xs font-semibold">{t('subscription.creditsPerMonth', { credits: formatNumber(plan.credits) })}</Text>
      </View>
      <View className="bg-[#1a1c23] border border-[#2a2d36] rounded-full px-3 py-1 mr-2 mb-2">
        <Text className="text-[#9cc6ff] text-xs font-semibold">{t('subscription.storage', { storage: plan.storage })}</Text>
      </View>
      <View className="bg-[#1a1c23] border border-[#2a2d36] rounded-full px-3 py-1 mr-2 mb-2">
        <Text className="text-emerald-300 text-xs font-semibold">{t('subscription.projects', { projects: plan.projects })}</Text>
      </View>
      {plan.teamSize ? (
        <View className="bg-[#1a1c23] border border-[#2a2d36] rounded-full px-3 py-1 mr-2 mb-2">
          <Text className="text-amber-300 text-xs font-semibold">{t('subscription.teamSize', { size: plan.teamSize })}</Text>
        </View>
      ) : null}
    </View>
  );

  const renderPlanCard = (plan: SubscriptionPlan) => {
    const isFree = plan.id === 'free';
    const isActive = revenueCat.activePlan === plan.id;
    const productId = getPlanProductId(plan.id, billingCycle);
    const pkg = productId ? subscriptionPackageByProductId[productId] : undefined;
    const isPurchasing = pkg ? revenueCat.purchasingPackageId === pkg.identifier : false;
    const price = isFree ? t('subscription.free') : pkg?.product.priceString || formatPrice(billingCycle === 'monthly' ? plan.monthlyPrice : plan.annualPrice);
    const isDisabled = isFree || isActive || isRevenueCatBusy || !pkg;

    return (
      <View key={plan.id} className={`bg-[#0f1115] p-4 rounded-2xl border mb-3 ${isActive || plan.popular ? 'border-[#c6a87c]' : 'border-[#2a2d36]'}`}>
        <View className="flex-row justify-between items-start">
          <View className="flex-1 pr-3">
            <View className="flex-row items-center flex-wrap">
              <Text className="text-white text-lg font-bold mr-2">{t(`subscription.${plan.id}Plan`)}</Text>
              {plan.popular && !isActive ? (
                <View className="bg-[#2a2d36] border border-[#c6a87c] px-3 py-1 rounded-full mr-2">
                  <Text className="text-[#c6a87c] text-[10px] font-bold">{t('subscription.mostPopular')}</Text>
                </View>
              ) : null}
              {renderCurrentPlanBadge(isActive)}
            </View>
          </View>
          <View className="items-end ml-3">
            <Text className="text-[#c6a87c] text-lg font-bold">{price}</Text>
            {!isFree ? <Text className="text-gray-500 text-xs mt-1">{billingCycle === 'monthly' ? t('subscription.monthly') : t('subscription.annual')}</Text> : null}
          </View>
        </View>

        {renderPlanMeta(plan)}

        <View className="mt-2">
          {plan.features.map((feature) => (
            <View key={`${plan.id}-${feature}`} className="flex-row items-start mb-2">
              <View className="mt-0.5 mr-2">
                <Check size={14} color="#c6a87c" />
              </View>
              <Text className="text-gray-300 flex-1 text-sm">{feature}</Text>
            </View>
          ))}
        </View>

        {!isFree ? (
          <TouchableOpacity
            className={`mt-3 p-3 rounded-xl items-center ${isActive || !pkg ? 'bg-[#0f1115] border border-[#2a2d36]' : 'bg-[#c6a87c]'}`}
            onPress={() => handlePurchaseSubscription(plan, pkg)}
            disabled={isDisabled}
          >
            {isPurchasing ? (
              <View className="flex-row items-center">
                <ActivityIndicator color="#0f1115" size="small" />
                <Text className="text-[#0f1115] font-bold ml-2">{t('subscription.purchasing')}</Text>
              </View>
            ) : (
              <Text className={isActive || !pkg ? 'text-[#c6a87c] font-bold' : 'text-[#0f1115] font-bold'}>
                {isActive ? t('subscription.currentPlan') : pkg ? t('subscription.buy') : t('subscription.notInStore')}
              </Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const renderPlansTab = () => (
    <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-white font-semibold text-lg">{t('subscription.plansTab')}</Text>
        <View className="bg-[#0f1115] border border-[#2a2d36] rounded-xl p-1 flex-row">
          <TouchableOpacity className={`px-4 py-2 rounded-lg ${billingCycle === 'monthly' ? 'bg-[#c6a87c]' : 'bg-transparent'}`} onPress={() => setBillingCycle('monthly')}>
            <Text className={billingCycle === 'monthly' ? 'text-[#0f1115] font-bold text-xs' : 'text-white font-semibold text-xs'}>{t('subscription.monthly')}</Text>
          </TouchableOpacity>
          <TouchableOpacity className={`px-4 py-2 rounded-lg ${billingCycle === 'annual' ? 'bg-[#c6a87c]' : 'bg-transparent'}`} onPress={() => setBillingCycle('annual')}>
            <Text className={billingCycle === 'annual' ? 'text-[#0f1115] font-bold text-xs' : 'text-white font-semibold text-xs'}>{t('subscription.annual')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {revenueCat.loading ? (
        <View className="bg-[#0f1115] border border-[#2a2d36] rounded-xl p-4 items-center justify-center mb-3">
          <ActivityIndicator color="#c6a87c" size="small" />
          <Text className="text-gray-400 mt-3">{t('subscription.loadingPlans')}</Text>
        </View>
      ) : revenueCat.error ? (
        <View className="bg-[#0f1115] border border-[#2a2d36] rounded-xl p-4 mb-3">
          <Text className="text-red-400 text-center">{revenueCat.error || t('subscription.revenuecatError')}</Text>
          <TouchableOpacity className="bg-[#c6a87c] mt-3 p-3 rounded-xl" onPress={revenueCat.refresh} disabled={isRevenueCatBusy}>
            <Text className="text-[#0f1115] text-center font-bold">{t('subscription.revenuecatRetry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {PLANS.map((plan) => renderPlanCard(plan))}

      <TouchableOpacity className="bg-[#0f1115] mt-2 p-3 rounded-xl border border-[#2a2d36] items-center" onPress={handleRestorePurchases} disabled={isRevenueCatBusy}>
        {revenueCat.restoring ? (
          <View className="flex-row items-center">
            <ActivityIndicator color="#c6a87c" size="small" />
            <Text className="text-[#c6a87c] font-bold ml-2">{t('subscription.restoring')}</Text>
          </View>
        ) : (
          <View className="flex-row items-center">
            <RefreshCcw size={15} color="#c6a87c" />
            <Text className="text-[#c6a87c] font-bold ml-2">{t('subscription.restorePurchases')}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderCreditStoreTab = () => (
    <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
      <View className="flex-row items-center mb-4">
        <Zap size={18} color="#c6a87c" />
        <Text className="text-white font-semibold text-lg ml-2">{t('subscription.creditStoreTab')}</Text>
      </View>

      {revenueCat.loading ? (
        <View className="bg-[#0f1115] border border-[#2a2d36] rounded-xl p-4 items-center justify-center mb-3">
          <ActivityIndicator color="#c6a87c" size="small" />
          <Text className="text-gray-400 mt-3">{t('subscription.loadingCredits')}</Text>
        </View>
      ) : null}

      {CREDIT_PACKAGES.map((creditPackage) => {
        const productId = hasActiveSubscription ? creditPackage.subscriberProductId : creditPackage.standardProductId;
        const pkg = creditPackageByProductId[productId];
        const isPurchasing = pkg ? revenueCat.purchasingPackageId === pkg.identifier : false;
        const price = hasActiveSubscription ? creditPackage.subscriberPrice : creditPackage.standardPrice;

        return (
          <View key={creditPackage.id} className={`bg-[#0f1115] p-4 rounded-2xl border mb-3 ${creditPackage.popular ? 'border-[#c6a87c]' : 'border-[#2a2d36]'}`}>
            <View className="flex-row justify-between items-start">
              <View className="flex-1 pr-3">
                <View className="flex-row items-center flex-wrap">
                  <Text className="text-white text-lg font-bold mr-2">{t('subscription.creditPackageLabel', { amount: formatNumber(creditPackage.credits) })}</Text>
                  {creditPackage.popular ? (
                    <View className="bg-[#2a2d36] border border-[#c6a87c] px-3 py-1 rounded-full">
                      <Text className="text-[#c6a87c] text-[10px] font-bold">{t('subscription.mostPopular')}</Text>
                    </View>
                  ) : null}
                </View>
                <Text className="text-gray-500 mt-1">
                  {hasActiveSubscription
                    ? t('subscription.subscriberPrice', { price: formatNumber(creditPackage.subscriberPrice) })
                    : t('subscription.standardPrice', { price: formatNumber(creditPackage.standardPrice) })}
                </Text>
              </View>
              <Text className="text-[#c6a87c] text-xl font-bold">{pkg?.product.priceString || formatPrice(price)}</Text>
            </View>

            <TouchableOpacity className={`mt-3 p-3 rounded-xl items-center ${pkg ? 'bg-[#c6a87c]' : 'bg-[#0f1115] border border-[#2a2d36]'}`} onPress={() => handlePurchaseCredits(pkg)} disabled={isRevenueCatBusy || !pkg}>
              {isPurchasing ? (
                <ActivityIndicator color="#0f1115" size="small" />
              ) : (
                <View className="flex-row items-center">
                  <CreditCard size={15} color={pkg ? '#0f1115' : '#c6a87c'} />
                  <Text className={pkg ? 'text-[#0f1115] font-bold ml-2' : 'text-[#c6a87c] font-bold ml-2'}>{pkg ? t('subscription.buyCredits') : t('subscription.notInStore')}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );

  const renderBillingHistoryTab = () => (
    <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36]">
      <Text className="text-white font-semibold mb-3">{t('subscription.billingTab')}</Text>

      {creditTransactionsLoading ? (
        <View className="bg-[#0f1115] border border-[#2a2d36] rounded-xl p-4 items-center justify-center">
          <ActivityIndicator color="#c6a87c" size="small" />
          <Text className="text-gray-400 mt-3">{t('subscription.loadingBilling')}</Text>
        </View>
      ) : creditTransactionsError ? (
        <View className="bg-[#0f1115] border border-[#2a2d36] rounded-xl p-4">
          <Text className="text-red-400 text-center">{creditTransactionsError}</Text>
        </View>
      ) : creditTransactions.length === 0 ? (
        <View className="bg-[#0f1115] border border-[#2a2d36] rounded-xl p-4">
          <Text className="text-gray-400 text-center">{t('subscription.noBillingHistory')}</Text>
        </View>
      ) : (
        creditTransactions.map((item: any) => (
          <View key={item.id} className="bg-[#0f1115] border border-[#2a2d36] rounded-xl p-4 mb-3">
            <View className="flex-row items-start justify-between mb-2">
              <View className="flex-1 pr-3">
                <Text className="text-white font-semibold">{item.description}</Text>
                <Text className="text-gray-500 text-xs mt-1">{item.createdAt instanceof Date && !Number.isNaN(item.createdAt.getTime()) ? item.createdAt.toLocaleDateString('tr-TR') : '-'}</Text>
              </View>
              <Text className={`font-bold ${getTransactionAmountColor(item.type)}`}>
                {getTransactionPrefix(item.type)}{formatNumber(item.amount)} kredi
              </Text>
            </View>

            <View className="self-start bg-[#1a1c23] border border-[#2a2d36] rounded-full px-3 py-1">
              <Text className={`text-xs font-semibold ${getTransactionAmountColor(item.type)}`}>{getTransactionTypeLabel(item.type)}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#0f1115]" style={{ paddingTop: Platform.OS === 'android' ? 36 : 0 }}>
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="flex-row items-center mb-5">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 bg-[#1a1c23] p-2 rounded-lg">
            <ArrowLeft size={18} color="#c6a87c" />
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold">{t('subscription.label')}</Text>
        </View>

        <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
          <Text className="text-gray-400 text-xs uppercase">{t('subscription.currentPlanHeader')}</Text>
          <Text className="text-white text-2xl font-bold mt-1">{t(`subscription.${activePlanConfig.id}Plan`)}</Text>
          <View className="flex-row items-center mt-3">
            <Sparkles size={16} color="#c6a87c" />
            <Text className="text-[#c6a87c] ml-2 font-semibold">{t('subscription.currentCreditsLabel')}: {credits ?? 0}</Text>
          </View>
          <Text className="text-gray-500 text-sm mt-2">{t('subscription.creditsPerMonth', { credits: formatNumber(activePlanConfig.credits) })} • {t('subscription.storage', { storage: activePlanConfig.storage })}</Text>
          {hasActiveSubscription ? (
            <TouchableOpacity className="mt-3 flex-row items-center" onPress={handleManageSubscription}>
              <ExternalLink size={14} color="#c6a87c" />
              <Text className="text-[#c6a87c] ml-2 font-semibold text-sm">{t('subscription.cancelSubscription')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View className="bg-[#1a1c23] p-1 rounded-2xl border border-[#2a2d36] mb-4 flex-row">
          {renderTabButton('plans', t('subscription.plansTab'))}
          {renderTabButton('credits', t('subscription.creditStoreTab'))}
          {renderTabButton('billing', t('subscription.billingTab'))}
        </View>

        {activeTab === 'plans' ? renderPlansTab() : activeTab === 'credits' ? renderCreditStoreTab() : renderBillingHistoryTab()}
      </ScrollView>
    </SafeAreaView>
  );
}
