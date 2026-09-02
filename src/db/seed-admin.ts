import { env } from '../config/env';
import { query, pool } from '../config/database';
import { hashPassword } from '../utils';

async function seedAdmin(): Promise<void> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required to seed admin');
  }

  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  const name = env.ADMIN_NAME ?? 'Store Admin';

  await query(
    `INSERT INTO admin_users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'super_admin')
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           name = EXCLUDED.name,
           role = 'super_admin',
           is_active = TRUE,
           updated_at = NOW()`,
    [name, env.ADMIN_EMAIL.toLowerCase(), passwordHash],
  );

  console.log(`Admin ready: ${env.ADMIN_EMAIL}`);
  await pool.end();
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
