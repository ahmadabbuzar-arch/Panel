// api/razorpay.js — Razorpay Order Create + Verify
const crypto = require('crypto');

const RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

let USERS    = global._sapanel_users    || (global._sapanel_users    = {});
let PAYMENTS = global._sapanel_payments || (global._sapanel_payments = []);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { action } = req.body || {};

  // ── CREATE ORDER ──
  if (action === 'create_order') {
    const { amount, email } = req.body;
    if (!amount || amount < 10) return res.status(400).json({ error: 'Minimum ₹10 chahiye' });
    if (!email)                 return res.status(400).json({ error: 'Email required' });

    const amountPaise = Math.round(parseFloat(amount) * 100);

    try {
      const auth   = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
      const rzRes  = await fetch('https://api.razorpay.com/v1/orders', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
        body   : JSON.stringify({
          amount  : amountPaise,
          currency: 'INR',
          receipt : `sapanel_${Date.now()}`,
          notes   : { email, panel: 'SAPanel' }
        })
      });

      const order = await rzRes.json();
      if (order.error) return res.status(400).json({ error: order.error.description });

      PAYMENTS.push({ orderId: order.id, email, amount: parseFloat(amount), status: 'pending', createdAt: new Date().toISOString() });
      global._sapanel_payments = PAYMENTS;

      return res.status(200).json({ success: true, orderId: order.id, amount: amountPaise, currency: 'INR', keyId: RAZORPAY_KEY_ID });
    } catch (err) {
      return res.status(500).json({ error: 'Order create failed: ' + err.message });
    }
  }

  // ── VERIFY PAYMENT ──
  if (action === 'verify') {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
      return res.status(400).json({ error: 'Payment details missing' });

    const expectedSig = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature)
      return res.status(400).json({ error: 'Payment verification failed' });

    const payment = PAYMENTS.find(p => p.orderId === razorpay_order_id);
    if (!payment)                  return res.status(404).json({ error: 'Order not found' });
    if (payment.status === 'paid') return res.status(400).json({ error: 'Already credited' });

    payment.status    = 'paid';
    payment.paymentId = razorpay_payment_id;
    payment.paidAt    = new Date().toISOString();

    USERS = global._sapanel_users || {};
    const userEmail = (payment.email || email || '').toLowerCase().trim();
    const user      = USERS[userEmail];
    if (user) {
      user.balance = parseFloat(((user.balance || 0) + payment.amount).toFixed(2));
      global._sapanel_users = USERS;
    }

    return res.status(200).json({ success: true, credited: payment.amount, newBalance: user?.balance || 0 });
  }

  // ── ADMIN: list payments ──
  if (action === 'list') {
    const adminKey = process.env.ADMIN_SECRET;
    if (!adminKey || req.headers['x-admin-secret'] !== adminKey)
      return res.status(403).json({ error: 'Unauthorized' });
    return res.status(200).json({ payments: [...PAYMENTS].reverse() });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
