const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
function fixture(){
 const supplied=process.env.FST_BASELINE_ARTIFACT;
 if(supplied)return fs.readFileSync(supplied,'utf8');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fst-shell-baseline-'));
 try{
  fs.mkdirSync(path.join(dir,'web'));
  for(const name of ['scripts','shared'])fs.cpSync(path.join(root,name),path.join(dir,name),{recursive:true});
  fs.copyFileSync(path.join(root,'index.html'),path.join(dir,'index.html'));
  // Test transformation on the raw baseline so no other test can overwrite it.
  return fs.readFileSync(path.join(dir,'index.html'),'utf8');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
function transform(source){
 return cp.execFileSync('python',['-c',
  'import sys;from pathlib import Path;sys.path.insert(0,"scripts");from fst_shell_transform import apply_fst_shell;sys.stdout.buffer.write(apply_fst_shell(sys.stdin.buffer.read().decode(),target="pages",root=Path.cwd()).encode())'
 ],{cwd:root,input:source,encoding:'utf8',maxBuffer:16*1024*1024});
}
const source=fixture();const result=transform(source);
const ids=text=>[...text.matchAll(/<div\b[^>]*id="([^"]+)"[^>]*class="tab-content[^\"]*"/g)].map(m=>m[1]).sort();
const fingerprint=value=>value===undefined?undefined:crypto.createHash('sha256').update(value).digest('hex');
const imgIdentity=text=>[...text.matchAll(/<img\b[^>]*>/g)].map(m=>({id:m[0].match(/\bid="([^"]*)"/)?.[1],src:fingerprint(m[0].match(/\bsrc="([^"]*)"/)?.[1]),alt:m[0].match(/\balt="([^"]*)"/)?.[1]}));
test('one shared navigation frame preserves every existing business tab',()=>{
 assert.equal((result.match(/id="fst-sidebar-nav"/g)||[]).length,1);
 assert.equal((result.match(/data-fst-shell-js="inline"/g)||[]).length,1);
 assert.equal((result.match(/data-fst-auth-compat="inline"/g)||[]).length,1);
 assert.doesNotMatch(result,/<script[^>]*data-shared-mobile-v2="js"/);
 assert.doesNotMatch(result,/<script[^>]*data-fst-mobile-js="inline"/);
 assert.deepEqual(ids(result),ids(source));
});
test('shared frame preserves logos, PIN inputs and existing business commands',()=>{
 const expected=imgIdentity(source).map(image=>{
  const key=image.id?.match(/^internal-(utm|fst)-logo$/)?.[1];
  if(!key||image.src)return image;
  const tag=[...source.matchAll(/<img\b[^>]*>/g)].map(m=>m[0]).find(t=>t.includes('class="'+key+'-logo"'));
  const originalSrc=tag?.match(/\bsrc="([^"]*)"/)?.[1];
  assert.ok(originalSrc?.startsWith('data:image/'),'Original institution image must exist');
  return {...image,src:fingerprint(originalSrc)};
 });
 assert.deepEqual(imgIdentity(result),expected,'Every original image remains; header images reuse the exact login bytes');
 for(const id of ['sync-status','current-user-label','admin-pin-button','current-pin','new-pin','confirm-pin']){
  assert.equal((result.match(new RegExp('id="'+id+'"','g'))||[]).length,(source.match(new RegExp('id="'+id+'"','g'))||[]).length);
 }
 for(const command of ['exportData','showHelp','openPinModal','setAdminPin','logoutTeacher'])
  assert.ok(result.includes('onclick="'+command+'()"'));
});
test('shared frame transformation is byte-idempotent',()=>assert.equal(transform(result),result));
test('frame injection ignores body closing text inside script strings',()=>{
 const literal='<script>const nestedDocumentEnd = "</body>";</script>';
 const withLiteral=source.replace('</body>',literal+'\n</body>');
 const compiled=transform(withLiteral);
 assert.ok(compiled.includes(literal),'A JavaScript string must not become the insertion point');
});
test('standalone finalization keeps frame controller after newly inlined business modules',()=>{
 const withModule=result.replace('</body>','<script>window.businessReady=true;</script>\n</body>');
 const finalized=transform(withModule);
 assert.ok(finalized.lastIndexOf('data-fst-shell-js="inline"')>finalized.lastIndexOf('window.businessReady=true;'));
 assert.equal(transform(finalized),finalized);
});
