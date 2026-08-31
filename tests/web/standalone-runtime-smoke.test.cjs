const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const src = fs.readFileSync('web/app-shell.js', 'utf8');
let domReady;
let loginRenders = 0;
let fatalRenders = 0;

const document = {
  addEventListener(type, handler) {
    if (type === 'DOMContentLoaded') domReady = handler;
  }
};

const window = {
  FSTApp: {
    auth: {
      async restoreSession() { return null; }
    },
    ui: {
      renderLogin() { loginRenders += 1; },
      async renderApplication() {},
      renderFatal() { fatalRenders += 1; },
      renderNetworkState() {}
    }
  },
  addEventListener() {}
};

const context = vm.createContext({
  window,
  document,
  navigator: { onLine: true },
  console,
  Object,
  Promise
});

vm.runInContext(src, context, { filename: 'web/app-shell.js' });
assert.equal(typeof domReady, 'function', 'DOMContentLoaded bootstrap handler must be registered');

(async () => {
  await domReady();
  await Promise.resolve();
  assert.equal(window.FSTApp.state.booted, true, 'application must mark bootstrap as started');
  assert.equal(loginRenders, 1, 'unauthenticated bootstrap must render login exactly once');
  assert.equal(fatalRenders, 0, 'normal bootstrap must not render a fatal error');

  await window.FSTApp.boot();
  assert.equal(loginRenders, 1, 'boot guard must prevent duplicate startup');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
