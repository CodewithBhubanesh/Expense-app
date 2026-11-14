// Credit packs: credits -> price in paise (INR 1 = 100 paise)
const CREDIT_TO_PAISA_MAPPING = {
    10: 100,
    50: 400,
    100: 700
};

const PAISA_TO_CREDIT_MAPPING = {
    100: 10,
    400: 50,
    700: 100
};

// Unlimited plans (create the plans in the Razorpay dashboard and put their ids in .env)
const PLAN_IDS = {
    UNLIMITED_MONTHLY: {
        id: process.env.RAZORPAY_MONTHLY_PLAN_ID,
        name: 'MergeMoney Unlimited Monthly',
        totalBillingCycleCount: 12,
        pricePaise: 500
    },
    UNLIMITED_YEARLY: {
        id: process.env.RAZORPAY_YEARLY_PLAN_ID,
        name: 'MergeMoney Unlimited Yearly',
        totalBillingCycleCount: 5,
        pricePaise: 5000
    }
};

module.exports = {
    CREDIT_TO_PAISA_MAPPING,
    PAISA_TO_CREDIT_MAPPING,
    PLAN_IDS
};
