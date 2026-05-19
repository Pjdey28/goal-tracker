const express = require('express');
// use global fetch (Node 18+)
const fetch = global.fetch || (async () => { throw new Error('global fetch not available') })();
const crypto = require('crypto');

// simple base64url helpers
function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString();
}

// simple HS256 sign
function signHS256(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

process.env.JWT_SECRET = process.env.JWT_SECRET || 'secretkey';

async function run() {
  const app = express();
  app.use(express.json());

  // Inline auth middleware equivalent
  app.use((req, res, next) => {
    if (req.path === '/api/auth/me') return next();
    next();
  });

  app.get('/api/auth/me', (req, res) => {
    try {
      let token = req.header('Authorization') || '';
      if (token.startsWith('Bearer ')) token = token.slice(7);
      if (!token) return res.status(401).json({ message: 'No token provided' });

      const parts = token.split('.');
      if (parts.length !== 3) return res.status(401).json({ message: 'Invalid token format' });

      const header = JSON.parse(base64urlDecode(parts[0]));
      const payload = JSON.parse(base64urlDecode(parts[1]));
      const signature = parts[2];

      if (header.alg !== 'HS256') return res.status(400).json({ message: 'Unsupported alg' });

      const verifiedSig = signHS256(parts[0] + '.' + parts[1], process.env.JWT_SECRET);
      if (verifiedSig !== signature) return res.status(401).json({ message: 'Invalid signature' });

      // check exp if present
      if (payload.exp && Date.now() > payload.exp * 1000) return res.status(401).json({ message: 'Token expired' });

      res.json({ user: payload });
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: String(err) });
    }
  });

  const server = app.listen(5050, async () => {
    console.log('Test server listening on http://localhost:5050');

    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = { id: 19, role: 'manager', email: 'manager@goaltrack123.onmicrosoft.com', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 8 * 3600 };

    const token = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}.${signHS256(base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(payload)), process.env.JWT_SECRET)}`;

    try {
      const resp = await fetch('http://localhost:5050/api/auth/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      const body = await resp.json().catch(() => null);
      console.log('Response status:', resp.status);
      console.log('Response body:', body);
    } catch (err) {
      console.error('Request failed', err);
    } finally {
      server.close();
    }
  });
}

run();
