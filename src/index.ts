import { createApp } from './app';
import { env } from './config/env';
import { pool } from './config/database';

async function waitForDatabase(): Promise<void> {
  const attempts = 6;
  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      last = err;
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`Postgres not ready (try ${i}/${attempts}): ${reason}`);
      await new Promise((resolve) => setTimeout(resolve, 1500 * i));
    }
  }
  throw last;
}

async function main(): Promise<void> {
  await waitForDatabase();
  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`Cutie Baby API listening on :${env.PORT}`);
    console.log(`Swagger UI → http://localhost:${env.PORT}/api/docs`);
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
