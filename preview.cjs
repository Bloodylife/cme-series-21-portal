// Local static preview only. This never simulates a voting database.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = __dirname;
const publicFiles = new Set(['index.html','styles.css','app.js','config.js']);
http.createServer((request,response) => {
  const file = new URL(request.url,'http://127.0.0.1').pathname.slice(1) || 'index.html';
  if (!publicFiles.has(file)) { response.writeHead(404); response.end('Not found'); return; }
  response.setHeader('Cache-Control','no-store');
  response.setHeader('Content-Type',file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8');
  fs.createReadStream(path.join(root,file)).pipe(response);
}).listen(4173,'127.0.0.1',() => console.log('Open http://127.0.0.1:4173 — press Ctrl+C to stop.'));
