/**
 * Minimal ambient types for Cloudflare Pages Functions (Stage 4b).
 *
 * `@cloudflare/workers-types` is intentionally NOT a dependency — these
 * declarations cover exactly the surface the protected API uses. If the
 * project later adopts the official types, delete this file.
 */

interface R2HTTPMetadata {
  contentType?: string
}

interface R2Object {
  key: string
  size: number
  httpMetadata?: R2HTTPMetadata
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream
}

interface R2Range {
  offset?: number
  length?: number
  suffix?: number
}

interface R2GetOptions {
  range?: R2Range
}

interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata
}

interface R2Bucket {
  head(key: string): Promise<R2Object | null>
  get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null>
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: R2PutOptions): Promise<R2Object>
  delete(keys: string | string[]): Promise<void>
}

type PagesEventContext<Env, Params extends string = string> = {
  request: Request
  env: Env
  params: Record<Params, string>
  next: () => Promise<Response>
  waitUntil(promise: Promise<unknown>): void
}

type PagesFunction<Env = unknown, Params extends string = string> = (
  context: PagesEventContext<Env, Params>,
) => Response | Promise<Response>

// --- D1 (feedback storage) ---------------------------------------------------
// Minimal surface used by functions/api/feedback — extend as needed.

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  run(): Promise<unknown>
  first<T = unknown>(column?: string): Promise<T | null>
  all<T = unknown>(): Promise<{ results: T[] }>
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
}
