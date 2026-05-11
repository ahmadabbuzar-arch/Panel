# SAPanel v2.0 — SMM Panel with Razorpay

## Setup Guide

### Step 1: Vercel Environment Variables

Vercel Dashboard → Your Project → Settings → Environment Variables mein yeh add karo:

| Variable | Value | Description |
|---|---|---|
| `SMMSBI_API_KEY` | `c9d6dd76d62b31749e22dc8fc54b4033` | SMMSBI API key |
| `RAZORPAY_KEY_ID` | `rzp_live_XXXXXXXXXXXXXXXX` | Razorpay live key ID |
| `RAZORPAY_KEY_SECRET` | `XXXXXXXXXXXXXXXXXXXXXXXX` | Razorpay secret key |
| `ADMIN_SECRET` | `koi_bhi_strong_password` | Admin panel password |

### Step 2: Razorpay Account Setup

1. https://razorpay.com pe account banao
2. Dashboard → Settings → API Keys → Generate Key
3. `Key ID` aur `Key Secret` copy karo → Vercel env mein dalo
4. **Live mode** ke liye KYC complete karo

### Step 3: Deploy to Vercel

```bash
# Vercel CLI se
npm i -g vercel
cd sapanel
vercel --prod
```

Ya GitHub se: Vercel dashboard → Import Project → sapanel folder

---

## How It Works

```
User → Amount choose karo → Razorpay Checkout (UPI/Card/NetBanking)
     → Payment verify (server-side signature check)
     → Balance instantly credit
     → Order place karo → SMMSBI API → Order processed
```

## Admin Panel

Login karo admin email se → Admin tab visible hoga

Admin features:
- All users ka balance dekhna
- Razorpay payments history
- All orders dekhna
- Balance manually adjust karna

## File Structure

```
sapanel/
├── api/
│   ├── auth.js        — Register/Login/Balance
│   ├── smmsbi.js      — SMMSBI proxy + Order placement
│   ├── razorpay.js    — Payment create + Verify
│   └── funds.js       — (legacy, not used)
├── public/
│   └── index.html     — Full frontend
├── package.json
└── vercel.json
```

## Important Notes

- Vercel free plan mein **in-memory storage** hai — server restart pe data reset hoga
- Production ke liye **Vercel KV** ya **PlanetScale** database use karo
- SMMSBI balance alag hai — woh aap manually top-up karte ho
- Razorpay se aaya paisa aapke bank account mein jata hai, SMMSBI se orders automatically process hote hain
