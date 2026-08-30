const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('Android host loads the shared HTML and exposes a PDF save bridge',()=>{
  const p='app/src/main/java/tn/utm/fst/gestionpresence/MainActivity.java';
  assert.equal(fs.existsSync(p),true);
  const java=fs.readFileSync(p,'utf8');
  assert.match(java,/file:\/\/\/android_asset\/index\.html/);
  assert.match(java,/addJavascriptInterface/);
  assert.match(java,/AndroidPdfBridge/);
  assert.match(java,/@JavascriptInterface/);
  assert.match(java,/MediaStore\.Downloads/);
  assert.match(java,/application\/pdf/);
});

test('APK workflow rebuilds the shared final HTML before packaging',()=>{
  const yml=fs.readFileSync('.github/workflows/build-apk.yml','utf8');
  assert.match(yml,/build_online_web\.py/);
  assert.match(yml,/build_single_file_release\.py/);
  assert.match(yml,/web\/index\.html/);
  assert.match(yml,/app\/src\/main\/assets\/index\.html/);
});
