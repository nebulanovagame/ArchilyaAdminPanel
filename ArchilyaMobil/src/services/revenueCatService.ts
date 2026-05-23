import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from 'react-native-purchases';
import { CREDIT_PRODUCT_IDS, SUBSCRIPTION_PRODUCT_IDS, type PlanId } from '../constants/subscriptionCatalog';

const RC_API_KEYS = {
  apple: process.env.EXPO_PUBLIC_RC_APPLE_API_KEY || 'appl_YOUR_APPLE_KEY',
  google: process.env.EXPO_PUBLIC_RC_GOOGLE_API_KEY || 'goog_YOUR_GOOGLE_KEY',
};

let isConfigured = false;

export function configureRevenueCat(): void {
  if (isConfigured) return;

  try {
    Purchases.setLogLevel(Platform.OS === 'ios' ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);

    const apiKey = Platform.select({
      ios: RC_API_KEYS.apple,
      android: RC_API_KEYS.google,
      default: RC_API_KEYS.google,
    });

    Purchases.configure({ apiKey });
    isConfigured = true;
  } catch (error) {
    console.error('[RevenueCat] configure failed:', error);
  }
}

export async function getOfferings(): Promise<PurchasesOfferings | null> {
  try {
    return await Purchases.getOfferings();
  } catch (error) {
    console.error('[RevenueCat] getOfferings failed:', error);
    return null;
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    console.error('[RevenueCat] getCustomerInfo failed:', error);
    return null;
  }
}

type PurchaseValidationType = 'subscription' | 'credit';

function getPackageIdentifiers(pkg: PurchasesPackage): string[] {
  return [pkg.identifier, pkg.product.identifier].filter(Boolean);
}

function validateProductType(isValid: boolean, validateType?: PurchaseValidationType): void {
  if (!validateType || isValid) return;
  throw new Error(
    validateType === 'subscription'
      ? 'INVALID_SUBSCRIPTION_PRODUCT'
      : 'INVALID_CREDIT_PRODUCT'
  );
}

export function isSubscriptionPackage(pkg: PurchasesPackage): boolean {
  return getPackageIdentifiers(pkg).some((id) => SUBSCRIPTION_PRODUCT_IDS.includes(id));
}

export function isCreditPackage(pkg: PurchasesPackage): boolean {
  return getPackageIdentifiers(pkg).some((id) => CREDIT_PRODUCT_IDS.includes(id));
}

export interface PurchaseResult {
  customerInfo: CustomerInfo | null;
  success: boolean;
  error?: { code: string; message: string };
}

export async function purchasePackage(
  pkg: PurchasesPackage,
  validateType?: PurchaseValidationType
): Promise<PurchaseResult> {
  validateProductType(
    validateType === 'subscription' ? isSubscriptionPackage(pkg) : validateType === 'credit' ? isCreditPackage(pkg) : true,
    validateType
  );

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { customerInfo, success: true };
  } catch (error: any) {
    if (error?.userCancelled) {
      return { customerInfo: null, success: false };
    }
    console.error('[RevenueCat] purchasePackage failed:', error);
    return {
      customerInfo: null,
      success: false,
      error: {
        code: error?.code || 'PURCHASE_ERROR',
        message: error?.message || 'PURCHASE_FAILED',
      },
    };
  }
}

export async function purchaseStoreProduct(
  product: PurchasesStoreProduct,
  validateType?: PurchaseValidationType
): Promise<PurchaseResult> {
  validateProductType(
    validateType === 'subscription'
      ? SUBSCRIPTION_PRODUCT_IDS.includes(product.identifier)
      : validateType === 'credit'
        ? CREDIT_PRODUCT_IDS.includes(product.identifier)
        : true,
    validateType
  );

  try {
    const { customerInfo } = await Purchases.purchaseStoreProduct(product);
    return { customerInfo, success: true };
  } catch (error: any) {
    if (error?.userCancelled) {
      return { customerInfo: null, success: false };
    }
    console.error('[RevenueCat] purchaseStoreProduct failed:', error);
    return {
      customerInfo: null,
      success: false,
      error: {
        code: error?.code || 'PURCHASE_ERROR',
        message: error?.message || 'PURCHASE_FAILED',
      },
    };
  }
}

export interface RestoreResult {
  customerInfo: CustomerInfo | null;
  success: boolean;
  error?: { code: string; message: string };
}

export async function restorePurchases(): Promise<RestoreResult> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { customerInfo, success: true };
  } catch (error: any) {
    console.error('[RevenueCat] restorePurchases failed:', error);
    return {
      customerInfo: null,
      success: false,
      error: {
        code: error?.code || 'RESTORE_ERROR',
        message: error?.message || 'RESTORE_FAILED',
      },
    };
  }
}

export function checkEntitlement(
  customerInfo: CustomerInfo | null,
  entitlementId: string
): boolean {
  if (!customerInfo) return false;
  return customerInfo.entitlements.active[entitlementId] !== undefined;
}

export function getActivePlan(customerInfo: CustomerInfo | null): PlanId {
  if (!customerInfo) return 'free';
  if (checkEntitlement(customerInfo, 'studio')) return 'studio';
  if (checkEntitlement(customerInfo, 'pro')) return 'pro';
  if (checkEntitlement(customerInfo, 'solo')) return 'solo';
  return 'free';
}

export function setRevenueCatUserId(appUserId: string): void {
  try {
    Purchases.logIn(appUserId);
  } catch (error) {
    console.error('[RevenueCat] logIn failed:', error);
  }
}

export function logoutRevenueCat(): void {
  try {
    Purchases.logOut();
    isConfigured = false;
  } catch (error) {
    console.error('[RevenueCat] logOut failed:', error);
  }
}
