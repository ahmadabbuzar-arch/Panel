// api/smmsbi.js — SMMSBI API Proxy + Order Placement
const SMMSBI_URL = 'https://smmsbi.com/api/v2';
const API_KEY    = process.env.SMMSBI_API_KEY || '';

let USERS  = global._sapanel_users  || (global._sapanel_users  = {});
let ORDERS = global._sapanel_orders || (global._sapanel_orders = []);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const body   = req.method === 'POST' ? (req.body || {}) : (req.query || {});
  const action = body.action;

  // ── GET BALANCE (Test Connection) ──
  if (action === 'balance') {
    const key = body.key || API_KEY;
    if (!key) return res.status(400).json({ error: 'API key nahi hai' });
    try {
      const params = new URLSearchParams({ key, action: 'balance' });
      const r = await fetch(SMMSBI_URL, {
        method : 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body   : params.toString()
      });
      const data = await r.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: 'Balance fetch failed: ' + err.message });
    }
  }

  // ── GET SERVICES ──
  if (action === 'services' || !action) {
    const key = body.key || API_KEY;
    if (!key) return res.status(400).json({ error: 'API key nahi hai' });
    try {
      const params = new URLSearchParams({ key, action: 'services' });
      const r      = await fetch(SMMSBI_URL, {
        method : 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body   : params.toString()
      });
      return res.status(200).json(await r.json());
    } catch (err) {
      return res.status(500).json({ error: 'Services fetch failed: ' + err.message });
    }
  }

  // ── PLACE ORDER ──
  if (action === 'add') {
    const key = body.key || API_KEY;
    const { service, link, quantity } = body;
    if (!key || !service || !link || !quantity)
      return res.status(400).json({ error: 'key, service, link, quantity sab chahiye' });
    try {
      const params = new URLSearchParams({ key, action: 'add', service, link, quantity: String(quantity) });
      const r = await fetch(SMMSBI_URL, {
        method : 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body   : params.toString()
      });
      const result = await r.json();
      if (result.error) return res.status(400).json({ error: result.error });
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ error: 'Order failed: ' + err.message });
    }
  }

  // ── ORDER STATUS ──
  if (action === 'status') {
    const key = body.key || API_KEY;
    const { order } = body;
    if (!order) return res.status(400).json({ error: 'order ID chahiye' });
    try {
      const params = new URLSearchParams({ key, action: 'status', order });
      const r = await fetch(SMMSBI_URL, {
        method : 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body   : params.toString()
      });
      return res.status(200).json(await r.json());
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── MY ORDERS ──
  if (action === 'my_orders') {
    const { email } = body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const userOrders = ORDERS.filter(o => o.email === email.toLowerCase().trim());
    return res.status(200).json({ orders: userOrders.slice().reverse() });
  }

  // ── ADMIN: ALL ORDERS ──
  if (action === 'all_orders') {
    const adminKey = process.env.ADMIN_SECRET;
    if (!adminKey || req.headers['x-admin-secret'] !== adminKey)
      return res.status(403).json({ error: 'Unauthorized' });
    return res.status(200).json({ orders: [...ORDERS].reverse() });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
