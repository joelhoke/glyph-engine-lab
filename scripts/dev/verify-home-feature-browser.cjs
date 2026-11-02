// Run against `npm run dev`; the temporary route is always removed afterwards.
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { chromium } = require('playwright-core')
const sharp = require('sharp')
const root = path.resolve(__dirname, '../..')
const fixture = path.join(root, 'app/home-feature-qa')
const artifacts = path.join(root, 'tmp-verify-home-feature')
const url = process.argv[2] || 'http://localhost:3000'
const video = page => page.locator('.home-highlights article:not([hidden]) video')
const isPlaying = async page => {
 try {
  await page.waitForFunction(() => { const v=document.querySelector('.home-highlights article:not([hidden]) video'); return v && !v.paused && v.currentTime>0 })
 } catch (error) {
  console.error('Playback timeout state:',await video(page).evaluate(v=>({paused:v.paused,time:v.currentTime,ready:v.readyState,error:v.error?.message,src:v.currentSrc,hidden:document.hidden,bounds:v.getBoundingClientRect().toJSON()})))
  throw error
 }
}
const isPaused = page => page.waitForFunction(() => document.querySelector('.home-highlights article:not([hidden]) video')?.paused)
const pause = page => page.locator('.home-highlight-controls button').filter({visible:true}).click()
async function center(page,selector) {
 await page.evaluate(()=>document.fonts.ready)
 await page.locator(selector).evaluate(el=>{
  // The site's initial font-settle scroll restoration yields to visitor input.
  window.dispatchEvent(new WheelEvent('wheel'))
  window.scrollTo(0,window.scrollY+el.getBoundingClientRect().top-100)
 })
}
async function main(){
 await fs.mkdir(fixture,{recursive:true});await fs.mkdir(artifacts,{recursive:true})
 await fs.copyFile(path.join(__dirname,'fixtures/home-feature-qa.page.txt'),path.join(fixture,'page.tsx'))
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
 const errors=[]
 const watch=page=>{page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|VALIDATE|GL_INVALID/i.test(m.text()))errors.push(m.text())})}
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'dark'});watch(page)
  const requests=[];page.on('request',r=>{if(/october-2026-.*mp4/.test(r.url()))requests.push(r.url())})
  await page.goto(url+'/home-feature-qa');await page.waitForFunction(()=>window.flowerQA)
  for(const [name,p]of [['plumeria',0],['rose-in',.49],['rose-out',.51],['daisy',1],['midpoint',.275]]){
   const data=await page.evaluate(p=>{window.flowerQA.render(p,0);return document.querySelector('#raw-flower canvas').toDataURL()},p)
   const buffer=Buffer.from(data.split(',')[1],'base64')
   await sharp(buffer).resize(720,720).png().toFile(path.join(artifacts,name+'.png'))
   if(name==='plumeria'&&process.argv.includes('--update-poster'))await sharp(buffer).resize(720,720).webp({quality:90,alphaQuality:100}).toFile(path.join(root,'public/assets/home/flower/plumeria.webp'))
  }
  assert.equal(await page.locator('body').getAttribute('data-shader-error'),null)
  const a=await sharp(path.join(artifacts,'rose-in.png')).raw().toBuffer(),b=await sharp(path.join(artifacts,'rose-out.png')).raw().toBuffer()
  const mean=a.reduce((sum,value,index)=>sum+Math.abs(value-b[index]),0)/a.length
  assert(mean<1,`Rose handoff pixel difference: ${mean}`)
  await center(page,'.home-highlights');await isPlaying(page)
  assert(requests.length>0);assert(requests.every(r=>r.includes('landscape')),'only landscape should load on desktop')
  await video(page).evaluate(v=>v.currentTime=21)
  await pause(page);await isPaused(page)
  await page.locator('#gate').click();await page.locator('#gate').click();await isPaused(page)
  await page.setViewportSize({width:390,height:844})
  await page.waitForFunction(()=>document.querySelector('.home-highlights article:not([hidden]) video')?.currentSrc.includes('portrait'))
  await page.waitForFunction(()=>document.querySelector('.home-highlights article:not([hidden]) video')?.readyState>=2)
  assert(Math.abs(await video(page).evaluate(v=>v.currentTime)-21)<1,'paused orientation switch keeps timestamp')
  await isPaused(page)
  await page.locator('.home-highlight-controls button:visible').click();await isPlaying(page)
  await page.setViewportSize({width:1440,height:1000});await center(page,'.home-highlights');await isPlaying(page)
  assert(Math.abs(await video(page).evaluate(v=>v.currentTime)-21)<4,'playing orientation switch keeps timestamp')
  await page.locator('#gate').click();await isPaused(page);await page.locator('#gate').click();await isPlaying(page)
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});await isPaused(page)
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))});await isPlaying(page)
  await page.evaluate(()=>scrollTo(0,0));await isPaused(page);await center(page,'.home-highlights');await isPlaying(page)
  await page.getByRole('button',{name:'Next highlight',exact:true}).click()
  assert.equal(await page.locator('.home-highlights article:not([hidden]) h2').textContent(),'Image test')
  assert(await page.locator('.home-highlights article').first().locator('video').evaluate(v=>v.paused),'inactive video is paused')
  await page.locator('.home-highlights').focus();await page.keyboard.press('ArrowRight');await isPlaying(page)
  await page.keyboard.press('Home');await isPlaying(page)
  await page.locator('.home-highlight-frame:visible').evaluate(target=>{
   target.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[new Touch({identifier:0,target,clientX:300,clientY:400})]}))
   target.dispatchEvent(new TouchEvent('touchend',{bubbles:true,changedTouches:[new Touch({identifier:0,target,clientX:100,clientY:410})]}))
  })
  assert.equal(await page.locator('.home-highlights article:not([hidden]) h2').textContent(),'Image test')
  console.log('PASS: video/image carousel, buttons, indicators, keyboard, swipe, inactive pause, autoplay, manual intent, source/orientation and visibility gates')
  await page.close()

  for(const colorScheme of ['dark','light'])for(const width of [1440,390]){
   const p=await browser.newPage({viewport:{width,height:width===390?844:1000},colorScheme});watch(p)
   const fetched=[];p.on('request',r=>{if(/october-2026-.*mp4/.test(r.url()))fetched.push(r.url())})
   await p.goto(url);await center(p,'.home-statement-scene');await p.waitForSelector('[data-flower-ready="true"]')
   await p.screenshot({path:path.join(artifacts,`statement-${colorScheme}-${width}.png`)})
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow')
   await center(p,'.home-highlights');await isPlaying(p)
   const frame=await p.locator('.home-highlight-frame').boundingBox()
   assert(Math.abs(frame.width/frame.height-(width<768?9/16:16/9))<.001)
   assert(fetched.length>0&&fetched.every(r=>r.includes(width<768?'portrait':'landscape')),'only selected responsive video requested')
   assert.equal(await p.locator('.home-highlight-navigation').count(),0)
   await p.locator('.site-header-menu-button').click();await isPaused(p)
   await p.keyboard.press('Escape');await isPlaying(p)
   await p.screenshot({path:path.join(artifacts,`recap-${colorScheme}-${width}.png`)})
   await p.close()
  }
  console.log('PASS: desktop/phone, both themes, gutters/aspect ratios, no overflow, single-entry navigation hidden, real menu gate')
  const reduced=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});watch(reduced)
  await reduced.goto(url);await center(reduced,'.home-statement-scene');await reduced.waitForTimeout(500)
  assert.equal(await reduced.locator('.home-flower-renderer canvas').count(),0)
  assert.equal(await reduced.locator('.home-flower-poster').evaluate(img=>getComputedStyle(img).opacity),'1')
  assert(await reduced.locator('.home-flower-poster').evaluate(img=>img.complete&&img.naturalWidth>0))
  await center(reduced,'.home-highlights');await isPaused(reduced)
  await reduced.getByRole('button',{name:'Play October, by design.',exact:true}).first().click();await isPlaying(reduced)
  await reduced.emulateMedia({reducedMotion:'no-preference'})
  await reduced.waitForSelector('.home-flower-renderer canvas',{state:'attached'})
  await reduced.emulateMedia({reducedMotion:'reduce'});await isPaused(reduced)
  assert.equal(await reduced.locator('.home-flower-renderer canvas').count(),0,'reduced motion releases the WebGL renderer')
  assert.equal(await reduced.locator('.home-highlight-poster').count(),1,'changing to reduced motion restores the poster')
  await reduced.getByRole('button',{name:'Play October, by design.',exact:true}).first().click();await isPlaying(reduced)
  await reduced.close()
  const blocked=await browser.newPage({viewport:{width:1440,height:1000}});watch(blocked)
  await blocked.addInitScript(()=>{const play=HTMLMediaElement.prototype.play;let reject=true;HTMLMediaElement.prototype.play=function(){if(this.closest('.home-highlights')&&reject){reject=false;return Promise.reject(new DOMException('Test rejection','NotAllowedError'))}return play.call(this)}})
  await blocked.goto(url);await center(blocked,'.home-highlights');await blocked.waitForTimeout(700);await isPaused(blocked)
  assert.equal(await blocked.locator('.home-highlight-poster').count(),1)
  await blocked.getByRole('button',{name:'Play October, by design.',exact:true}).first().click();await isPlaying(blocked);await blocked.close()
  const fallback=await browser.newPage({viewport:{width:390,height:844}})
  await fallback.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:get.call(this,type,...args)}})
  await fallback.goto(url);await center(fallback,'.home-statement-scene');await fallback.waitForTimeout(1000)
  assert.equal(await fallback.locator('.home-flower-renderer canvas').count(),0)
  assert.equal(await fallback.locator('.home-flower-poster').evaluate(img=>getComputedStyle(img).opacity),'1')
  await fallback.screenshot({path:path.join(artifacts,'webgl-fallback.png')});await fallback.close()
  console.log('PASS: reduced motion poster/manual play, autoplay rejection/manual retry, unavailable WebGL poster; shader compiled on installed Three.js')
  assert.deepEqual(errors,[])
 } finally {
  await browser.close()
  await fs.rm(fixture,{recursive:true,force:true})
  await fs.rm(path.join(root,'.next/dev/types/app/home-feature-qa'),{recursive:true,force:true})
 }
}
main().catch(e=>{console.error(e);process.exitCode=1})
