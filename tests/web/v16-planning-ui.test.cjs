const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

function read(path){return fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';}

const ui=read('web/v16-planning-ui.js');
const online=read('scripts/build_pages_from_41881.py');
const single=read('scripts/build_pages_from_41881.py');

