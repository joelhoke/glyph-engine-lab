import assert from 'node:assert/strict'
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { preparePhysicalCover, isPortraitCover, downloadArtwork, coverRevision } from './lib/physical-cover.mjs'
import { matchAppleMovie } from './lib/apple-cover.mjs'
import { xboxCoverCandidates } from './xbox/client.mjs'
import { storeCoverCandidates } from './lib/xbox-cover.mjs'
const portrait=await sharp({create:{width:600,height:900,channels:3,background:'#d83142'}}).png().toBuffer()
const result=await sharp(await preparePhysicalCover(portrait)).metadata()
assert.equal(result.width,420); assert.equal(result.height,630); assert.equal(result.format,'webp')
assert.equal(isPortraitCover({width:420,height:236}),false)
assert.equal(isPortraitCover({width:500,height:500}),false)
await assert.rejects(preparePhysicalCover(await sharp({create:{width:640,height:360,channels:3,background:'blue'}}).png().toBuffer()),/Portrait/)
await assert.rejects(downloadArtwork('https://evil.test/a',host=>host.endsWith('.mzstatic.com')),/Unapproved/)
const movie={kind:'feature-movie',trackName:'The Secret Garden',releaseDate:'1993-01-01'}
assert.equal(matchAppleMovie([movie,{...movie,releaseDate:'2020-01-01'}],{title:'The Secret Garden (1993)',note:'1993'}).length,1)
assert.equal(matchAppleMovie([movie],{title:'A different movie',note:'1993'}).length,0)
assert.deepEqual(xboxCoverCandidates({displayImage:'https://store-images.s-microsoft.com/tile',images:[{type:'Screenshot',url:'https://store-images.s-microsoft.com/screen'},{type:'BoxArt',url:'https://store-images.s-microsoft.com/cover'},{type:'Poster',url:'https://store-images.s-microsoft.com/poster'}]}),['https://store-images.s-microsoft.com/poster','https://store-images.s-microsoft.com/cover','https://store-images.s-microsoft.com/tile'])
const product={ProductId:'ABC',AlternateIds:[{IdType:'XboxTitleId',Value:'123'}],LocalizedProperties:[{Images:[
  {ImagePurpose:'Poster',Width:1440,Height:2160,Uri:'//store-images.s-microsoft.com/poster'},
  {ImagePurpose:'Poster',Width:1080,Height:1080,Uri:'//store-images.s-microsoft.com/tile'},
  {ImagePurpose:'Poster',Width:1440,Height:2160,Uri:'//evil.test/poster'},
]}]}
assert.deepEqual(storeCoverCandidates({Products:[product]},'123'),[{productId:'ABC',artwork:'https://store-images.s-microsoft.com/poster'}])
assert.deepEqual(storeCoverCandidates({Products:[product]},'456'),[],'Never substitute a different Xbox title')
for(const provider of ['apple-tv','xbox']) {
  const picks=JSON.parse(await readFile(new URL(`../content/${provider}-collection.json`,import.meta.url),'utf8'))
  for(const pick of picks){
    assert.ok(pick.image)
    const url=new URL(`../public${pick.image.src}`,import.meta.url)
    const bytes=await readFile(url.pathname),info=await sharp(bytes).metadata()
    assert.equal(info.width,420);assert.equal(info.height,630)
    assert.equal(url.searchParams.get('v'),coverRevision(bytes),'Image URLs invalidate stale thumbnails')
  }
}
console.log('Physical covers passed: portrait validation, movie matching, exact Xbox IDs, candidate priority, all 24 generated assets and cache revisions.')
