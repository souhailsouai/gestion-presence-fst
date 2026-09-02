const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function load(){
  const calls=[];
  const context={window:{},supabaseClient:{rpc:async(name,args)=>{calls.push([name,args]);return{data:{ok:true,name,args},error:null};}},console};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('web/v515-api.js','utf8'),context);
  return{api:context.window.FSTV515Api,calls};
}

test('V5.15 API maps public methods to exact RPC names',async()=>{
  assert.equal(fs.existsSync('web/v515-api.js'),true);
  const{api,calls}=load();
  const cases=[
    ['dashboard',[], 'v515_my_dashboard',undefined],
    ['availablePositions',[],'v515_available_positions',undefined],
    ['myRequests',[],'v515_my_requests',undefined],
    ['myAssignments',[],'v515_my_assignments',undefined],
    ['adminSnapshot',['c1'],'v515_admin_snapshot',{p_cycle_id:'c1'}],
    ['submitRequest',['p1'],'v515_submit_request',{p_position_id:'p1'}],
    ['cancelRequest',['r1'],'v515_cancel_request',{p_request_id:'r1'}],
    ['acceptRequest',['r1'],'v515_accept_request',{p_request_id:'r1'}],
    ['rejectRequest',['r1'],'v515_reject_request',{p_request_id:'r1'}],
    ['directAssign',['p1','t1'],'v515_direct_assign',{p_position_id:'p1',p_teacher_id:'t1'}],
    ['generateCycle',['c1'],'v515_generate_cycle',{p_cycle_id:'c1'}],
    ['openCycle',['c1'],'v515_open_cycle',{p_cycle_id:'c1'}],
    ['resetCycle',['c1'],'v515_reset_cycle',{p_cycle_id:'c1'}],
    ['verifyCycle',['c1'],'v515_verify_cycle',{p_cycle_id:'c1'}],
    ['finalizeCycle',['c1'],'v515_finalize_cycle',{p_cycle_id:'c1'}],
  ];
  for(const [method,args,name,params] of cases){
    calls.length=0; await api[method](...args); assert.equal(calls[0][0],name); assert.equal(JSON.stringify(calls[0][1]),JSON.stringify(params));
  }
});

test('V5.15 API exposes administrator configuration operations',()=>{
  const{api}=load();
  for(const name of ['upsertCycle','upsertClassConfig','setGroupRoster','createRosterGroup','upsertTimeslot','setFortnightPair','setTeacherConfig','cancelPosition','createCatchup','setRotationException'])
    assert.equal(typeof api[name],'function',name);
});

test('V5.15 API maps admin bootstrap RPC',async()=>{
  const{api,calls}=load();
  calls.length=0;
  await api.adminBootstrap();
  assert.equal(calls[0][0],'v515_admin_bootstrap');
  assert.equal(calls[0][1],undefined);
});
