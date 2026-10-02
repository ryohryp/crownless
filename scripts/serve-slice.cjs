// Small dependency-free, loopback-only server. Only playable-slice files are served.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const isAllowed = name => !name.includes('..') && (
  ['index.html','expedition.html'].includes(name) ||
  (name.endsWith('.css') && !name.includes('/')) ||
  (name.startsWith('src/') && name.endsWith('.js') && name.indexOf('/', 4) === -1) ||
  (name.startsWith('assets/') && name.endsWith('.svg') && name.indexOf('/', 7) === -1)
);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const server = http.createServer((req,res) => {
  const name = new URL(req.url,'http://localhost').pathname.slice(1) || 'index.html';
  if (!['GET','HEAD'].includes(req.method) || !isAllowed(name)) { res.writeHead(404); res.end('Not found'); return; }
  fs.readFile(path.join(__dirname,'..',name),(error,data) => {
    if(error) {res.writeHead(500);res.end('Unable to read game file');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(name)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});
server.on('error',error => { console.error(`Cannot start Crownless: ${error.message}`); process.exitCode=1; });
server.listen(Number(process.env.PORT || 4173),'127.0.0.1',() => console.log(`Crownless playable slice: http://localhost:${server.address().port}`));
