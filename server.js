const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DIR = __dirname;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.toml': 'text/plain'
};

const server = http.createServer((req, res) => {
  let file = path.join(DIR, req.url === '/' ? '/lte-app/index.html' : req.url);
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('Not Found'); }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
  res.end(fs.readFileSync(file));
});

server.listen(PORT, () => console.log(`⚡ Servidor rodando: http://localhost:${PORT}`));