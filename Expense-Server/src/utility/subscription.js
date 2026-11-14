const ACTIVE_STATUSES = ['active', 'authenticated'];

// True when the user has a live unlimited plan
const hasActiveSubscription = (user) => {
    const sub = user && user.subscription;
    if (!sub || !ACTIVE_STATUSES.includes(sub.status)) return false;
    if (sub.end && new Date(sub.end).getTime() < Date.now()) return false;
    return true;
};

module.exports = { ACTIVE_STATUSES, hasActiveSubscription };
