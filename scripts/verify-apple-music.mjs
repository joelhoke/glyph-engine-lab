import assert from 'node:assert/strict'
import { generateKeyPairSync, verify } from 'node:crypto'
import { musicDeveloperToken, musicPicks, recentlyAddedMusic, completeMusicArtwork } from './lib/apple-music.mjs'
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const token = musicDeveloperToken({ teamId: 'ABCDEFGHIJ', keyId: '0123456789', privateKey: privateKey.export({type:'pkcs8',format:'pem'}), now: 1000 })
const [header, payload, signature] = token.split('.')
assert.deepEqual(JSON.parse(Buffer.from(header,'base64url')), {alg:'ES256',kid:'0123456789'})
assert.equal(JSON.parse(Buffer.from(payload,'base64url')).exp,4600)
assert.ok(verify('sha256',Buffer.from(`${header}.${payload}`),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')))
const resource = { id:'private-library-id', type:'library-albums', attributes:{name:'Album',artistName:'Artist',url:'https://music.apple.com/us/album/example/1',lastPlayed:'private',artwork:{url:'https://is1-ssl.mzstatic.com/art/{w}x{h}.{f}'}} }
const picks=musicPicks([resource,{...resource,id:'2'},{id:'3',type:'library-albums',attributes:{name:'Other',artistName:'Artist',url:'javascript:alert(1)',artwork:{url:'https://untrusted.test/art.jpg'}}}])
assert.equal(picks.length,2,'Deduplicate albums in addition order')
assert.ok(!picks[0].id.includes(resource.id),'Do not publish personal library identifiers')
assert.deepEqual(musicPicks([{...resource,type:'library-playlists'},{...resource,type:'library-songs'}]),[],'Only albums belong in the collection')
assert.deepEqual(Object.keys(picks[0]).sort(),['id','image','note','source','title','url'])
assert.equal(picks[0].image.src,'https://is1-ssl.mzstatic.com/art/600x600.jpg')
assert.equal(picks[1].url,undefined);assert.equal(picks[1].image,undefined)
await recentlyAddedMusic('developer','user',async (url,options)=>{
  assert.equal(new URL(url).href,'https://api.music.apple.com/v1/me/library/recently-added')
  assert.equal(options.headers['Music-User-Token'],'user')
  return {ok:true,json:async()=>({data:[resource]})}
})
await assert.rejects(recentlyAddedMusic('developer','user',async()=>({ok:false,status:401})),/401/)
await assert.rejects(recentlyAddedMusic('developer','user',async()=>({ok:true,json:async()=>({data:[]})})),/preserved/)
console.log('Apple Music: ES256 signature, short-lived token, public allowlist, artwork safety, recency deduplication and failure handling passed.')

let pageCount=0
const paged=await recentlyAddedMusic('developer','user',async url=>{
  pageCount++
  return {ok:true,json:async()=>pageCount===1 ? {data:[{...resource,type:'library-playlists'}],next:'/v1/me/library/recently-added?offset=10'} : {data:[resource]}}
})
assert.equal(pageCount,2);assert.equal(paged.length,1,'Skip playlists and follow pagination')
let sent=0
await assert.rejects(recentlyAddedMusic('developer','user',async()=>{sent++;return {ok:true,json:async()=>({data:[],next:'https://untrusted.test/steal'})}}),/pagination/)
assert.equal(sent,1,'Never send authorization to a pagination host supplied by the response')
const enriched=await completeMusicArtwork([{...picks[0],image:undefined,url:undefined}], 'developer',async (url,options)=>{
  assert.equal(options.headers['Music-User-Token'],undefined,'Catalog artwork lookup needs no account token')
  return {ok:true,json:async()=>({results:{albums:{data:[{attributes:{...resource.attributes,name:'Wrong album'}},resource]}}})}
})
assert.equal(enriched[0].image.src,picks[0].image.src)
assert.equal(enriched[0].url,picks[0].url)
console.log('Recently added albums: type filtering, pagination, private ID exclusion and exact artwork matching passed.')
