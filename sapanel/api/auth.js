// api/auth.js — Register / Login / Balance
let USERS = global._sapanel_users || (global._sapanel_users = {});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { action, name, email, password } = req.body || {};
  if (!action) return res.status(400).json({ error: 'action required' });

  USERS = global._sapanel_users || {};
  const key = (email || '').toLowerCase().trim();

  // ── REGISTER ──
  if (action === 'register') {
    if (!name || !key || !password)
      return res.status(400).json({ error: 'Name, email aur password chahiye' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password kam se kam 6 characters ka ho' });
    if (USERS[key])
      return res.status(400).json({ error: 'Yeh email already registered hai' });

    USERS[key] = {
      name    : name.trim(),
      email   : key,
      password: Buffer.from(password).toString('base64'),
      balance : 0,
      orders  : 0,
      joined  : new Date().toLocaleDateString('en-IN'),
      isAdmin : false
    };
    global._sapanel_users = USERS;
    const { password: _, ...safe } = USERS[key];
    return res.status(200).json({ success: true, user: safe });
  }

  // ── LOGIN ──
  if (action === 'login') {
    if (!key || !password) return res.status(400).json({ error: 'Email aur password dalo' });
    const user = USERS[key];
    if (!user) return res.status(401).json({ error: 'Email registered nahi hai' });
    if (user.password !== Buffer.from(password).toString('base64'))
      return res.status(401).json({ error: 'Password galat hai' });
    const { password: _, ...safe } = user;
    return res.status(200).json({ success: true, user: safe });
  }

  // ── GET BALANCE ──
  if (action === 'balance') {
    const user = USERS[key];
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password: _, ...safe } = user;
    return res.status(200).json({ balance: user.balance, user: safe });
  }

  // ── ADMIN: set balance ──
  if (action === 'set_balance') {
    const adminKey = process.env.ADMIN_SECRET;
    if (!adminKey || req.headers['x-admin-secret'] !== adminKey)
      return res.status(403).json({ error: 'Unauthorized' });
    const user = USERS[key];
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.balance = parseFloat(req.body.balance) || 0;
    global._sapanel_users = USERS;
    return res.status(200).json({ success: true, balance: user.balance });
  }

  // ── ADMIN: all users ──
  if (action === 'users') {
    const adminKey = process.env.ADMIN_SECRET;
    if (!adminKey || req.headers['x-admin-secret'] !== adminKey)
      return res.status(403).json({ error: 'Unauthorized' });
    const list = Object.values(USERS).map(({ password: _, ...u }) => u);
    return res.status(200).json({ users: list });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
