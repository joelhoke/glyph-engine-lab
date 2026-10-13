export type Comic = { name: string; publisher: string; url: string; cover: string | null }
export type ComicSnapshot = { username: string; releaseDate: string; fetchedAt: string | null; comics: Comic[] }
export const COMICS_USERNAME: string
export const COMICS_KEY: string
export const MAX_SNAPSHOT_BYTES: number
export function upcomingWednesday(now?: Date): string
export function isComicSnapshot(value: unknown): value is ComicSnapshot
export function normalizeComics(pulls: unknown): Comic[]
export function comicCoverUrl(cover: string | null): string | null
