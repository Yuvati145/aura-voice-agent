// Local / Render / Railway server. On Vercel, /public and /api are used directly instead.
const http = require('http'), fs = require('fs'), path = require('path');
try { for (const l of fs.readFileSync('.env', 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}
const { handleChat, handleSummary } = require('./lib/agent');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const ROUTES = { '/api/chat': handleChat, '/api/summary': handleSummary };

http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  if (ROUTES[url]) {
    if (req.method !== 'POST') { res.writeHead(405); return res.end(); }
    let raw = ''; for await (const c of req) { raw += c; if (raw.length > 1e6) return res.writeHead(413).end(); }
    try { const out = await ROUTES[url](JSON.parse(raw || '{}')); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(out)); }
    catch (e) { res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: e.message })); }
    return;
  }
  const file = path.join(__dirname, 'public', url === '/' ? 'index.html' : path.normalize(url).replace(/^(\.\.[/\\])+/, ''));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(data);
  });
}).listen(process.env.PORT || 3000, () => console.log(`Aria running on http://localhost:${process.env.PORT || 3000}`));
