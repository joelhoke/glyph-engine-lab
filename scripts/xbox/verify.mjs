import assert from 'node:assert/strict'
import { recentXboxGames, selectRecentGames, safeArtwork } from './client.mjs'
const title = (id, date, extra = {}) => ({ titleId: id, name: `Game ${id}`, type: 'Game', displayImage: 'https://store-images.s-microsoft.com/image/test', titleHistory: { lastTimePlayed: date, visible: true }, ...extra })
const history = { xuid: 'PRIVATE', titles: [title('1','2026-01-01'),title('2','2026-02-01'),title('3','2026-03-01',{type:'App'}),title('4','2026-04-01',{titleHistory:{visible:false,lastTimePlayed:'2026-04-01'}}),title('2','2026-01-01'),title('5','invalid')] }
assert.deepEqual(selectRecentGames(history).map(item=>item.id),['xbox-2','xbox-1'])
assert.ok(!JSON.stringify(selectRecentGames(history)).includes('PRIVATE'))
assert.ok(!JSON.stringify(selectRecentGames(history)).includes('lastTimePlayed'))
for (const url of ['http://store-images.s-microsoft.com/a','https://localhost/a','https://store-images.s-microsoft.com.evil.test/a','https://name:password@store-images.s-microsoft.com/a']) assert.equal(safeArtwork(url),null)
const clientId = '00000000-0000-0000-0000-000000000001'
async function run({ denial, mismatch, forbidden } = {}) {
  let ticks=0, poll=0; const requests=[], notifications=[]
  const fetcher=async(url,options)=> {
    requests.push({url,options}); let body, status=200
    if(url.endsWith('/devicecode')) body={device_code:'PRIVATE_DEVICE',user_code:'PUBLIC-CODE',verification_uri:'https://www.microsoft.com/link',expires_in:900,interval:5}
    else if(url.endsWith('/token')) {
      poll++
      if(denial) {status=400;body={error:'authorization_declined',error_description:'SECRET'}}
      else if(poll<3){status=400;body={error:poll===1?'authorization_pending':'slow_down'}}
      else body={access_token:'PRIVATE_ACCESS'}
    } else if(url.includes('/user/authenticate')) body={Token:'PRIVATE_USER'}
    else if(url.includes('/xsts/authorize')) body={Token:'PRIVATE_XSTS',DisplayClaims:{xui:[{uhs:'PRIVATE_HASH',xid:'12345'}]}}
    else if(url.includes('profile.xboxlive')) body={profileUsers:[{settings:[{id:'Gamertag',value:mismatch?'another-account':'insanesamurai92'}]}]}
    else if(url.includes('titlehub.xboxlive')) {body=history;if(forbidden){status=403;body={token:'SECRET'}}}
    else throw new Error('Unexpected request')
    return {ok:status===200,status,json:async()=>body}
  }
  const result=recentXboxGames({clientId,expectedGamertag:'insanesamurai92',fetcher,now:()=>ticks,sleep:async ms=>{ticks+=ms},notify:message=>notifications.push(message)})
  if(denial || mismatch || forbidden) {
    await assert.rejects(result,error=>!error.message.includes('SECRET'))
    if(mismatch) assert.ok(!requests.some(request=>request.url.includes('titlehub')))
  } else {
    assert.deepEqual((await result).map(item=>item.id),['xbox-2','xbox-1'])
    assert.equal(ticks,20000,'Pending and slow_down respect polling interval')
    assert.equal(requests[0].options.body.get('scope'),'XboxLive.signin','No offline access')
    assert.ok(!JSON.stringify(notifications).includes('PRIVATE_'))
    assert.ok(requests.every(request=>request.options.redirect==='error'))
  }
}
await run(); await run({denial:true}); await run({mismatch:true}); await run({forbidden:true})
await assert.rejects(recentXboxGames({clientId:'',expectedGamertag:'test'}),/MICROSOFT_CLIENT_ID/)
console.log('Xbox offline checks passed: pending/slowdown, denial, wrong account, service refusal, hidden/app filtering, privacy allowlist and image hosts. These offline checks do not revalidate live service access.')
