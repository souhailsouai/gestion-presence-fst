'use strict';
// Régression 28/11/2026 : boucle de reconnexion temps réel (≈ 25 000 rechargements/jour, quota Supabase dépassé).
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','..','web','online-runtime.js'),'utf8');
function el(){const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},textContent:'',innerHTML:'',
  appendChild(x){return x;},prepend(){},append(){},remove(){},setAttribute(){},addEventListener(){},querySelector(){return el();},querySelectorAll(){return [];}};return e;}
function harness(){
  const timers=[];let refreshes=0;const channels=[];
  const sb={channel(){const ch={cb:null,on(){return ch;},subscribe(cb){ch.cb=cb;channels.push(ch);return ch;}};return ch;},
    removeChannel(ch){ch.cb&&ch.cb('CLOSED');}};          // comme supabase-js : fermer un canal émet « CLOSED »
  const ctx={window:{},document:{getElementById:()=>null,addEventListener(){},createElement:el,head:el(),body:el(),querySelector:()=>null,querySelectorAll:()=>[],readyState:'complete'},navigator:{onLine:true},localStorage:{getItem(){},setItem(){},removeItem(){}},
    console,supabaseClient:sb,currentTeacher:{id:'u',activeMode:'teacher'},data:{sessions:[]},
    setTimeout:(f,ms)=>{timers.push({f,ms});return timers.length;},clearTimeout(){},addEventListener(){},
    fetchRemoteData:async()=>{refreshes++;return {sessions:[]};}};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);
  return {ctx,timers,channels,get refreshes(){return refreshes;}};
}
test('Un canal en erreur ne déclenche pas une boucle : un seul essai, puis des essais espacés',async()=>{
  const h=harness();const rt=h.ctx.FSTOnlineRuntime;assert.ok(rt,'runtime chargé');
  rt.startRealtime();
  h.channels[0].cb('CHANNEL_ERROR');
  assert.equal(h.timers.filter(t=>t.ms>=2000).length,1);
  const first=h.timers.find(t=>t.ms>=2000);await first.f();       // l'essai : recharge puis recrée le canal
  // L'ancien canal a émis « CLOSED » en étant fermé par nous : ça ne doit relancer aucun essai.
  assert.equal(h.timers.filter(t=>t.ms>=2000).length,1,'pas de nouvel essai déclenché par notre propre fermeture');
  h.channels[1].cb('CHANNEL_ERROR');
  const waits=h.timers.filter(t=>t.ms>=2000).map(t=>t.ms);
  assert.deepEqual(waits,[2000,4000],'le délai double');
});
