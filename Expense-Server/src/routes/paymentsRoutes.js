const express = require('express');
const router = express.Router();

const paymentsController = require('../controllers/paymentsController');
const authMiddleware = require('../middlewares/authMiddleware');
const authorizeMiddleware = require('../middlewares/authorizeMiddleware');

// Razorpay -> server (verified by signature, so no login cookie)
router.post('/webhook', paymentsController.webhook);

// Everything below needs a logged-in user with the payment permission
router.use(authMiddleware.protect);

router.post('/create-order', authorizeMiddleware('payment:create'), paymentsController.createOrder);
router.post('/verify-order', authorizeMiddleware('payment:create'), paymentsController.verifyOrder);
router.get('/history', authorizeMiddleware('payment:create'), paymentsController.getHistory);
router.post('/create-subscription', authorizeMiddleware('payment:create'), paymentsController.createSubscription);
router.post('/capture-subscription', authorizeMiddleware('payment:create'), paymentsController.captureSubscription);

module.exports = router;
