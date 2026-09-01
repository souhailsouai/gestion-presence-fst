(function(){'use strict';
function normalize(value){if(value==null)return null;const s=String(value).trim();const m=s.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);if(!m)return null;const h=Number(m[1]),min=Number(m[2]);if(!Number.isInteger(h)||!Number.isInteger(min)||h<0||h>23||min<0||min>59)return null;return String(h).padStart(2,'0')+':'+String(min).padStart(2,'0');}
function isValid(value){return normalize(value)!==null;}
function format(value){return normalize(value)||'';}
window.FSTTime={normalize,isValid,format};
})();
