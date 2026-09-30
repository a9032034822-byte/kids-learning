// Локальный сервер синхронизации для проверки: тот же код воркера, KV — в памяти.
//   node tools/dev-sync-server.mjs [порт]   → http://localhost:8787
import http from 'node:http';
import worker from '../worker/sync-worker.js';

const port = +(process.argv[2] || 8787);
const mem = new Map();
const env = { KIDS: { get: async (k) => (mem.has(k) ? mem.get(k) : null), put: async (k, v) => void mem.set(k, v) } };

http
  .createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const r = await worker.fetch(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : body }), env);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
  })
  .listen(port, () => console.log(`sync dev server: http://localhost:${port}`));
