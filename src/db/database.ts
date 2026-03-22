import { mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { createClient, type Client } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import * as schema from './schema'

export type Database = LibSQLDatabase<typeof schema>

/**
 * Ensures the parent directory for a SQLite file URL exists.
 * For remote/in-memory URLs (http, https, libsql, :memory:) this is a no-op.
 */
function ensureDataDir(url: string): void {
  // Only local file paths need directory creation
  const fileMatch = url.match(/^(?:file:)?(.+\.db(?:\?.*)?$)/)
  if (!fileMatch) return

  // Strip query params to get bare path
  const rawPath = fileMatch[1].split('?')[0]
  const dir = dirname(rawPath)

  if (dir && dir !== '.' && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

/**
 * Creates a libSQL client and wraps it with Drizzle ORM.
 *
 * @param url - libSQL connection URL.
 *              Local SQLite:  "file:data/rebalance.db"
 *              In-memory:     ":memory:"
 *              Turso remote:  "libsql://your-db.turso.io"
 * @param authToken - Optional auth token (required for Turso remote URLs).
 * @returns Drizzle database instance with full schema typing.
 */
export function initDatabase(url: string, authToken?: string): Database {
  ensureDataDir(url)

  const clientConfig = authToken ? { url, authToken } : { url }
  const client: Client = createClient(clientConfig)

  return drizzle(client, { schema })
}

/**
 * Convenience singleton — initialised from DATABASE_URL env var.
 * Falls back to a local SQLite file at data/rebalance.db when
 * DATABASE_URL is not set (useful for local development).
 *
 * Import this wherever you need database access:
 *   import { db } from '@db/database'
 */
const databaseUrl = process.env.DATABASE_URL ?? 'file:data/rebalance.db'
const authToken = process.env.DATABASE_AUTH_TOKEN

export const db: Database = initDatabase(databaseUrl, authToken)
