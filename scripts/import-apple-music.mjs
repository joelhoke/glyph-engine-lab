/** Local, owner-only MusicKit authorization. Never ship this server or .p8 key.
 * node --env-file=.env.music.local scripts/import-apple-music.mjs
 * Visits Apple's documented recently added library endpoint; publishes up to 12 albums.
 */
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { readFile, writeFile, rename } from 'node:fs/promises'
import { completeMusicArtwork, musicDeveloperToken, recentlyAddedMusic } from './lib/apple-music.mjs'

const { APPLE_TEAM_ID: teamId, APPLE_MUSIC_KEY_ID: keyId, APPLE_MUSIC_KEY_PATH: keyPath } = process.env
if (!keyPath) throw new Error('Set APPLE_MUSIC_KEY_PATH to the downloaded .p8 file outside this repo. See docs/apple-music-connection.md.')
const developerToken = musicDeveloperToken({ teamId, keyId, privateKey: await readFile(keyPath, 'utf8') })
const nonce = randomBytes(24).toString('hex')
const port = 8811, origin = `http://127.0.0.1:${port}`
const output = new URL('../content/apple-music-collection.json', import.meta.url)
let syncing = false
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Connect recently added albums</title>
<style>body{font:18px system-ui;max-width:36rem;margin:12vh auto;padding:2rem;background:#111b27;color:#f3f5f8}button{font:inherit;padding:1rem;border-radius:.5rem;cursor:pointer}p{line-height:1.6}</style>
<h1>Share my recently added albums</h1><p>This imports up to 12 recently added albums to your local site, including artwork, title and artist. It does not publish your account details or library addition timestamps.</p>
<button id="connect" disabled>Loading Apple Music…</button><p id="status" role="status"></p>
<script>document.addEventListener('musickitloaded',async()=>{const button=document.getElementById('connect'),status=document.getElementById('status');try{await MusicKit.configure({developerToken:${JSON.stringify(developerToken)},app:{name:'Joel Hoke — Music Collection',build:'1.0'}});button.disabled=false;button.textContent='Connect Apple Music & import';button.onclick=async()=>{button.disabled=true;try{const token=await MusicKit.getInstance().authorize();const result=await fetch('/sync',{method:'POST',headers:{'Content-Type':'application/json','X-Setup-Nonce':${JSON.stringify(nonce)}},body:JSON.stringify({token})});const data=await result.json();if(!result.ok)throw new Error(data.error);status.textContent='Imported '+data.count+' albums. You can close this tab.';}catch(error){status.textContent=error.message;button.disabled=false;}}}catch(error){status.textContent=error.message;}});</script>
<script src="https://js-cdn.music.apple.com/musickit/v3/musickit.js" async></script></html>`
const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
  if (request.headers.host !== `127.0.0.1:${port}`) { response.writeHead(403).end(); return }
  if (request.method === 'GET' && request.url === '/') { response.setHeader('Content-Type','text/html; charset=utf-8'); response.end(html); return }
  if (request.method !== 'POST' || request.url !== '/sync') { response.writeHead(404).end(); return }
  response.setHeader('Content-Type','application/json')
  if (request.headers.origin !== origin || request.headers['x-setup-nonce'] !== nonce) { response.writeHead(403).end(JSON.stringify({error:'Open the local setup page first.'})); return }
  if (syncing) { response.writeHead(409).end(JSON.stringify({error:'An import is already running.'})); return }
  syncing = true
  try {
    let body = ''
    for await (const chunk of request) { body += chunk; if (Buffer.byteLength(body) > 32768) throw new Error('Request too large.') }
    const { token } = JSON.parse(body)
    if (typeof token !== 'string') throw new Error('Apple Music authorization is missing.')
    const picks = await completeMusicArtwork(await recentlyAddedMusic(developerToken, token), developerToken)
    const temporary = new URL('../content/.apple-music-import.tmp', import.meta.url)
    await writeFile(temporary, JSON.stringify(picks, null, 2) + '\n')
    await rename(temporary, output)
    response.end(JSON.stringify({count:picks.length}))
    console.log(`Saved ${picks.length} recently added albums. Rebuild the site to update the preview.`)
    clearTimeout(timeout); server.close()
  } catch (error) {
    response.writeHead(400).end(JSON.stringify({error:error instanceof Error ? error.message : 'Import failed.'}))
  } finally { syncing = false }
})
server.requestTimeout = 30000
const timeout = setTimeout(() => { console.log('Setup session expired. Run the importer again to reconnect.'); server.close(); }, 10 * 60 * 1000)
server.listen(port, '127.0.0.1', () => console.log(`Apple Music setup: ${origin} (expires in 10 minutes)`))
