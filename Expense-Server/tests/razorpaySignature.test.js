const test = require('node:test');
const assert = require('node:assert/strict');
const {
    hmac,
    verifyPaymentSignature,
    verifySubscriptionSignature,
    verifyWebhookSignature
} = require('../src/utility/razorpaySignature');
const { hasActiveSubscription } = require('../src/utility/subscription');

const secret = 'test_secret';

test('valid order signature is accepted, tampered ones are rejected', () => {
    const signature = hmac(secret, 'order_1|pay_1');
    assert.equal(verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_1', signature, secret }), true);
    assert.equal(verifyPaymentSignature({ orderId: 'order_2', paymentId: 'pay_1', signature, secret }), false);
    assert.equal(verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: 'abc', secret }), false);
    assert.equal(verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_1', signature, secret: '' }), false);
});

test('subscription signature uses payment_id|subscription_id', () => {
    const signature = hmac(secret, 'pay_1|sub_1');
    assert.equal(verifySubscriptionSignature({ subscriptionId: 'sub_1', paymentId: 'pay_1', signature, secret }), true);
    assert.equal(verifySubscriptionSignature({ subscriptionId: 'sub_9', paymentId: 'pay_1', signature, secret }), false);
});

test('webhook signature is checked on the raw body', () => {
    const rawBody = Buffer.from('{"event":"payment.captured"}');
    const signature = hmac(secret, rawBody);
    assert.equal(verifyWebhookSignature({ rawBody, signature, secret }), true);
    assert.equal(verifyWebhookSignature({ rawBody: Buffer.from('{"event":"x"}'), signature, secret }), false);
    assert.equal(verifyWebhookSignature({ rawBody, signature, secret: undefined }), false);
});

test('active subscription detection', () => {
    assert.equal(hasActiveSubscription(null), false);
    assert.equal(hasActiveSubscription({ subscription: { status: 'active' } }), true);
    assert.equal(hasActiveSubscription({ subscription: { status: 'cancelled' } }), false);
    assert.equal(hasActiveSubscription({ subscription: { status: 'active', end: new Date(Date.now() - 1000) } }), false);
});
