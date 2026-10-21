import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import dotenv from 'dotenv';

dotenv.config();

export type DatabaseProvider = 'mysql' | 'postgresql';

export function detectTargetProvider(): DatabaseProvider {
  const explicit = process.env.DB_PROVIDER?.trim().toLowerCase();
  if (explicit === 'postgres' || explicit === 'postgresql' || explicit === 'pg') {
    return 'postgresql';
  }
  if (explicit === 'mysql' || explicit === 'mariadb') {
    return 'mysql';
  }

  const url = (process.env.DATABASE_URL || '').trim().toLowerCase();
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return 'postgresql';
  }

  return 'mysql';
}

export function syncDatabaseSchema(options: { silent?: boolean; forceGenerate?: boolean } = {}): {
  provider: DatabaseProvider;
  updated: boolean;
} {
  const provider = detectTargetProvider();
  const rootDir = path.resolve(__dirname, '..');
  const schemaDir = path.join(rootDir, 'prisma');

  const sourceFile = provider === 'postgresql'
    ? path.join(schemaDir, 'schema.postgresql.prisma')
    : path.join(schemaDir, 'schema.mysql.prisma');

  const activeFile = path.join(schemaDir, 'schema.prisma');

  if (!fs.existsSync(sourceFile)) {
    throw new Error(`Target template schema does not exist: ${sourceFile}`);
  }

  const sourceContent = fs.readFileSync(sourceFile, 'utf8');
  const activeContent = fs.existsSync(activeFile) ? fs.readFileSync(activeFile, 'utf8') : '';

  let updated = false;

  if (sourceContent !== activeContent || options.forceGenerate) {
    fs.writeFileSync(activeFile, sourceContent, 'utf8');
    if (!options.silent) {
      console.log(`[Database Sync] Switched active Prisma schema to ${provider.toUpperCase()}`);
      console.log(`[Database Sync] Regenerating Prisma Client for ${provider.toUpperCase()}...`);
    }

    try {
      execSync('npx prisma generate', {
        cwd: rootDir,
        stdio: options.silent ? 'ignore' : 'inherit',
        env: { ...process.env },
      });
      updated = true;
    } catch (err) {
      console.error(`[Database Sync] Failed to generate Prisma client:`, err);
      throw err;
    }
  } else {
    if (!options.silent) {
      console.log(`[Database Sync] Active Prisma schema already matches ${provider.toUpperCase()}`);
    }
  }

  return { provider, updated };
}

// Execute directly if run as a script
if (require.main === module || process.argv[1]?.endsWith('sync-database-schema.ts')) {
  try {
    const isForce = process.argv.includes('--force');
    syncDatabaseSchema({ forceGenerate: isForce });
  } catch (err) {
    console.error('[Database Sync Error]:', err);
    process.exit(1);
  }
}
