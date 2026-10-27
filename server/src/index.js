import { config } from './config.js';
import { createApp } from './app.js';
import { disconnectDatabase } from './db.js';
import { closeSessionStore } from './lib/session.js';

const app = createApp();

const server = app.listen(config.port, '127.0.0.1', () => {
  console.log(`PeaceOne API listening on 127.0.0.1:${config.port}`);
});

async function shutdown(signal) {
  console.log(`Received ${signal}, shutting down`);
  server.close(async () => {
    await Promise.all([disconnectDatabase(), closeSessionStore()]);
    process.exit(0);
  });
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
