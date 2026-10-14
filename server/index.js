// Global Temple Directory server: serves the static front-end and a small JSON API backed by Postgres.
// Config via environment only: DATABASE_URL, PORT, BASE_URL, MAIL_API_KEY, MAIL_FROM, ADMIN_EMAILS, DEV_LINKS, NODE_ENV.
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import compress from '@fastify/compress';
import staticFiles from '@fastify/static';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';
import temples from './routes/temples.js';
import community from './routes/community.js';
import auth from './routes/auth.js';
import edits from './routes/edits.js';
import exportRoutes from './routes/export.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = Fastify({ logger: process.env.LOG === '1', trustProxy: true, bodyLimit: 64 * 1024 });

await app.register(cookie);
await app.register(compress, { global: true, threshold: 1024 });

app.addHook('onRequest', async (req, reply) => {
  // Never serve source, config, dependencies or tooling as static files.
  if (/^\/(server|db|node_modules|tools|\.env|package(-lock)?\.json|Dockerfile|render\.yaml)/.test(req.url)) return reply.code(404).send('Not found');
  reply.header('X-Content-Type-Options', 'nosniff').header('X-Frame-Options', 'DENY');
  // CSRF guard: write requests must be JSON, which a cross-site form cannot send without a CORS preflight.
  if (req.method === 'POST' && req.url.startsWith('/api/') && !(req.headers['content-type'] || '').startsWith('application/json') && Number(req.headers['content-length'] || 0) > 0)
    return reply.code(415).send({ error: 'Send application/json.' });
});

await app.register(temples); await app.register(community); await app.register(auth); await app.register(edits); await app.register(exportRoutes);

// Static site. no-cache = always revalidate (ETag), so edits show after a normal reload and the 35 MB dataset is only re-sent when it changed.
await app.register(staticFiles, {
  root,
  setHeaders: (res, path) => {
    if (/(node_modules|\/server\/|\/db\/|package(-lock)?\.json|\.env|\/tools\/)/.test(path)) return;
    res.setHeader('Cache-Control', 'no-cache');
  },
});
app.setNotFoundHandler((req, reply) => reply.code(404).send(req.url.startsWith('/api/') ? { error: 'Not found.' } : 'Not found'));
app.setErrorHandler((err, req, reply) => {
  if (err.validation || err.statusCode < 500) return reply.code(err.statusCode || 400).send({ error: err.message });
  req.log.error(err);
  reply.code(500).send({ error: 'Something went wrong on our side. Try again.' });
});

const port = Number(process.env.PORT || 8080);
await app.listen({ port, host: '0.0.0.0' });
console.log(`Global Temple Directory on http://localhost:${port}`);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await app.close(); await pool.end(); process.exit(0); });
