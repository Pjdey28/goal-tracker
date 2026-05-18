const axios = require('axios');
const qs = require('querystring');
const pool = require('../db');
const { ensureAzureColumns, normalizeRoleFromGroups, decodeGuestEmail } = require('./azureSync');

const tenant = process.env.AZURE_TENANT_ID || 'common';
const clientId = process.env.AZURE_CLIENT_ID;
const clientSecret = process.env.AZURE_CLIENT_SECRET;

async function getAppToken() {
  const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const res = await axios.post(
    tokenUrl,
    qs.stringify({
      client_id: clientId,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
      client_secret: clientSecret,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.data.access_token;
}

async function fetchAllUsers(accessToken) {
  const users = [];
  let url = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName&$top=999';
  while (url) {
    const res = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    users.push(...(res.data.value || []));
    url = res.data['@odata.nextLink'] || null;
  }
  return users;
}

async function fetchManager(accessToken, userId) {
  try {
    const res = await axios.get(`https://graph.microsoft.com/v1.0/users/${userId}/manager?$select=id,displayName,mail,userPrincipalName`, { headers: { Authorization: `Bearer ${accessToken}` } });
    return res.data;
  } catch (err) {
    return null;
  }
}

async function fetchGroupIds(accessToken, userId) {
  try {
    const res = await axios.get(`https://graph.microsoft.com/v1.0/users/${userId}/memberOf?$select=id`, { headers: { Authorization: `Bearer ${accessToken}` } });
    return (res.data.value || []).map((g) => g.id).filter(Boolean);
  } catch (err) {
    return [];
  }
}

async function upsertAzureUserRow({ azureId, email, displayName, upn, managerEmail, groupIds, role }) {
  await ensureAzureColumns();
  // resolve manager id if exists
  let managerId = null;
  if (managerEmail) {
    const m = await pool.query('SELECT id FROM users WHERE email=$1 LIMIT 1', [managerEmail]);
    if (m.rows.length) managerId = m.rows[0].id;
  }

  const existing = await pool.query('SELECT * FROM users WHERE azure_oid=$1 OR email=$2 LIMIT 1', [azureId, email]);
  if (existing.rows.length === 0) {
    const insert = await pool.query(
      `INSERT INTO users (email, role, azure_oid, azure_upn, azure_groups, manager_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [email, role, azureId, upn || email, JSON.stringify(groupIds || []), managerId]
    );
    return { created: true, user: insert.rows[0] };
  }

  const cur = existing.rows[0];
  const upd = await pool.query(
    `UPDATE users SET email=COALESCE($2,email), role=$3, azure_oid=COALESCE($4,azure_oid), azure_upn=COALESCE($5,azure_upn), azure_groups=$6, manager_id=COALESCE($7,manager_id) WHERE id=$1 RETURNING *`,
    [cur.id, email, role, azureId, upn || email, JSON.stringify(groupIds || []), managerId]
  );
  return { created: false, user: upd.rows[0] };
}

function resolveSyncEmail(user) {
  return user.mail || decodeGuestEmail(user.userPrincipalName) || user.userPrincipalName;
}

async function runFullSync() {
  const accessToken = await getAppToken();
  const users = await fetchAllUsers(accessToken);
  const stats = { total: users.length, created: 0, updated: 0, errors: 0 };

  // Phase 1: upsert all users without manager links (ensure every user row exists)
  const concurrency = 6;
  let idx = 0;
  async function upsertWorker() {
    while (idx < users.length) {
      const i = idx++;
      const u = users[i];
      try {
        const groupIds = await fetchGroupIds(accessToken, u.id);
        const role = normalizeRoleFromGroups(groupIds || []);
        const res = await upsertAzureUserRow({ azureId: u.id, email: resolveSyncEmail(u), displayName: u.displayName, upn: u.userPrincipalName, groupIds, role });
        if (res.created) stats.created += 1; else stats.updated += 1;
      } catch (err) {
        stats.errors += 1;
        console.error('sync upsert error', u.id, err?.message || err);
      }
    }
  }

  const upsertWorkers = Array.from({ length: concurrency }, () => upsertWorker());
  await Promise.all(upsertWorkers);

  // Phase 2: resolve managers now that all users exist - update manager_id for each user
  idx = 0;
  async function managerWorker() {
    while (idx < users.length) {
      const i = idx++;
      const u = users[i];
      try {
        const manager = await fetchManager(accessToken, u.id);
        const managerEmail = manager?.mail || manager?.userPrincipalName || null;
        if (managerEmail) {
          // find manager user row
          const m = await pool.query('SELECT id FROM users WHERE email=$1 LIMIT 1', [managerEmail]);
          if (m.rows.length) {
            await pool.query('UPDATE users SET manager_id=$1 WHERE azure_oid=$2 OR email=$3', [m.rows[0].id, u.id, resolveSyncEmail(u)]);
          }
        }
      } catch (err) {
        stats.errors += 1;
        console.error('manager resolution error', u.id, err?.message || err);
      }
    }
  }

  const managerWorkers = Array.from({ length: concurrency }, () => managerWorker());
  await Promise.all(managerWorkers);

  return stats;
}

module.exports = { runFullSync };
