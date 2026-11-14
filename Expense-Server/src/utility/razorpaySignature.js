const crypto = require('crypto');

const hmac = (secret, payload) =>
    crypto.createHmac('sha256', secret).update(payload).digest('hex');

// Constant-time string comparison (prevents timing attacks)
const safeEqual = (a, b) => {
    const x = Buffer.from(String(a || ''));
    const y = Buffer.from(String(b || ''));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Checkout signature for a one-time order: HMAC(order_id|payment_id)
const verifyPaymentSignature = ({ orderId, paymentId, signature, secret }) =>
    Boolean(secret && orderId && paymentId) &&
    safeEqual(hmac(secret, `${orderId}|${paymentId}`), signature);

// Checkout signature for a subscription: HMAC(payment_id|subscription_id)
const verifySubscriptionSignature = ({ subscriptionId, paymentId, signature, secret }) =>
    Boolean(secret && subscriptionId && paymentId) &&
    safeEqual(hmac(secret, `${paymentId}|${subscriptionId}`), signature);

// Webhook signature: HMAC(raw request body) using the webhook secret
const verifyWebhookSignature = ({ rawBody, signature, secret }) =>
    Boolean(secret && rawBody) && safeEqual(hmac(secret, rawBody), signature);

module.exports = {
    hmac,
    verifyPaymentSignature,
    verifySubscriptionSignature,
    verifyWebhookSignature
};
