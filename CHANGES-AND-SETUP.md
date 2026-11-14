# MergeMoney: what changed and how to run it

## 1. Secure payment system (Expense-Server)
- `src/model/payment.js` (new): every order/subscription is stored with the credits and amount decided by the SERVER.
- `src/controllers/paymentsController.js` (rewritten): create-order, verify-order (idempotent, timing-safe HMAC, credits read from the stored order), history, create/capture subscription, webhook.
- `src/utility/razorpaySignature.js`, `src/utility/subscription.js` (new) + `tests/razorpaySignature.test.js` (run: `node --test tests/razorpaySignature.test.js`).
- `src/routes/paymentsRoutes.js`: adds `GET /payments/history` and `POST /payments/webhook`.
- `server.js`: keeps the raw request body (needed to verify webhook signatures).
- `groupController.js`: users with an active unlimited plan do not spend credits.
- Fixes: password hash no longer returned by payment APIs, auth debug log that printed cookies removed, email `from` address uses GOOGLE_EMAIL.

## 2. Client
- `src/pages/ManagePayments.jsx`: credit packs, unlimited plans, payment history, failed-payment handling.
- `src/pages/ManageSubscription.jsx`: sends the signature fields the server now verifies.
- `src/pages/Home.jsx` + `src/pages/home3d.css`: 3D, responsive home page (canvas coin field, CSS 3D scene, tilt cards, rotating cube). No new npm package needed.

## 3. Setup
1. Server: copy `.env.example` to `.env` and fill every value. Client: create `.env.development` with `VITE_SERVER_ENDPOINT`, `VITE_GOOGLE_CLIENT_ID`, `VITE_RAZORPAY_KEY_ID`.
2. Razorpay dashboard (test mode first): create a Monthly and a Yearly plan, copy their ids into `RAZORPAY_MONTHLY_PLAN_ID` / `RAZORPAY_YEARLY_PLAN_ID`.
3. Razorpay dashboard > Webhooks: URL `https://<your-server>/payments/webhook`, choose a secret (put it in `RAZORPAY_WEBHOOK_SECRET`), events: payment.captured, order.paid, payment.failed, subscription.*.
4. `npm install` then `npm start` (server) and `npm install` then `npm run dev` (client).

## 4. IMPORTANT
The original zip contained real keys in `.env` (MongoDB, Google app password, Razorpay, JWT). They are removed here. Rotate all of them and never commit `.env`.
