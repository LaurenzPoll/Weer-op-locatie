// Een statische server zoals GitHub Pages: max-age=600 en een ETag, met 304
// als er niets veranderd is. Hij serveert een kopie van de site, zodat een test
// een "nieuwe versie" kan neerzetten zonder de echte bestanden aan te raken.

import http from 'node:http';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
};

export async function startServer() {
  const wortel = new URL('../../', import.meta.url).pathname;
  const map = await mkdtemp(join(tmpdir(), 'weer-'));
  await cp(wortel, map, { recursive: true, filter: (bron) => !/\/(\.git|node_modules)(\/|$)/.test(bron) });

  const vertraging = new Map();
  let uit = false;
  const server = http.createServer(async (req, res) => {
    const pad = new URL(req.url, 'http://x').pathname;
    // Uit: de verbinding valt weg, zoals zonder netwerk.
    if (uit) return req.socket.destroy();
    const wacht = vertraging.get(pad);
    if (wacht) await new Promise((klaar) => setTimeout(klaar, wacht));
    try {
      const bestand = pad.endsWith('/') ? `${pad}index.html` : pad;
      const inhoud = await readFile(join(map, bestand));
      const etag = `"${createHash('sha1').update(inhoud).digest('hex').slice(0, 16)}"`;
      res.setHeader('Cache-Control', 'max-age=600');
      res.setHeader('ETag', etag);
      if (req.headers['if-none-match'] === etag) {
        res.statusCode = 304;
        return res.end();
      }
      res.setHeader('Content-Type', TYPES[extname(bestand)] ?? 'application/octet-stream');
      res.end(inhoud);
    } catch {
      res.statusCode = 404;
      res.end('niet gevonden');
    }
  });
  await new Promise((klaar) => server.listen(0, '127.0.0.1', klaar));

  const origineel = new Map();
  return {
    url: `http://localhost:${server.address().port}/`,
    vertraag: (pad, ms) => (ms ? vertraging.set(pad, ms) : vertraging.delete(pad)),
    zetUit: (aan) => {
      uit = aan;
    },
    async wijzig(pad, bewerk) {
      const bestand = join(map, pad);
      const nu = await readFile(bestand, 'utf8');
      if (!origineel.has(pad)) origineel.set(pad, nu);
      await writeFile(bestand, bewerk(nu));
    },
    async herstel() {
      for (const [pad, inhoud] of origineel) await writeFile(join(map, pad), inhoud);
      origineel.clear();
    },
    async stop() {
      server.closeAllConnections();
      await new Promise((klaar) => server.close(klaar));
      await rm(map, { recursive: true, force: true });
    }
  };
}
