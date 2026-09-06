// Servidor local minimo (sem dependencias) para o montador de times.
// Serve os arquivos de public/ e guarda os times como .txt em times/.
//
// Uso: node server.js   ->   http://localhost:5173

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 5173;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const TEAMS_DIR = path.join(ROOT, 'times');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

fs.mkdirSync(TEAMS_DIR, { recursive: true });

// Nome de arquivo seguro: sem separadores de caminho, sem "..", sem controle.
function safeName(raw) {
  const name = String(raw || '')
    .normalize('NFC')
    .replace(/\.txt$/i, '')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  if (!name || name === '.' || name === '..') return null;
  return name;
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) {
        reject(new Error('corpo grande demais'));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function listTeams() {
  return fs
    .readdirSync(TEAMS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.txt'))
    .map((f) => {
      const stat = fs.statSync(path.join(TEAMS_DIR, f));
      return {
        name: f.replace(/\.txt$/i, ''),
        savedAt: stat.mtime.toISOString(),
        size: stat.size,
      };
    })
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api','teams', name?]
  const name = parts[2] ? safeName(decodeURIComponent(parts[2])) : null;

  if (parts[1] !== 'teams') return sendJson(res, 404, { error: 'rota desconhecida' });

  if (req.method === 'GET' && !name) {
    return sendJson(res, 200, { teams: listTeams() });
  }

  if (req.method === 'GET' && name) {
    const file = path.join(TEAMS_DIR, name + '.txt');
    if (!fs.existsSync(file)) return sendJson(res, 404, { error: 'time nao encontrado' });
    return sendJson(res, 200, { name, content: fs.readFileSync(file, 'utf8') });
  }

  if (req.method === 'POST' && !name) {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: 'JSON invalido' });
    }
    const teamName = safeName(payload.name);
    if (!teamName) return sendJson(res, 400, { error: 'nome de time invalido' });
    if (typeof payload.content !== 'string' || !payload.content.trim()) {
      return sendJson(res, 400, { error: 'conteudo vazio' });
    }
    const file = path.join(TEAMS_DIR, teamName + '.txt');
    fs.writeFileSync(file, payload.content, 'utf8');
    return sendJson(res, 200, { ok: true, name: teamName, file: path.relative(ROOT, file) });
  }

  if (req.method === 'DELETE' && name) {
    const file = path.join(TEAMS_DIR, name + '.txt');
    if (!fs.existsSync(file)) return sendJson(res, 404, { error: 'time nao encontrado' });
    fs.unlinkSync(file);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { error: 'metodo nao permitido' });
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.join(PUBLIC_DIR, rel);
  // impede sair de public/
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('403');
    return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 - nao encontrado');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((err) => sendJson(res, 500, { error: String(err.message || err) }));
    return;
  }
  serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log('');
  console.log('  Montador de Time Pokemon (Cobbleverse)');
  console.log('  -> http://localhost:' + PORT);
  console.log('  Times salvos em: ' + TEAMS_DIR);
  console.log('  (Ctrl+C para parar)');
  console.log('');
});
