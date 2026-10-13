// Exercise real React collection piles, comics states, and the shared privacy tabs without a browser/GPU.
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript')
const React = require('react'), { act } = React
const { createRoot } = require('react-dom/client')
const { JSDOM } = require('jsdom')
const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test/about', pretendToBeVisual: true })
for (const name of ['window','document','HTMLElement','Element','Node','Event','MouseEvent','KeyboardEvent']) global[name] = dom.window[name]
global.IS_REACT_ACT_ENVIRONMENT = true
const compile = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, file)
require.extensions['.ts'] = require.extensions['.tsx'] = compile
require.extensions['.css'] = module => { module.exports = new Proxy({}, { get: (_, key) => key === '__esModule' ? false : key }) }
const errors=[]; const originalError=console.error
console.error=(...args)=> { errors.push(args.join(' ')); originalError(...args) }
async function main() {
  const CreativeMedia = require('../components/about/CreativeMedia.tsx').default
  const AnalyticsConsent = require('../components/AnalyticsConsent.tsx').default
  const { WATCHING_PICKS, GAMING_PICKS, LISTENING_PICKS } = require('../content/creativeMedia.ts')
  const root=createRoot(document.getElementById('root'))
  let data={snapshot:{username:'TestReader',releaseDate:'2026-10-14',fetchedAt:null,comics:[{name:'Test book',publisher:'Test publisher',url:'https://example.test/book',cover:'https://s3.amazonaws.com/comicgeeks/comics/covers/large-1234567.jpg'}]},state:'saved',upcoming:false}
  const render=async()=>act(async()=>root.render(React.createElement(CreativeMedia,{comics:data})))
  const selected=()=>document.querySelector('[role="tab"][aria-selected="true"]')
  const panel=()=>document.querySelector('[role="tabpanel"]:not([hidden])')
  const key=async value=>act(async()=>selected().dispatchEvent(new KeyboardEvent('keydown',{key:value,bubbles:true})))
  const assertTabs=()=> {
    assert.equal(document.querySelectorAll('[role="tab"][tabindex="0"]').length,1)
    assert.equal(document.querySelectorAll('[role="tabpanel"]:not([hidden])').length,1)
    assert.equal(selected().getAttribute('aria-controls'),panel().id)
    assert.equal(panel().getAttribute('aria-labelledby'),selected().id)
  }
  try {
    const pile=kind=>document.querySelector(`[data-media-pile="${kind}"]`)
    const track=()=>document.querySelector('ul[tabindex="0"]')
    const choice=label=>[...document.querySelectorAll('[aria-pressed]')].find(button=>button.textContent===label)
    const click=async element=>act(async()=>element.click())
    const press=async value=>act(async()=>track().dispatchEvent(new KeyboardEvent('keydown',{key:value,bubbles:true})))
    await render()
    assert.equal(document.querySelectorAll('[data-media-pile]').length,4)
    assert.equal(pile('watching').querySelector('.caseBand'),null,'Movies have no added header strip')
    assert.equal(pile('gaming').querySelector('.caseBand').textContent,'Xbox')
    assert.equal(document.querySelectorAll('[data-desk-object]').length,0,'Collection row has no decorative models')
    const albumCovers=[...pile('listening').querySelectorAll('.pileLayers img')].map(img=>img.getAttribute('src'))
    assert.deepEqual(albumCovers,LISTENING_PICKS.slice(0,3).filter(item=>item.image).map(item=>item.image.src),'Music uses the first three imported covers in the shared pile')
    await click(pile('listening'))
    assert.equal(track().querySelectorAll('article').length,LISTENING_PICKS.length,'Render only imported listening history')
    if (LISTENING_PICKS.length) {
      const cover=LISTENING_PICKS.find(item=>item.image)?.image.src
      if (cover) assert.equal(track().querySelector('img').getAttribute('src'),cover)
      const link=LISTENING_PICKS.find(item=>item.url)?.url
      if (link) assert.equal(track().querySelector('a').href,link)
      assert.ok([...track().querySelectorAll('[data-media-case]')].every(item=>item.dataset.kind==='listening'))
    } else assert.match(track().textContent,/once Apple Music is connected/,'No invented listening history')
    await press('Escape')
    assert.equal(document.querySelector('[role="dialog"]'),null)
    assert.equal(pile('comics').querySelectorAll('img').length,1)
    assert.equal(pile('watching').querySelectorAll('img').length,3)
    const movieSource=pile('watching').querySelector('img').getAttribute('src')
    await click(pile('comics'))
    assert.equal(document.activeElement,track())
    assert.equal(document.querySelector('[popover]'),null,'Collection expands on the page')
    assert.match(document.querySelector('section').textContent,/Saved pull list/)
    assert.match(track().textContent,/Test book/)
    await act(async()=>track().querySelector('img').dispatchEvent(new Event('error')))
    assert.match(track().textContent,/Cover unavailable/)
    await click(choice('Movies'))
    assert.equal(document.querySelectorAll('section').length,1)
    assert.equal(track().querySelectorAll('article').length,WATCHING_PICKS.length)
    assert.equal(track().querySelector('img').getAttribute('src'),movieSource,'Expanded cases reuse the pile cover')
    assert.match(document.querySelector('section').textContent,/Recently added/)
    assert.ok([...track().querySelectorAll('img')].every(image=>image.getAttribute('loading')==='lazy'))
    Object.defineProperty(track(),'clientWidth',{configurable:true,value:600})
    Object.defineProperty(track(),'scrollWidth',{configurable:true,value:3000})
    await press('ArrowRight'); assert.equal(track().scrollLeft,420)
    await press('End'); assert.equal(track().scrollLeft,3000)
    await press('Home'); assert.equal(track().scrollLeft,0)
    await click(choice('Games'))
    assert.match(document.querySelector('section').textContent,/insanesamurai92/)
    assert.equal(track().querySelectorAll('article').length,GAMING_PICKS.length,'Render only imported gaming history')
    await press('Escape')
    assert.equal(track(),null); assert.equal(document.activeElement,pile('gaming'))
    await click(pile('comics'))
    await click([...document.querySelectorAll('button')].find(button=>button.textContent.includes('All collections')))
    assert.equal(track(),null); assert.equal(document.activeElement,pile('comics'))
    await click(pile('comics'))
    data={...data,state:'unavailable',snapshot:{...data.snapshot,comics:[]}}
    await render(); assert.match(document.querySelector('section').textContent,/latest list is unavailable/); assert.match(track().textContent,/quiet week/)
    data={...data,state:'fresh',upcoming:true,snapshot:{...data.snapshot,fetchedAt:new Date().toISOString()}}
    await render(); assert.match(document.querySelector('section').textContent,/Upcoming Wednesday/)
    // Same TabList now powers the existing privacy UI; opening/focus/Escape stay intact.
    await act(async()=>root.render(React.createElement(AnalyticsConsent,{onClient:()=>{}})))
    await act(async()=>document.querySelector('.privacy-settings-button').click())
    assert.equal(selected().textContent,'Privacy'); assert.equal(document.activeElement,selected())
    await key('ArrowRight'); assert.equal(selected().textContent,'Feedback'); assert.equal(document.activeElement,selected())
    await key('End'); assert.equal(selected().textContent,'Credits')
    await key('Escape'); assert.equal(document.querySelector('[role="dialog"]'),null)
    assert.equal(document.activeElement,document.querySelector('.privacy-settings-button'))
    // Public snapshot is an allowlist, not an exported account/library database.
    assert.equal(new Set(WATCHING_PICKS.map(item=>item.id)).size,WATCHING_PICKS.length)
    for (const item of WATCHING_PICKS) {
      assert.deepEqual(Object.keys(item).sort(),['id','image','note','source','title','url'])
      assert.equal(item.image.width,420); assert.equal(item.image.height,630)
      assert.ok(fs.existsSync(path.join(__dirname,'../public',item.image.src.split('?')[0])))
    }
    assert.deepEqual(errors,[])
  } finally { await act(async()=>root.unmount()); console.error=originalError; dom.window.close() }
  console.log('Creative Media: physical piles, inline expansion, shared covers, horizontal keyboard navigation, Escape/focus, collection switching, movie snapshot, comics failure/empty/fresh states and shared privacy navigation passed.')
}
main().catch(error=>{console.error=originalError;console.error(error);process.exitCode=1})
