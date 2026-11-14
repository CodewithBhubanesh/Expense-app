const Razorpay = require('razorpay');

const { CREDIT_TO_PAISA_MAPPING, PLAN_IDS } = require('../constants/paymentConstants');
const Users = require('../model/user');
const Payment = require('../model/payment');
const { hasActiveSubscription } = require('../utility/subscription');
const {
    verifyPaymentSignature,
    verifySubscriptionSignature,
    verifyWebhookSignature
} = require('../utility/razorpaySignature');

const razorpayClient =
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
        ? new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        })
        : null;

// Never send the password hash back to the browser
const toSafeUser = (user) => {
    const obj = typeof user.toObject === 'function' ? user.toObject() : { ...user };
    delete obj.password;
    return obj;
};

const fromUnix = (seconds) => (seconds ? new Date(seconds * 1000) : undefined);

// Convert a Razorpay subscription entity into our User.subscription shape
const mapSubscription = (sub) => ({
    subscriptionId: sub.id,
    planId: sub.plan_id,
    status: sub.status,
    start: fromUnix(sub.start_at),
    end: fromUnix(sub.end_at),
    lastBillDate: fromUnix(sub.current_start),
    nextBillDate: fromUnix(sub.charge_at),
    paymentsMade: sub.paid_count,
    paymentsRemaining: sub.remaining_count
});

// Atomically claim an order and add its credits exactly once.
// Safe to call from both verify-order and the webhook at the same time.
const markPaidAndCredit = async (orderId, paymentId) => {
    const payment = await Payment.findOneAndUpdate(
        { orderId, type: 'credits', status: { $ne: 'paid' } },
        { $set: { status: 'paid', paymentId, paidAt: new Date() } },
        { new: true }
    );

    if (!payment) {
        return { alreadyProcessed: true, payment: await Payment.findOne({ orderId }) };
    }

    try {
        await Users.updateOne({ _id: payment.userId }, { $inc: { credits: payment.credits } });
    } catch (error) {
        // Give the order back so it can be retried
        await Payment.updateOne({ _id: payment._id }, { $set: { status: 'created' } });
        throw error;
    }

    return { alreadyProcessed: false, payment };
};

const paymentsController = {

    // POST /payments/create-order   { credits }
    createOrder: async (request, response) => {
        try {
            if (!razorpayClient) {
                return response.status(500).json({ message: 'Razorpay not configured' });
            }

            const credits = Number(request.body.credits);
            const amount = CREDIT_TO_PAISA_MAPPING[credits];

            if (!amount) {
                return response.status(400).json({ message: 'Invalid credit value' });
            }

            const userId = String(request.user._id);

            const order = await razorpayClient.orders.create({
                amount,
                currency: 'INR',
                receipt: `rc_${userId.slice(-6)}_${Date.now()}`,
                notes: { userId, credits: String(credits) }
            });

            await Payment.create({
                userId,
                type: 'credits',
                orderId: order.id,
                credits,
                amount,
                currency: order.currency,
                receipt: order.receipt,
                status: 'created'
            });

            return response.status(200).json({ order });
        } catch (error) {
            console.log('Razorpay create order error:', error);
            return response.status(500).json({ message: 'Unable to create Razorpay order' });
        }
    },

    // POST /payments/verify-order   { razorpay_order_id, razorpay_payment_id, razorpay_signature }
    // The credits come from OUR stored order, never from the request body.
    verifyOrder: async (request, response) => {
        try {
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = request.body;

            if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
                return response.status(400).json({ message: 'Payment information is missing' });
            }

            const valid = verifyPaymentSignature({
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                signature: razorpay_signature,
                secret: process.env.RAZORPAY_KEY_SECRET
            });

            if (!valid) {
                return response.status(400).json({ message: 'Invalid transaction' });
            }

            const order = await Payment.findOne({
                orderId: razorpay_order_id,
                userId: request.user._id,
                type: 'credits'
            });

            if (!order) {
                return response.status(404).json({ message: 'Order not found for this user' });
            }

            const result = await markPaidAndCredit(razorpay_order_id, razorpay_payment_id);
            const user = await Users.findById(request.user._id);

            if (!user) {
                return response.status(404).json({ message: 'User not found' });
            }

            return response.status(200).json({
                message: 'Payment verified successfully',
                credits: order.credits,
                alreadyProcessed: result.alreadyProcessed,
                user: toSafeUser(user)
            });
        } catch (error) {
            console.log('Verify payment error:', error);
            return response.status(500).json({ message: 'Internal server error' });
        }
    },

    // GET /payments/history
    getHistory: async (request, response) => {
        try {
            const payments = await Payment.find({ userId: request.user._id })
                .sort({ createdAt: -1 })
                .limit(50)
                .select('-__v');

            return response.status(200).json({ payments });
        } catch (error) {
            console.log('Payment history error:', error);
            return response.status(500).json({ message: 'Unable to fetch payment history' });
        }
    },

    // POST /payments/create-subscription   { plan_name: 'UNLIMITED_MONTHLY' | 'UNLIMITED_YEARLY' }
    createSubscription: async (request, response) => {
        try {
            if (!razorpayClient) {
                return response.status(500).json({ message: 'Razorpay not configured' });
            }

            const plan = PLAN_IDS[request.body.plan_name];

            if (!plan || !plan.id) {
                return response.status(400).json({ message: 'Plan is not available' });
            }

            const user = await Users.findById(request.user._id);

            if (!user) {
                return response.status(404).json({ message: 'User not found' });
            }

            if (hasActiveSubscription(user)) {
                return response.status(409).json({ message: 'You already have an active subscription' });
            }

            const subscription = await razorpayClient.subscriptions.create({
                plan_id: plan.id,
                total_count: plan.totalBillingCycleCount,
                customer_notify: 1,
                notes: { userId: String(user._id), planName: request.body.plan_name }
            });

            return response.status(200).json({ subscription });
        } catch (error) {
            console.log('Create subscription error:', error);
            return response.status(500).json({ message: 'Unable to create subscription' });
        }
    },

    // POST /payments/capture-subscription
    // { razorpay_subscription_id, razorpay_payment_id, razorpay_signature }
    captureSubscription: async (request, response) => {
        try {
            if (!razorpayClient) {
                return response.status(500).json({ message: 'Razorpay not configured' });
            }

            const {
                razorpay_subscription_id: subscriptionId,
                razorpay_payment_id: paymentId,
                razorpay_signature: signature
            } = request.body;

            if (!subscriptionId || !paymentId || !signature) {
                return response.status(400).json({ message: 'Subscription payment information is missing' });
            }

            const valid = verifySubscriptionSignature({
                subscriptionId,
                paymentId,
                signature,
                secret: process.env.RAZORPAY_KEY_SECRET
            });

            if (!valid) {
                return response.status(400).json({ message: 'Invalid transaction' });
            }

            const subscription = await razorpayClient.subscriptions.fetch(subscriptionId);

            // The subscription must have been created for THIS user
            if (!subscription.notes || String(subscription.notes.userId) !== String(request.user._id)) {
                return response.status(403).json({ message: 'Subscription does not belong to this user' });
            }

            const user = await Users.findById(request.user._id);

            if (!user) {
                return response.status(404).json({ message: 'User not found' });
            }

            user.subscription = mapSubscription(subscription);
            await user.save();

            const plan = PLAN_IDS[subscription.notes.planName];

            await Payment.findOneAndUpdate(
                { orderId: subscriptionId },
                {
                    $set: {
                        userId: user._id,
                        type: 'subscription',
                        paymentId,
                        planName: subscription.notes.planName,
                        amount: plan ? plan.pricePaise : 0,
                        status: 'paid',
                        paidAt: new Date()
                    }
                },
                { upsert: true }
            );

            return response.status(200).json({ user: toSafeUser(user) });
        } catch (error) {
            console.log('Capture subscription error:', error);
            return response.status(500).json({ message: 'Internal server error' });
        }
    },

    // POST /payments/webhook   (called by Razorpay, no login cookie)
    // Credits the account even if the user closed the browser after paying.
    webhook: async (request, response) => {
        try {
            const valid = verifyWebhookSignature({
                rawBody: request.rawBody,
                signature: request.headers['x-razorpay-signature'],
                secret: process.env.RAZORPAY_WEBHOOK_SECRET
            });

            if (!valid) {
                return response.status(400).json({ message: 'Invalid webhook signature' });
            }

            const { event, payload = {} } = request.body;
            const paymentEntity = payload.payment && payload.payment.entity;
            const orderEntity = payload.order && payload.order.entity;
            const subscriptionEntity = payload.subscription && payload.subscription.entity;

            switch (event) {
                case 'payment.captured':
                case 'order.paid': {
                    const orderId = (paymentEntity && paymentEntity.order_id) || (orderEntity && orderEntity.id);
                    if (orderId) {
                        await markPaidAndCredit(orderId, paymentEntity && paymentEntity.id);
                    }
                    break;
                }

                case 'payment.failed': {
                    if (paymentEntity && paymentEntity.order_id) {
                        await Payment.updateOne(
                            { orderId: paymentEntity.order_id, status: 'created' },
                            { $set: { status: 'failed', paymentId: paymentEntity.id } }
                        );
                    }
                    break;
                }

                case 'subscription.activated':
                case 'subscription.charged':
                case 'subscription.pending':
                case 'subscription.halted':
                case 'subscription.cancelled':
                case 'subscription.completed':
                case 'subscription.paused':
                case 'subscription.resumed': {
                    if (subscriptionEntity) {
                        await Users.updateOne(
                            { 'subscription.subscriptionId': subscriptionEntity.id },
                            { $set: { subscription: mapSubscription(subscriptionEntity) } }
                        );
                    }
                    break;
                }

                default:
                    break;
            }

            // Always answer 200 for valid events so Razorpay stops retrying
            return response.status(200).json({ received: true });
        } catch (error) {
            console.log('Webhook error:', error);
            // 500 makes Razorpay retry later
            return response.status(500).json({ message: 'Webhook processing failed' });
        }
    }
};

module.exports = paymentsController;
