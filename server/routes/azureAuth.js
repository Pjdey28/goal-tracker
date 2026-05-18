const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const qs = require('querystring');
const pool = require('../db');
const { exchangeCodeForToken, fetchGraphProfile, upsertUserFromAzure, resolveEmail } = require('../utils/azureSync');

const router = express.Router();

const tenant = process.env.AZURE_TENANT_ID || 'common';
const clientId = process.env.AZURE_CLIENT_ID;
const clientSecret = process.env.AZURE_CLIENT_SECRET;
const redirectUri = process.env.AZURE_REDIRECT_URI;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5177';

router.get('/login', (req, res) => {
  const authUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: 'openid profile email offline_access',
  });
  res.redirect(`${authUrl}?${params.toString()}`);
});

router.get('/callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send('Missing code');

    const tokenData = await exchangeCodeForToken(code);
    const decoded = jwt.decode(tokenData.id_token);
    const email = resolveEmail({ decoded });

    let graphProfile = null;
    let manager = null;
    let groupIds = [];

    if (tokenData.access_token) {
      const graphData = await fetchGraphProfile(tokenData.access_token);
      graphProfile = graphData.profile;
      manager = graphData.manager;
      groupIds = graphData.groupIds;
    }

    const user = await upsertUserFromAzure({
      oid: decoded?.oid || decoded?.sub || email,
      email,
      profile: graphProfile || decoded,
      manager,
      groupIds,
    });

    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET || 'secretkey', { expiresIn: '8h' });

    // redirect back to client with token
    res.redirect(`${CLIENT_URL}/?token=${token}`);
  } catch (err) {
    console.error('Azure callback error', err?.response?.data || err.message || err);
    res.status(500).send('Authentication failed');
  }
});

module.exports = router;
