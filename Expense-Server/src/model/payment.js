const mongoose = require('mongoose');

// One record per Razorpay order (credit packs) or subscription.
// The SERVER decides credits/amount when the order is created, so the
// browser can never choose how many credits it receives.
const paymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['credits', 'subscription'], required: true },
    orderId: { type: String, required: true, unique: true }, // Razorpay order id (or subscription id)
    paymentId: { type: String },
    credits: { type: Number, default: 0 },
    planName: { type: String },
    amount: { type: Number, required: true }, // in paise
    currency: { type: String, default: 'INR' },
    receipt: { type: String },
    status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created' },
    paidAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
