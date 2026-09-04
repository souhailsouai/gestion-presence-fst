const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const dir='supabase/migrations';

test('timestamped Supabase migrations have unique 14-digit versions',()=>{
  const files=fs.readdirSync(dir).filter(name=>/^\d{14}_.+\.sql$/.test(name));
  const byVersion=new Map();
  for(const name of files){
    const version=name.slice(0,14);
    const list=byVersion.get(version)||[];
    list.push(name);
    byVersion.set(version,list);
  }
  const duplicates=[...byVersion.entries()].filter(([,names])=>names.length>1);
  assert.deepEqual(duplicates,[],`Duplicate migration versions: ${duplicates.map(([v,n])=>`${v}: ${n.join(', ')}`).join('; ')}`);
});
