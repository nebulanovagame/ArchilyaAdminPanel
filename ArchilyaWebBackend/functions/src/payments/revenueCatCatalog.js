const SUBSCRIPTION_PRODUCT_MAP = {
  pro_monthly: 'pro',
  pro_annual: 'pro',
  solo_monthly: 'solo',
  solo_annual: 'solo',
  studio_monthly: 'studio',
  studio_annual: 'studio',
};

const CREDIT_TOPUP_MAP = {
  boost_500_std: { credits: 500, description: '500 Kredi Top-up', price: 450 },
  boost_500_sub: { credits: 500, description: '500 Kredi Top-up (Abone)', price: 350 },
  boost_1500_std: { credits: 1500, description: '1500 Kredi Top-up', price: 1150 },
  boost_1500_sub: { credits: 1500, description: '1500 Kredi Top-up (Abone)', price: 900 },
  boost_4000_std: { credits: 4000, description: '4000 Kredi Top-up', price: 2700 },
  boost_4000_sub: { credits: 4000, description: '4000 Kredi Top-up (Abone)', price: 2200 },
};

function isSubscriptionProduct(productId) {
  return Object.prototype.hasOwnProperty.call(SUBSCRIPTION_PRODUCT_MAP, productId);
}

function isCreditTopupProduct(productId) {
  return Object.prototype.hasOwnProperty.call(CREDIT_TOPUP_MAP, productId);
}

function getPlanIdFromProduct(productId) {
  return SUBSCRIPTION_PRODUCT_MAP[productId] || null;
}

function getCreditTopupFromProduct(productId) {
  return CREDIT_TOPUP_MAP[productId] || null;
}

module.exports = {
  SUBSCRIPTION_PRODUCT_MAP,
  CREDIT_TOPUP_MAP,
  isSubscriptionProduct,
  isCreditTopupProduct,
  getPlanIdFromProduct,
  getCreditTopupFromProduct,
};
