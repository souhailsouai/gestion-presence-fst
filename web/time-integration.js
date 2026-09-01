(function(){'use strict';
function normalizeInput(id){const el=document.getElementById(id);if(!el)return true;const value=window.FSTTime?.normalize(el.value);if(!value){showAlert('Heure invalide. Utilisez le format 24 h HH:MM.','danger');el.focus();return false;}el.value=value;return true;}
function enforceTimeInputs(){document.querySelectorAll('input[type="time"],input[data-fst-time]').forEach(el=>{el.type='text';el.dataset.fstTime='1';el.placeholder='HH:MM';el.maxLength=5;el.inputMode='numeric';el.setAttribute('pattern','(?:[01]\\d|2[0-3]):[0-5]\\d');el.addEventListener('blur',()=>{if(!el.value)return;const n=window.FSTTime?.normalize(el.value);if(n)el.value=n;});});}
const oldAddClass=window.addClass;if(typeof oldAddClass==='function')window.addClass=async function(...args){if(!normalizeInput('class-start')||!normalizeInput('class-end'))return false;return await oldAddClass.apply(this,args);};
const oldCreateSession=window.createSession;if(typeof oldCreateSession==='function')window.createSession=async function(...args){if(!normalizeInput('session-start')||!normalizeInput('session-end'))return false;return await oldCreateSession.apply(this,args);};
const oldFetch=window.fetchRemoteData;if(typeof oldFetch==='function')window.fetchRemoteData=async function(...args){const result=await oldFetch.apply(this,args);for(const c of result.classes||[]){c.start=window.FSTTime.format(c.start);c.end=window.FSTTime.format(c.end);}for(const s of result.sessions||[]){s.start=window.FSTTime.format(s.start);s.end=window.FSTTime.format(s.end);}return result;};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enforceTimeInputs,{once:true});else enforceTimeInputs();
window.FSTTimeIntegration={enforceTimeInputs,normalizeInput};
})();
