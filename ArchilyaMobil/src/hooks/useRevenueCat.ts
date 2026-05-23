import { useEffect, useState, useCallback, useMemo } from 'react';
import type { CustomerInfo, PurchasesOfferings, PurchasesPackage } from 'react-native-purchases';
import {
  configureRevenueCat,
  getCustomerInfo,
  getOfferings,
  purchasePackage,
  restorePurchases,
  getActivePlan,
  setRevenueCatUserId,
  logoutRevenueCat,
  isSubscriptionPackage,
  isCreditPackage,
} from '../services/revenueCatService';
import { useAuth } from '../context/AuthContext';
import type { PlanId } from '../constants/subscriptionCatalog';

export interface RevenueCatState {
  offerings: PurchasesOfferings | null;
  subscriptionPackages: PurchasesPackage[];
  creditPackages: PurchasesPackage[];
  customerInfo: CustomerInfo | null;
  activePlan: PlanId;
  loading: boolean;
  purchasingPackageId: string | null;
  restoring: boolean;
  error: string | null;
}

export interface RevenueCatActions {
  refresh: () => Promise<void>;
  purchaseSubscription: (pkg: PurchasesPackage) => Promise<boolean>;
  purchaseCredits: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
}

export function useRevenueCat(): RevenueCatState & RevenueCatActions {
  const { user } = useAuth();
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasingPackageId, setPurchasingPackageId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePlan = getActivePlan(customerInfo);

  const subscriptionPackages = useMemo(
    () => offerings?.current?.availablePackages.filter(isSubscriptionPackage) ?? [],
    [offerings]
  );

  const creditPackages = useMemo(
    () => offerings?.current?.availablePackages.filter(isCreditPackage) ?? [],
    [offerings]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      configureRevenueCat();

      const [offeringsData, customerInfoData] = await Promise.all([
        getOfferings(),
        getCustomerInfo(),
      ]);

      setOfferings(offeringsData);
      setCustomerInfo(customerInfoData);
    } catch (err: any) {
      setError(err?.message || 'Abonelik bilgileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  const purchaseSubscription = useCallback(
    async (pkg: PurchasesPackage): Promise<boolean> => {
      setPurchasingPackageId(pkg.identifier);
      setError(null);
      try {
        const result = await purchasePackage(pkg, 'subscription');
        if (result.success && result.customerInfo) {
          setCustomerInfo(result.customerInfo);
          return true;
        }
        if (result.error) {
          setError(result.error.message);
        }
        return false;
      } catch {
        return false;
      } finally {
        setPurchasingPackageId(null);
      }
    },
    []
  );

  const purchaseCredits = useCallback(
    async (pkg: PurchasesPackage): Promise<boolean> => {
      setPurchasingPackageId(pkg.identifier);
      setError(null);
      try {
        const result = await purchasePackage(pkg, 'credit');
        if (result.success && result.customerInfo) {
          setCustomerInfo(result.customerInfo);
          await refresh();
          return true;
        }
        if (result.error) {
          setError(result.error.message);
        }
        return false;
      } catch {
        return false;
      } finally {
        setPurchasingPackageId(null);
      }
    },
    [refresh]
  );

  const restore = useCallback(async (): Promise<boolean> => {
    setRestoring(true);
    setError(null);
    try {
      const result = await restorePurchases();
      if (result.success && result.customerInfo) {
        setCustomerInfo(result.customerInfo);
        return true;
      }
      if (result.error) {
        setError(result.error.message);
      }
      return false;
    } catch {
      return false;
    } finally {
      setRestoring(false);
    }
  }, []);

  useEffect(() => {
    if (user?.uid) {
      setRevenueCatUserId(user.uid);
    }
    refresh();
  }, [user?.uid, refresh]);

  useEffect(() => {
    return () => {
      if (!user) {
        logoutRevenueCat();
      }
    };
  }, [user]);

  return {
    offerings,
    subscriptionPackages,
    creditPackages,
    customerInfo,
    activePlan,
    loading,
    purchasingPackageId,
    restoring,
    error,
    refresh,
    purchaseSubscription,
    purchaseCredits,
    restore,
  };
}
