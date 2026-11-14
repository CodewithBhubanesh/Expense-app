import { useEffect, useState } from "react";
import axios from "axios";
import { serverEndpoint } from "../config/appConfig";

const CREDIT_PACK = [
    { price: 1, credits: 10, label: "Starter" },
    { price: 4, credits: 50, label: "Popular" },
    { price: 7, credits: 100, label: "Best value" },
];

const PLANS = {
    UNLIMITED_MONTHLY: { planName: "Unlimited Monthly", price: 5, frequency: "month" },
    UNLIMITED_YEARLY: { planName: "Unlimited Yearly", price: 50, frequency: "year" },
};

const ACTIVE = ["active", "authenticated"];

const statusBadge = (status) =>
    status === "paid" ? "success" : status === "failed" ? "danger" : "secondary";

function ManagePayments() {
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [history, setHistory] = useState([]);

    const loadData = async () => {
        try {
            const [profile, payments] = await Promise.all([
                axios.post(`${serverEndpoint}/profile/get-user-info`, {}, { withCredentials: true }),
                axios.get(`${serverEndpoint}/payments/history`, { withCredentials: true }),
            ]);
            setUserProfile(profile.data.user);
            setHistory(payments.data.payments || []);
        } catch (err) {
            console.log(err);
            setError("Unable to load your payment details");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const openCheckout = (options) => {
        if (!window.Razorpay) {
            setError("Payment window could not load. Check your internet connection and refresh.");
            return;
        }
        const razorpay = new window.Razorpay(options);
        razorpay.on("payment.failed", () => {
            setError("Payment failed. You have not been charged, please try again.");
            loadData();
        });
        razorpay.open();
    };

    // ---------- one-time credit packs ----------
    const verifyPayment = async (payment) => {
        try {
            const response = await axios.post(
                `${serverEndpoint}/payments/verify-order`,
                {
                    razorpay_order_id: payment.razorpay_order_id,
                    razorpay_payment_id: payment.razorpay_payment_id,
                    razorpay_signature: payment.razorpay_signature,
                },
                { withCredentials: true }
            );
            setUserProfile(response.data.user);
            setMessage(`Payment successful. ${response.data.credits} credits added to your account.`);
            loadData();
        } catch (err) {
            console.log(err);
            setError("Payment received but not verified yet. Your credits will appear shortly, or contact support.");
            loadData();
        }
    };

    const buyCredits = async (credits) => {
        try {
            setBusy(true);
            setError(null);
            setMessage(null);
            const { data } = await axios.post(
                `${serverEndpoint}/payments/create-order`,
                { credits },
                { withCredentials: true }
            );
            openCheckout({
                key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                amount: data.order.amount,
                currency: data.order.currency,
                name: "MergeMoney",
                description: `${credits} credits`,
                order_id: data.order.id,
                prefill: { name: userProfile?.name, email: userProfile?.email },
                theme: { color: "#6c63ff" },
                handler: verifyPayment,
            });
        } catch (err) {
            console.log(err);
            setError("Unable to start the payment");
        } finally {
            setBusy(false);
        }
    };

    // ---------- unlimited subscription ----------
    const captureSubscription = async (response) => {
        try {
            const { data } = await axios.post(
                `${serverEndpoint}/payments/capture-subscription`,
                {
                    razorpay_subscription_id: response.razorpay_subscription_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                },
                { withCredentials: true }
            );
            setUserProfile(data.user);
            setMessage("Subscription activated. You can now create unlimited groups.");
            loadData();
        } catch (err) {
            console.log(err);
            setError("Subscription payment received but not confirmed yet. Contact support if this persists.");
        }
    };

    const subscribe = async (planKey) => {
        try {
            setBusy(true);
            setError(null);
            setMessage(null);
            const { data } = await axios.post(
                `${serverEndpoint}/payments/create-subscription`,
                { plan_name: planKey },
                { withCredentials: true }
            );
            openCheckout({
                key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                name: "MergeMoney",
                description: PLANS[planKey].planName,
                subscription_id: data.subscription.id,
                prefill: { name: userProfile?.name, email: userProfile?.email },
                theme: { color: "#6c63ff" },
                handler: captureSubscription,
            });
        } catch (err) {
            console.log(err);
            setError(err.response?.data?.message || "Unable to start the subscription");
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <div className="container p-5 text-center">
                <div className="spinner-border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    const subscription = userProfile?.subscription;
    const isSubscribed = ACTIVE.includes(subscription?.status);

    return (
        <div className="container py-4 py-md-5">
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            {message && <div className="alert alert-success" role="alert">{message}</div>}

            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                <h2 className="mb-0">Manage Payments</h2>
                <div className="d-flex gap-2 flex-wrap">
                    <span className="badge rounded-pill text-bg-primary fs-6">
                        Credits: {userProfile?.credits ?? 0}
                    </span>
                    {isSubscribed && (
                        <span className="badge rounded-pill text-bg-success fs-6">Unlimited plan active</span>
                    )}
                </div>
            </div>

            <h5 className="mb-3">Buy credits <small className="text-muted">(1 credit = 1 new group)</small></h5>
            <div className="row g-3 mb-5">
                {CREDIT_PACK.map((pack) => (
                    <div className="col-12 col-md-4" key={pack.credits}>
                        <div className="card h-100 shadow-sm rounded-4 text-center p-3">
                            <span className="text-muted small">{pack.label}</span>
                            <h3 className="fw-bold">{pack.credits} Credits</h3>
                            <p className="fs-4 mb-3">&#8377;{pack.price}</p>
                            <button
                                className="btn btn-primary rounded-pill mt-auto"
                                disabled={busy}
                                onClick={() => buyCredits(pack.credits)}
                            >
                                Buy now
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <h5 className="mb-3">Unlimited plan</h5>
            {isSubscribed ? (
                <div className="card shadow-sm rounded-4 p-3 mb-5">
                    <div>Status: <strong>{subscription.status}</strong></div>
                    {subscription.nextBillDate && (
                        <div>Next billing: {new Date(subscription.nextBillDate).toLocaleDateString()}</div>
                    )}
                </div>
            ) : (
                <div className="row g-3 mb-5">
                    {Object.entries(PLANS).map(([key, plan]) => (
                        <div className="col-12 col-md-6" key={key}>
                            <div className="card h-100 shadow-sm rounded-4 text-center p-3">
                                <h4>{plan.planName}</h4>
                                <p className="fs-4 mb-1">&#8377;{plan.price} / {plan.frequency}</p>
                                <p className="text-muted small">Create unlimited groups</p>
                                <button
                                    className="btn btn-outline-primary rounded-pill mt-auto"
                                    disabled={busy}
                                    onClick={() => subscribe(key)}
                                >
                                    Subscribe
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <h5 className="mb-3">Payment history</h5>
            {history.length === 0 ? (
                <p className="text-muted">No payments yet.</p>
            ) : (
                <div className="table-responsive">
                    <table className="table align-middle">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Item</th>
                                <th>Amount</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((p) => (
                                <tr key={p._id}>
                                    <td>{new Date(p.createdAt).toLocaleString()}</td>
                                    <td>
                                        {p.type === "credits"
                                            ? `${p.credits} credits`
                                            : PLANS[p.planName]?.planName || "Subscription"}
                                    </td>
                                    <td>&#8377;{(p.amount / 100).toFixed(2)}</td>
                                    <td>
                                        <span className={`badge text-bg-${statusBadge(p.status)}`}>{p.status}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default ManagePayments;
