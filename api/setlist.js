// One shared document: the whole setlist as JSON, stored in Redis (Upstash via Vercel Marketplace).
// GET  /api/setlist           -> { data: <setlist> | null }
// PUT  /api/setlist           -> body: <setlist>; header x-edit-code when EDIT_CODE is set.
//                                200 saved · 401 bad code · 409 a newer version exists (returns it) · 503 storage not set up
const KEY = 'diwali-setlist:main';

function store() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return async (command) => {
    const r = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(command),
    });
    if (!r.ok) throw new Error(`redis ${r.status}`);
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j.result;
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body !== undefined) return resolve(req.body);
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 2_000_000) reject(new Error('too large')); });
    req.on('end', () => resolve(s));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-type', 'application/json; charset=utf-8');
  const redis = store();
  if (!redis) return res.status(503).end(JSON.stringify({ error: 'Storage not set up: add Upstash Redis to this Vercel project.' }));

  try {
    if (req.method === 'GET') {
      const raw = await redis(['GET', KEY]);
      return res.status(200).end(JSON.stringify({ data: raw ? JSON.parse(raw) : null }));
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const code = process.env.EDIT_CODE;
      if (code && (req.headers['x-edit-code'] || '') !== code) return res.status(401).end(JSON.stringify({ error: 'Edit code required.' }));

      let body = await readBody(req);
      if (typeof body === 'string') body = JSON.parse(body || 'null');
      if (!body || typeof body !== 'object' || !Array.isArray(body.items)) return res.status(400).end(JSON.stringify({ error: 'Not a setlist.' }));
      body.updatedAt = Number(body.updatedAt) || Date.now();

      const raw = await redis(['GET', KEY]);
      const current = raw ? JSON.parse(raw) : null;
      if (current && (Number(current.updatedAt) || 0) > body.updatedAt) return res.status(409).end(JSON.stringify({ data: current }));

      await redis(['SET', KEY, JSON.stringify(body)]);
      return res.status(200).end(JSON.stringify({ ok: true, updatedAt: body.updatedAt }));
    }

    res.setHeader('allow', 'GET, PUT');
    return res.status(405).end(JSON.stringify({ error: 'Method not allowed.' }));
  } catch (e) {
    return res.status(500).end(JSON.stringify({ error: String((e && e.message) || e) }));
  }
};
