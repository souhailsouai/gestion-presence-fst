(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V515Planning=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const DEFAULT_MANIPULATION_COUNT=6;

  function asPositiveInt(value,name){
    const n=Number(value);
    if(!Number.isInteger(n)||n<1)throw new Error(`${name||'value'} must be a positive integer`);
    return n;
  }

  function manipulationFor(groupIndex,effectiveSessionIndex,manipulationCount=DEFAULT_MANIPULATION_COUNT){
    const group=asPositiveInt(groupIndex,'groupIndex');
    const session=asPositiveInt(effectiveSessionIndex,'effectiveSessionIndex');
    const count=asPositiveInt(manipulationCount,'manipulationCount');
    return `M${((group-1)+(session-1))%count+1}`;
  }

  function nextPairClass(pair,effectiveSessionIndex){
    if(!Array.isArray(pair)||pair.length<1)throw new Error('pair must contain at least one class');
    const session=asPositiveInt(effectiveSessionIndex,'effectiveSessionIndex');
    return pair[(session-1)%pair.length];
  }

  function buildEffectiveSessions(calendarRows,pair,groupCount=4,manipulationCount=DEFAULT_MANIPULATION_COUNT){
    if(!Array.isArray(calendarRows))throw new Error('calendarRows must be an array');
    const groups=asPositiveInt(groupCount,'groupCount');
    const count=asPositiveInt(manipulationCount,'manipulationCount');
    let effectiveIndex=0;
    return calendarRows.map(row=>{
      const teaching=Boolean(row&&row.isTeachingSession);
      if(!teaching)return Object.assign({},row,{effectiveSessionIndex:null,className:null,groups:[]});
      effectiveIndex+=1;
      const className=row.className||nextPairClass(pair,effectiveIndex);
      const classOccurrence=Math.floor((effectiveIndex-1)/pair.length)+1;
      return Object.assign({},row,{
        className,
        effectiveSessionIndex:effectiveIndex,
        classOccurrence,
        groups:Array.from({length:groups},(_,i)=>({groupNo:i+1,manipulation:manipulationFor(i+1,classOccurrence,count)}))
      });
    });
  }

  function completeness(sessions,className,groupCount=4,manipulationCount=DEFAULT_MANIPULATION_COUNT){
    const groups=asPositiveInt(groupCount,'groupCount');
    const count=asPositiveInt(manipulationCount,'manipulationCount');
    const expected=Array.from({length:count},(_,i)=>`M${i+1}`);
    const result={className,groups:{},complete:true};
    for(let g=1;g<=groups;g++){
      const seen=[];
      for(const s of sessions||[]){
        if(!s||!s.isTeachingSession||s.className!==className)continue;
        const item=(s.groups||[]).find(x=>Number(x.groupNo)===g);
        if(item&&item.manipulation)seen.push(item.manipulation);
      }
      const unique=[...new Set(seen)];
      const missing=expected.filter(m=>!unique.includes(m));
      const duplicates=unique.filter(m=>seen.filter(x=>x===m).length>1);
      result.groups[g]={completed:unique.length,total:count,seen:unique,missing,duplicates};
      if(missing.length||duplicates.length)result.complete=false;
    }
    return result;
  }

  return {DEFAULT_MANIPULATION_COUNT,manipulationFor,nextPairClass,buildEffectiveSessions,completeness};
});
