const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_DIR = path.join(DATA_DIR, 'db');
const ASSETS_DIR = path.join(DATA_DIR, 'assets');
const SEED_DIR = process.env.SEED_DIR || path.join(__dirname, 'seed');
const COLLECTIONS = new Set(['sessions', 'settings', 'body', 'nutrition', 'notes', 'photos']);
const clients = new Set();
let writeChain = Promise.resolve();

function json(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store'});
  response.end(body);
}

function validId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_.-]+$/.test(value);
}

function docPath(parts) {
  if (parts.length !== 2 || !COLLECTIONS.has(parts[0]) || !validId(parts[1])) return null;
  return path.join(DB_DIR, parts[0], parts[1] + '.json');
}

async function readBody(request, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error('Payload too large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function allDocs() {
  const result = {};
  for (const collection of COLLECTIONS) {
    const directory = path.join(DB_DIR, collection);
    let names;
    try { names = await fs.readdir(directory); } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      const id = name.slice(0, -5);
      if (!validId(id)) continue;
      result[`${collection}/${id}`] = JSON.parse(await fs.readFile(path.join(directory, name), 'utf8'));
    }
  }
  return result;
}

function broadcast() {
  for (const response of clients) response.write('event: change\ndata: {}\n\n');
}

function mutate(operation) {
  const result = writeChain.then(operation);
  writeChain = result.catch(() => {});
  return result;
}

async function serveAsset(request, response, id) {
  if (!validId(id)) return json(response, 404, {error: 'Not found'});
  try {
    const body = await fs.readFile(path.join(ASSETS_DIR, id));
    response.writeHead(200, {'Content-Type': 'image/jpeg', 'Content-Length': body.length, 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff'});
    if (request.method === 'HEAD') response.end(); else response.end(body);
  } catch (error) {
    if (error.code === 'ENOENT') return json(response, 404, {error: 'Not found'});
    throw error;
  }
}

const files = {
  '/': ['gym.html', 'text/html; charset=utf-8'],
  '/gym.html': ['gym.html', 'text/html; charset=utf-8'],
  '/web-adapter.js': ['web-adapter.js', 'text/javascript; charset=utf-8'],
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const pathname = url.pathname;

    if (pathname === '/healthz') return json(response, 200, {ok: true});

    if (pathname === '/api/events') {
      response.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no'});
      response.write(': connected\n\n');
      clients.add(response);
      const keepalive = setInterval(() => response.write(': keepalive\n\n'), 25000);
      request.on('close', () => { clearInterval(keepalive); clients.delete(response); });
      return;
    }

    if (pathname === '/api/state' && request.method === 'GET') return json(response, 200, await allDocs());

    if (pathname.startsWith('/api/doc/')) {
      const parts = pathname.slice('/api/doc/'.length).split('/').map(decodeURIComponent);
      const filename = docPath(parts);
      if (!filename) return json(response, 400, {error: 'Invalid document path'});
      if (request.method === 'PUT') {
        const body = await readBody(request, 4 * 1024 * 1024);
        const value = JSON.parse(body.toString('utf8'));
        if (!value || Array.isArray(value) || typeof value !== 'object') return json(response, 400, {error: 'Document must be an object'});
        await mutate(async () => {
          await fs.mkdir(path.dirname(filename), {recursive: true});
          const temporary = filename + '.' + crypto.randomUUID() + '.tmp';
          await fs.writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
          await fs.rename(temporary, filename);
        });
        broadcast();
        return json(response, 200, {ok: true});
      }
      if (request.method === 'DELETE') {
        await mutate(async () => {
          try { await fs.unlink(filename); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        });
        broadcast();
        response.writeHead(204, {'Cache-Control': 'no-store'});
        return response.end();
      }
    }

    if (pathname === '/api/assets' && request.method === 'POST') {
      const type = String(request.headers['content-type'] || '').split(';')[0];
      if (type !== 'image/jpeg') return json(response, 415, {error: 'Only JPEG is supported'});
      const body = await readBody(request, 16 * 1024 * 1024);
      const id = crypto.randomUUID();
      await fs.mkdir(ASSETS_DIR, {recursive: true});
      await fs.writeFile(path.join(ASSETS_DIR, id), body, {flag: 'wx'});
      return json(response, 201, {id});
    }

    if (pathname.startsWith('/api/assets/') && request.method === 'DELETE') {
      const id = decodeURIComponent(pathname.slice('/api/assets/'.length));
      if (!validId(id)) return json(response, 400, {error: 'Invalid asset'});
      try { await fs.unlink(path.join(ASSETS_DIR, id)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      response.writeHead(204);
      return response.end();
    }

    if (pathname.startsWith('/_blob/') && (request.method === 'GET' || request.method === 'HEAD')) {
      return serveAsset(request, response, decodeURIComponent(pathname.slice('/_blob/'.length)));
    }

    const file = files[pathname];
    if (file && (request.method === 'GET' || request.method === 'HEAD')) {
      const body = await fs.readFile(path.join(__dirname, file[0]));
      response.writeHead(200, {
        'Content-Type': file[1],
        'Content-Length': body.length,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow',
      });
      if (request.method === 'HEAD') response.end(); else response.end(body);
      return;
    }

    json(response, 404, {error: 'Not found'});
  } catch (error) {
    const status = error.status || (error instanceof SyntaxError ? 400 : 500);
    if (!response.headersSent) json(response, status, {error: status === 500 ? 'Internal server error' : error.message});
    else response.end();
    if (status === 500) console.error(error);
  }
});

async function start() {
  await fs.mkdir(DB_DIR, {recursive: true});
  await fs.mkdir(ASSETS_DIR, {recursive: true});
  const collections = await fs.readdir(DB_DIR);
  if (!collections.some(name => COLLECTIONS.has(name))) {
    try { await fs.cp(SEED_DIR, DB_DIR, {recursive: true}); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  server.listen(PORT, '0.0.0.0', () => console.log(`Fitness app listening on ${PORT}`));
}

function shutdown() {
  for (const response of clients) response.end();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
start().catch(error => { console.error(error); process.exit(1); });
