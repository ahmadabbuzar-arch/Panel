// api/smmsbi.js — SMMSBI API Proxy + Order Placement
const SMMSBI_URL = 'https://smmsbi.com/api/v2';
const API_KEY    = process.env.SMMSBI_API_KEY || 'c9d6dd76d62b31749e22dc8fc54b4033';

let USERS  = global._sapanel_users  || (global._sapanel_users  = {});
let ORDERS = global._sapanel_orders || (global._sapanel_orders = []);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const body   = req.method === 'POST' ? (req.body || {}) : (req.query || {});
  const action = body.action;

  // ── GET SERVICES ──
  if (action === 'services' || !action) {
    try {
      const params = new URLSearchParams({ key: API_KEY, action: 'services' });
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
  if (action === 'order') {
    const { email, service, link, quantity } = body;
    if (!email || !service || !link || !quantity)
      return res.status(400).json({ error: 'email, service, link, quantity sab chahiye' });

    USERS = global._sapanel_users || {};
    const userKey = email.toLowerCase().trim();
    const user    = USERS[userKey];
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get service price
    let serviceInfo = null;
    try {
      const sp       = new URLSearchParams({ key: API_KEY, action: 'services' });
      const sr       = await fetch(SMMSBI_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: sp.toString() });
      const services = await sr.json();
      serviceInfo    = Array.isArray(services) ? services.find(s => String(s.service) === String(service)) : null;
    } catch (_) {}

    const pricePerK = serviceInfo ? parseFloat(serviceInfo.rate) : 0;
    const qty       = parseInt(quantity);
    const cost      = parseFloat(((pricePerK * qty) / 1000).toFixed(2));

    if (cost > 0 && user.balance < cost)
      return res.status(400).json({ error: `Balance kam hai. Required: ₹${cost.toFixed(2)}, Available: ₹${user.balance.toFixed(2)}` });

    // Place on SMMSBI
    try {
      const params = new URLSearchParams({ key: API_KEY, action: 'add', service, link, quantity: String(qty) });
      const r      = await fetch(SMMSBI_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
      const result = await r.json();

      if (result.error) return res.status(400).json({ error: result.error });

      // Deduct balance
      if (cost > 0) user.balance = parseFloat((user.balance - cost).toFixed(2));
      user.orders = (user.orders || 0) + 1;
      global._sapanel_users = USERS;

      const orderRecord = {
        id          : result.order,
        smmsbiId    : result.order,
        email       : userKey,
        service,
        serviceName : serviceInfo?.name || 'Service #' + service,
        link,
        quantity    : qty,
        cost,
        status      : 'pending',
        createdAt   : new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      };
      ORDERS.push(orderRecord);
      global._sapanel_orders = ORDERS;

      return res.status(200).json({ success: true, order: result.order, cost, newBalance: user.balance });
    } catch (err) {
      return res.status(500).json({ error: 'Order failed: ' + err.message });
    }
  }

  // ── ORDER STATUS ──
  if (action === 'status') {
    const { order } = body;
    if (!order) return res.status(400).json({ error: 'order ID chahiye' });
    try {
      const params = new URLSearchParams({ key: API_KEY, action: 'status', order });
      const r      = await fetch(SMMSBI_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
      const data   = await r.json();
      const local  = ORDERS.find(o => String(o.smmsbiId) === String(order));
      if (local && data.status) local.status = data.status.toLowerCase();
      return res.status(200).json(data);
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
