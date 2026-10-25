import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { detectTargetProvider } from '../../scripts/sync-database-schema';

describe('Database Provider Detection and Configuration', () => {
  const originalUrl = process.env.DATABASE_URL;
  const originalProvider = process.env.DB_PROVIDER;

  after(() => {
    process.env.DATABASE_URL = originalUrl;
    if (originalProvider !== undefined) {
      process.env.DB_PROVIDER = originalProvider;
    } else {
      delete process.env.DB_PROVIDER;
    }
  });

  it('detects explicit DB_PROVIDER=postgres and DB_PROVIDER=postgresql', () => {
    process.env.DB_PROVIDER = 'postgres';
    assert.strictEqual(detectTargetProvider(), 'postgresql');

    process.env.DB_PROVIDER = 'postgresql';
    assert.strictEqual(detectTargetProvider(), 'postgresql');

    process.env.DB_PROVIDER = 'pg';
    assert.strictEqual(detectTargetProvider(), 'postgresql');
  });

  it('detects explicit DB_PROVIDER=mysql and DB_PROVIDER=mariadb', () => {
    process.env.DB_PROVIDER = 'mysql';
    assert.strictEqual(detectTargetProvider(), 'mysql');

    process.env.DB_PROVIDER = 'mariadb';
    assert.strictEqual(detectTargetProvider(), 'mysql');
  });

  it('infers postgresql from DATABASE_URL protocol when DB_PROVIDER is unset', () => {
    delete process.env.DB_PROVIDER;

    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/job_db?schema=public';
    assert.strictEqual(detectTargetProvider(), 'postgresql');

    process.env.DATABASE_URL = 'postgres://user:pass@cloud.provider.com:5432/job_db';
    assert.strictEqual(detectTargetProvider(), 'postgresql');
  });

  it('infers mysql from DATABASE_URL protocol when DB_PROVIDER is unset', () => {
    delete process.env.DB_PROVIDER;

    process.env.DATABASE_URL = 'mysql://root:gyam@localhost:3306/job';
    assert.strictEqual(detectTargetProvider(), 'mysql');

    process.env.DATABASE_URL = 'mariadb://root:pass@localhost:3306/job';
    assert.strictEqual(detectTargetProvider(), 'mysql');
  });

  it('verifies that schema.postgresql.prisma contains valid postgresql provider and no MySQL-only types', () => {
    const pgSchemaPath = path.resolve(__dirname, '../../prisma/schema.postgresql.prisma');
    assert.ok(fs.existsSync(pgSchemaPath), 'schema.postgresql.prisma must exist');

    const content = fs.readFileSync(pgSchemaPath, 'utf8');
    assert.match(content, /provider\s*=\s*"postgresql"/);
    assert.doesNotMatch(content, /@db\.LongText/, 'PostgreSQL schema must not contain MySQL LongText');
  });

  it('verifies that schema.mysql.prisma contains valid mysql provider', () => {
    const mysqlSchemaPath = path.resolve(__dirname, '../../prisma/schema.mysql.prisma');
    assert.ok(fs.existsSync(mysqlSchemaPath), 'schema.mysql.prisma must exist');

    const content = fs.readFileSync(mysqlSchemaPath, 'utf8');
    assert.match(content, /provider\s*=\s*"mysql"/);
  });
});
