import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const label = {textContent:''};
const link = {dataset:{}, querySelector:()=>label};
const elements = Object.fromEntries(['twitch-status','twitch-title','twitch-detail'].map(id=>[id,{dataset:{},textContent:''}]));
let interval, response = {status:'live',title:'<b>Live</b>',category:'Games',viewers:42};
const handlers = {}, document = {hidden:false,querySelectorAll:()=>[link],getElementById:id=>elements[id],addEventListener:(name,fn)=>handlers[name]=fn};
vm.runInNewContext(readFileSync('src/scripts/twitch-status.js','utf8'), {
  document,AbortController,setTimeout,clearTimeout,setInterval:fn=>interval=fn,
  fetch: async()=>{if(response instanceof Error)throw response;return {ok:true,json:async()=>response};},
});
const settle = () => new Promise(resolve=>setImmediate(resolve));
await settle(); assert.equal(link.dataset.live,'true'); assert.equal(elements['twitch-title'].textContent,'<b>Live</b>');
response={status:'offline'};interval();await settle();assert.equal(link.dataset.live,'false');assert.equal(elements['twitch-status'].textContent,'OFFLINE');
response=new Error('network');interval();await settle();assert.equal(elements['twitch-status'].textContent,'LIVE STATUS UNAVAILABLE');assert.equal(link.dataset.live,'false');
response={status:'live'};interval();await settle();document.hidden=true;handlers.visibilitychange();assert.equal(link.dataset.live,'false');
console.log('PASS: live pulse state, offline, errors, hidden-tab stale clearing and safe text rendering');
