const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const legacy = fs.readFileSync(path.join(root, 'shared/mobile.js'), 'utf8');
async function scenario(source, scenario) {
  const trace=[];
  const fields={'login-role':{value:scenario.mode},'login-email':{value:' test.user '},'login-pin':{value:'654321'}};
  const profile=scenario.noProfile?null:{id:'test-user',role:scenario.profileRole||scenario.mode,full_name:'Fixture'};
  const ctx={console,Map,CustomEvent:function(){},document:{querySelector:()=>({}),getElementById:id=>fields[id],body:{classList:{remove(){}}}},
    dispatchEvent(){},FSTShell:{init(){}},showAuthError:message=>trace.push(['error',message]),teacherAuthEmail:id=>id+'@fixture.invalid',
    localStorage:{setItem:(...v)=>trace.push(['storage',...v]),removeItem:(...v)=>trace.push(['remove',...v])},
    doLogin:async(...args)=>trace.push(['login',...args]),
    supabaseClient:{functions:{invoke:async(...args)=>{trace.push(['invoke',...args]);return scenario.fallback?{error:new Error('rejected')}:{data:{access_token:'fake-access',refresh_token:'fake-refresh'}};}},
      auth:{setSession:async(...args)=>{trace.push(['setSession',...args]);return {data:{user:{id:'test-user'}},error:null};},
        signInWithPassword:async(...args)=>{trace.push(['password',...args]);return {data:scenario.reject?{}:{user:{id:'test-user'}},error:scenario.reject?new Error('rejected'):null};},
        signOut:async()=>trace.push(['signOut'])},
      from:table=>({select:columns=>({eq:(key,val)=>({single:async()=>{trace.push(['profile',table,columns,key,val]);return {data:profile,error:null};}})})})}};
  ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);
  await ctx.loginTeacher();return JSON.parse(JSON.stringify(trace));
}
for(const fixture of [{mode:'admin'},{mode:'teacher'},{mode:'teacher',fallback:true},{mode:'teacher',fallback:true,reject:true},{mode:'teacher',noProfile:true},{mode:'admin',profileRole:'teacher'}]) {
 test('mobile auth compatibility preserves arguments, effects and errors: '+JSON.stringify(fixture),async()=>{
   const compat=fs.readFileSync(path.join(root,'shared/fst-auth-compat.js'),'utf8');
   assert.deepEqual(await scenario(compat,fixture),await scenario(legacy,fixture));
 });
}


test('teacher mode uses pin-login and never admin-pin-login',async()=>{
  const compat=fs.readFileSync(path.join(root,'shared/fst-auth-compat.js'),'utf8');
  const trace=await scenario(compat,{mode:'teacher'});
  const calls=trace.filter(x=>x[0]==='invoke');
  assert.equal(calls.length,1);
  assert.equal(calls[0][1],'pin-login');
  assert.equal(trace.some(x=>x[0]==='password'),false);
});

test('admin mode keeps admin-pin-login',async()=>{
  const compat=fs.readFileSync(path.join(root,'shared/fst-auth-compat.js'),'utf8');
  const trace=await scenario(compat,{mode:'admin'});
  const calls=trace.filter(x=>x[0]==='invoke');
  assert.equal(calls.length,1);
  assert.equal(calls[0][1],'admin-pin-login');
});
