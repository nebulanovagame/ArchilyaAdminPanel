const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const DIST_DIR = path.resolve(__dirname, 'dist');

const server = http.createServer((req, res) => {
  let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url);

  // If the request is for a directory or a route without extension, serve index.html
  if (!path.extname(filePath) || !fs.existsSync(filePath)) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`SPA server running at http://localhost:${PORT}`);
});
