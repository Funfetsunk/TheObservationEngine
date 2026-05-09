import path from 'path';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: path.join(__dirname, '../../.env') });

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import Redis from 'ioredis';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT ?? '3000', 10);
const wsPort = port + 1; // separate port avoids conflict with Next.js HMR upgrade handler
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

const REDIS_CHANNELS = ['wixbury:tick', 'wixbury:event', 'wixbury:edition'] as const;

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? '/', true);
    handle(req, res, parsedUrl);
  });

  // Standalone WS server on wsPort — not attached to Next.js HTTP server
  const wss = new WebSocketServer({ port: wsPort });

  const subscriber = new Redis(redisUrl, { lazyConnect: false, maxRetriesPerRequest: null });

  subscriber.on('error', (err: Error) => {
    console.error(JSON.stringify({ event: 'redis_subscriber_error', error: err.message }));
  });

  subscriber.subscribe(...REDIS_CHANNELS, (err, count) => {
    if (err) {
      console.error(JSON.stringify({ event: 'redis_subscribe_failed', error: err.message }));
      return;
    }
    console.log(JSON.stringify({ event: 'redis_subscribed', channels: count }));
  });

  subscriber.on('message', (_channel: string, message: string) => {
    if (wss.clients.size === 0) return;
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'connected', message: 'Wixbury live feed — WebSocket active.' }));
    ws.on('error', (err: Error) => {
      console.error(JSON.stringify({ event: 'ws_client_error', error: err.message }));
    });
  });

  server.listen(port, () => {
    console.log(JSON.stringify({ event: 'server_ready', url: `http://localhost:${port}`, ws: `ws://localhost:${wsPort}` }));
  });

  function shutdown(): void {
    subscriber.disconnect();
    wss.close();
    server.close(() => process.exit(0));
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
});
