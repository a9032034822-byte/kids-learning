// Cloudflare Worker: хранилище прогресса «Лесной школы».
// Хранит только зашифрованные семейным ключом блоки (сам ничего прочитать не может).
// Привязка KV: переменная KIDS. Необязательно: ALLOWED_ORIGIN — адрес сайта для CORS.
//
// API:
//   GET  /v1/slot/<имя>   → зашифрованный блок или {"empty": true}
//   PUT  /v1/slot/<имя>   ← зашифрованный блок {v, iv, ct}
// Заголовок X-Family-Key: 64 hex-символа (выводится из семейного пароля в приложении).
// Данные разных семей (разных ключей) не пересекаются: ключ KV = sha256(X-Family-Key):<имя>.

const MAX_BODY = 1_000_000;

async function sha256hex(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Family-Key',
      'Access-Control-Max-Age': '86400',
      'Cache-Control': 'no-store',
    };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(env.KIDS ? 'kids-learning sync: ok' : 'kids-learning sync: KV KIDS не привязан', { headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    const m = url.pathname.match(/^\/v1\/slot\/([a-z0-9-]{1,40})$/);
    if (!m) return json({ error: 'not-found' }, 404);
    if (!env.KIDS) return json({ error: 'kv-not-bound' }, 500);
    const key = request.headers.get('X-Family-Key') || '';
    if (!/^[0-9a-f]{64}$/.test(key)) return json({ error: 'bad-key' }, 401);
    const kvKey = (await sha256hex(key)) + ':' + m[1];

    if (request.method === 'GET') {
      const v = await env.KIDS.get(kvKey);
      if (v === null) return json({ empty: true });
      return new Response(v, { headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    if (request.method === 'PUT') {
      const body = await request.text();
      if (body.length > MAX_BODY) return json({ error: 'too-large' }, 413);
      let env0;
      try {
        env0 = JSON.parse(body);
      } catch {
        return json({ error: 'bad-json' }, 400);
      }
      if (!env0 || env0.v !== 1 || typeof env0.iv !== 'string' || typeof env0.ct !== 'string') return json({ error: 'not-encrypted' }, 400);
      await env.KIDS.put(kvKey, body);
      return json({ ok: true });
    }
    return json({ error: 'method' }, 405);
  },
};
