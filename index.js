const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = __dirname;
const host = process.env.HOST || '127.0.0.1';
const requestedPort = Number(process.env.PORT || 5173);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp',
};

function getFilePath(requestUrl) {
  const url = new URL(requestUrl, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  const normalized = path.normalize(pathname === '/' ? '/index.html' : pathname);
  const filePath = path.join(root, normalized);
  const relativePath = path.relative(root, filePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  return filePath;
}

const server = http.createServer((request, response) => {
  const filePath = getFilePath(request.url);

  if (!filePath) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500, {
        'Content-Type': 'text/plain; charset=utf-8',
      });
      response.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    });
    response.end(content);
  });
});

function listen(port, attemptsLeft = 20) {
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && attemptsLeft > 0) {
      listen(port + 1, attemptsLeft - 1);
      return;
    }

    throw error;
  });

  server.listen(port, host, () => {
    const address = server.address();
    console.log(`Wedding invitation is running at http://${host}:${address.port}`);
  });
}

listen(requestedPort);
