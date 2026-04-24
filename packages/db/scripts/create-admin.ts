import bcrypt from 'bcrypt';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { newId } from '../src/lib/uuid';
import * as schema from '../src/schema/index';

const url = process.env.DATABASE_URL;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!url || !email || !password) {
  console.error('Required: DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD');
  process.exit(1);
}

if (password.length < 8) {
  console.error('ADMIN_PASSWORD must be at least 8 characters');
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });
const db = drizzle(sql, { schema, casing: 'snake_case' });

try {
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(schema.users)
    .values({
      id: newId(),
      email,
      passwordHash,
      role: 'admin',
    })
    .onConflictDoNothing()
    .returning({ id: schema.users.id, email: schema.users.email });

  if (user) {
    console.log(`Admin user created: ${user.email} (id: ${user.id})`);
  } else {
    console.log(`User ${email} already exists, skipped.`);
  }
} catch (err) {
  console.error('Failed to create admin user:', err);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
