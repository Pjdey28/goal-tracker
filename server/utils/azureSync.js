const axios = require('axios');
const qs = require('querystring');
const pool = require('../db');

const tenant = process.env.AZURE_TENANT_ID || 'common';
const clientId = process.env.AZURE_CLIENT_ID;
const clientSecret = process.env.AZURE_CLIENT_SECRET;
const redirectUri = process.env.AZURE_REDIRECT_URI;

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function decodeGuestEmail(preferredUsername) {
  if (!preferredUsername || !String(preferredUsername).includes('#EXT#')) return null;

  const localPart = String(preferredUsername).split('#EXT#')[0];
  if (!localPart) return null;

  // Azure guest UPNs often encode the external email address by replacing '@' with '_'
  return localPart.replace(/_/g, '@');
}

function resolveEmail({ profile, decoded }) {
  const profileMail = profile?.mail || profile?.userPrincipalName || null;
  const decodedMail = decodeGuestEmail(decoded?.preferred_username || decoded?.upn || decoded?.email);
  return profileMail || decodedMail || decoded?.preferred_username || decoded?.email || null;
}

function normalizeRoleFromGroups(groupIds) {
  const adminGroupIds = parseCsv(process.env.AZURE_ADMIN_GROUP_IDS);
  const managerGroupIds = parseCsv(process.env.AZURE_MANAGER_GROUP_IDS);

  if (groupIds.some((groupId) => adminGroupIds.includes(groupId))) {
    return 'admin';
  }

  if (groupIds.some((groupId) => managerGroupIds.includes(groupId))) {
    return 'manager';
  }

  return 'employee';
}

async function ensureAzureColumns() {
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS azure_oid TEXT,
      ADD COLUMN IF NOT EXISTS azure_upn TEXT,
      ADD COLUMN IF NOT EXISTS azure_groups JSONB,
      ADD COLUMN IF NOT EXISTS manager_id INTEGER
  `);
}

async function exchangeCodeForToken(code) {
  const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const tokenRes = await axios.post(
    tokenUrl,
    qs.stringify({
      client_id: clientId,
      scope: 'openid profile email offline_access User.Read User.Read.All GroupMember.Read.All',
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      client_secret: clientSecret,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return tokenRes.data;
}

async function getGraphTokenFromRefreshToken(refreshToken) {
  const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const tokenRes = await axios.post(
    tokenUrl,
    qs.stringify({
      client_id: clientId,
      scope: 'openid profile email offline_access User.Read User.Read.All GroupMember.Read.All',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      client_secret: clientSecret,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return tokenRes.data;
}

async function fetchGraphProfile(accessToken) {
  const [profileRes, managerRes, memberOfRes] = await Promise.allSettled([
    axios.get('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    axios.get('https://graph.microsoft.com/v1.0/me/manager?$select=id,displayName,mail,userPrincipalName', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    axios.get('https://graph.microsoft.com/v1.0/me/memberOf?$select=id,displayName', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);

  const profile = profileRes.status === 'fulfilled' ? profileRes.value.data : null;
  const manager = managerRes.status === 'fulfilled' ? managerRes.value.data : null;
  const groupIds =
    memberOfRes.status === 'fulfilled'
      ? (memberOfRes.value.data.value || []).map((entry) => entry.id).filter(Boolean)
      : [];

  return { profile, manager, groupIds };
}

async function upsertUserFromAzure({ oid, email, profile, manager, groupIds }) {
  await ensureAzureColumns();

  const role = normalizeRoleFromGroups(groupIds);
  const displayEmail = email || profile?.mail || profile?.userPrincipalName;
  const managerEmail = manager?.mail || manager?.userPrincipalName || null;

  let managerId = null;
  if (managerEmail) {
    const managerLookup = await pool.query('SELECT id FROM users WHERE email=$1 LIMIT 1', [managerEmail]);
    if (managerLookup.rows.length > 0) {
      managerId = managerLookup.rows[0].id;
    }
  }

  const existing = await pool.query('SELECT * FROM users WHERE azure_oid=$1 OR email=$2 LIMIT 1', [oid, displayEmail]);

  if (existing.rows.length === 0) {
    const insert = await pool.query(
      `INSERT INTO users (email, role, azure_oid, azure_upn, azure_groups, manager_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [displayEmail, role, oid, profile?.userPrincipalName || displayEmail, JSON.stringify(groupIds), managerId]
    );
    return insert.rows[0];
  }

  const current = existing.rows[0];
  const update = await pool.query(
    `UPDATE users
     SET email = COALESCE($2, email),
         role = $3,
         azure_oid = COALESCE($4, azure_oid),
         azure_upn = COALESCE($5, azure_upn),
         azure_groups = $6,
         manager_id = COALESCE($7, manager_id)
     WHERE id = $1
     RETURNING *`,
    [current.id, displayEmail, role, oid, profile?.userPrincipalName || displayEmail, JSON.stringify(groupIds), managerId]
  );
  return update.rows[0];
}

module.exports = {
  ensureAzureColumns,
  exchangeCodeForToken,
  getGraphTokenFromRefreshToken,
  fetchGraphProfile,
  upsertUserFromAzure,
  normalizeRoleFromGroups,
  decodeGuestEmail,
  resolveEmail,
};
