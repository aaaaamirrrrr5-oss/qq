const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const R = p => fs.readFileSync(__dirname + '/../' + p, 'utf8');
const ok = (n, f) => { f(); console.log('PASS ' + n); };
const V = R('VERSION').trim();
const HAS_BRIDGE = fs.existsSync(__dirname + '/../bridge/site-manager-bridge/site-manager-bridge.php'); /* absent when the app is shipped on its own */
const bridge = HAS_BRIDGE ? R('bridge/site-manager-bridge/site-manager-bridge.php') : '';

ok('VERSION is valid SemVer', () => assert.match(V, /^\d+\.\d+\.\d+$/));
ok('package.json matches VERSION', () => assert.equal(JSON.parse(R('package.json')).version, V));
ok('Bridge header and VER constant match VERSION', () => {
  if (!HAS_BRIDGE) return;
  assert.equal(/^Version:\s*(\S+)/m.exec(bridge)[1], V);
  assert.equal(/const VER = '([^']+)'/.exec(bridge)[1], V);
});
ok('app version.js matches VERSION', () => assert.equal(/const APP_VERSION = '([^']+)'/.exec(R('www/version.js'))[1], V));
const latin = t => t.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
ok('both CHANGELOGs have the current VERSION as their latest entry', () => {
  for (const f of HAS_BRIDGE ? ['CHANGELOG-fa.md', 'bridge/site-manager-bridge/CHANGELOG-fa.md'] : ['CHANGELOG-fa.md'])
    assert.ok(latin(R(f).split('\n').find(l => l.startsWith('## '))).includes(V), f);
});
ok('version.js is loaded by index.html before shield.js', () => {
  const h = R('www/index.html'); assert.ok(h.indexOf('version.js') > 0 && h.indexOf('version.js') < h.indexOf('shield.js'));
});

const ctx = { console, setTimeout, Promise, Set, api: async () => ({ bridge: '4.7.0' }), S: { url: 'https://a.io' } };
const toasts = []; ctx.toast = m => toasts.push(m); ctx.window = ctx; vm.createContext(ctx); vm.runInContext(R('www/version.js'), ctx);
const C = ctx.SMB_VERSION.bridgeCompat;
ok('bridgeCompat classifies versions', () => {
  assert.equal(C(V, V), 'ok'); assert.equal(C('4.8.9', '4.8.0'), 'ok');
  assert.equal(C('3.21.0', '4.8.0'), 'bridge-legacy'); assert.equal(C('4.7.0', '4.8.0'), 'bridge-old');
  assert.equal(C('4.9.0', '4.8.0'), 'app-old'); assert.equal(C('5.0.0', '4.8.0'), 'app-old');
  assert.equal(C('', '4.8.0'), 'unknown'); assert.equal(C('abc', '4.8.0'), 'unknown');
});
(async () => {
  await ctx.api('/ping'); await ctx.api('/ping');
  ok('mismatch notice is shown once per site+version and never blocks the call', () => { assert.equal(toasts.length, 1); assert.match(toasts[0], /4\.7\.0/); });
  const r = await ctx.api('/posts'); assert.deepEqual(r, { bridge: '4.7.0' });
  ok('non-ping calls pass through untouched', () => assert.equal(toasts.length, 1));
})().catch(e => { console.error(e); process.exit(1); });
