// api/funds.js — QR Payment: Submit + Admin Verify
let USERS    = global._sapanel_users    || (global._sapanel_users    = {});
let REQUESTS = global._sapanel_requests || (global._sapanel_requests = []);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const body = req.body || {};
  const { action } = body;

  // ── USER: Submit payment request ──
  if (action === 'submit') {
    const { email, amount, txnId, screenshot } = body;

    if (!email || !amount || !txnId)
      return res.status(400).json({ error: 'Email, amount aur Transaction ID chahiye' });
    if (parseFloat(amount) < 10)
      return res.status(400).json({ error: 'Minimum ₹10 chahiye' });

    USERS = global._sapanel_users || {};
    const user = USERS[email.toLowerCase().trim()];
    if (!user) return res.status(404).json({ error: 'User not found — pehle login karo' });

    // Check duplicate txn ID
    const duplicate = REQUESTS.find(r => r.txnId === txnId.trim());
    if (duplicate) return res.status(400).json({ error: 'Yeh Transaction ID already use ho chuki hai' });

    const request = {
      id         : `REQ_${Date.now()}`,
      email      : email.toLowerCase().trim(),
      name       : user.name,
      amount     : parseFloat(amount),
      txnId      : txnId.trim(),
      screenshot : screenshot || null,
      status     : 'pending',
      submittedAt: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      verifiedAt : null
    };

    REQUESTS.push(request);
    global._sapanel_requests = REQUESTS;

    return res.status(200).json({ success: true, requestId: request.id, message: 'Request submit ho gayi! Admin verify karega — 5-10 minutes mein balance credit hoga.' });
  }

  // ── ADMIN: List all pending requests ──
  if (action === 'list') {
    const adminKey = process.env.ADMIN_SECRET;
    if (!adminKey || req.headers['x-admin-secret'] !== adminKey)
      return res.status(403).json({ error: 'Unauthorized' });
    return res.status(200).json({ requests: [...REQUESTS].reverse() });
  }

  // ── ADMIN: Approve request ──
  if (action === 'approve') {
    const adminKey = process.env.ADMIN_SECRET;
    if (!adminKey || req.headers['x-admin-secret'] !== adminKey)
      return res.status(403).json({ error: 'Unauthorized' });

    const { requestId } = body;
    const request = REQUESTS.find(r => r.id === requestId);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status === 'approved') return res.status(400).json({ error: 'Already approved' });

    USERS = global._sapanel_users || {};
    const user = USERS[request.email];
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.balance   = parseFloat(((user.balance || 0) + request.amount).toFixed(2));
    request.status = 'approved';
    request.verifiedAt = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

    global._sapanel_users    = USERS;
    global._sapanel_requests = REQUESTS;

    return res.status(200).json({ success: true, credited: request.amount, newBalance: user.balance });
  }

  // ── ADMIN: Reject request ──
  if (action === 'reject') {
    const adminKey = process.env.ADMIN_SECRET;
    if (!adminKey || req.headers['x-admin-secret'] !== adminKey)
      return res.status(403).json({ error: 'Unauthorized' });

    const { requestId, reason } = body;
    const request = REQUESTS.find(r => r.id === requestId);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    request.status = 'rejected';
    request.reason = reason || 'Admin ne reject kiya';
    global._sapanel_requests = REQUESTS;

    return res.status(200).json({ success: true });
  }

  // ── USER: Check request status ──
  if (action === 'my_requests') {
    const { email } = body;
    if (!email) return res.status(400).json({ error: 'email required' });
    const userRequests = REQUESTS
      .filter(r => r.email === email.toLowerCase().trim())
      .map(({ screenshot, ...r }) => r) // screenshot mat bhejo
      .reverse();
    return res.status(200).json({ requests: userRequests });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
