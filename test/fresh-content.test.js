const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { MAX_IDLE_MS, STALE_STORAGES, clearStaleContent, createCacheState, reasonToClear } = require('../src/fresh-content');

const DAG = 24 * 60 * 60 * 1000;
const NU = Date.UTC(2026, 10, 24, 22, 0, 0);

// session zoals Electron hem aanbiedt, met een logboek van wat er gevraagd werd
const fakeSession = ({ failClear = false, cacheBytes = 14 * 1024 * 1024 } = {}) => {
  const calls = [];
  return {
    calls,
    getCacheSize: async () => cacheBytes,
    clearCache: async () => {
      calls.push('clearCache');
      if (failClear) throw new Error('schijf vol');
    },
    clearStorageData: async (options) => {
      calls.push(['clearStorageData', options]);
    },
  };
};

test('leegt de HTTP-cache, service workers en Cache Storage', async () => {
  const session = fakeSession();
  const result = await clearStaleContent(session);
  assert.equal(result.cleared, true);
  assert.equal(result.cacheBytes, 14 * 1024 * 1024);
  assert.deepEqual(session.calls, ['clearCache', ['clearStorageData', { storages: ['serviceworkers', 'cachestorage'] }]]);
});

test('laat cookies, localStorage en IndexedDB staan (volume, chatinstellingen, aanmelding)', async () => {
  const session = fakeSession();
  await clearStaleContent(session);
  const [, [, options]] = session.calls;
  assert.ok(Array.isArray(options.storages) && options.storages.length > 0, 'nooit clearStorageData zonder lijst: dat wist alles');
  for (const nooit of ['cookies', 'localstorage', 'indexdb', 'websql', 'filesystem', 'shadercache']) {
    assert.equal(options.storages.includes(nooit), false, nooit);
  }
  assert.deepEqual(STALE_STORAGES, ['serviceworkers', 'cachestorage']);
});

test('een mislukte opruiming gooit niet, maar wordt gelogd: de chat laadt dan gewoon', async () => {
  const session = fakeSession({ failClear: true });
  const gelogd = [];
  const result = await clearStaleContent(session, { warn: (tekst) => gelogd.push(tekst) });
  assert.equal(result.cleared, false);
  assert.equal(gelogd.length, 1);
  assert.match(gelogd[0], /schijf vol/);
});

test('werkt ook zonder getCacheSize', async () => {
  const session = fakeSession();
  delete session.getCacheSize;
  const result = await clearStaleContent(session);
  assert.equal(result.cleared, true);
  assert.equal(result.cacheBytes, null);
});

test('de cache wordt alleen geleegd na een update of na lang niet openen (Jellis, 24-11)', () => {
  const gisteren = { version: '1.2.3', lastSeenAt: NU - DAG };
  assert.equal(reasonToClear(gisteren, { version: '1.2.3', now: NU }), null, 'gewone start: cache blijft');
  assert.equal(reasonToClear({ version: '1.2.3', lastSeenAt: NU - MAX_IDLE_MS + 1000 }, { version: '1.2.3', now: NU }), null);
  assert.equal(reasonToClear(gisteren, { version: '1.2.4', now: NU }), 'nieuwe versie 1.2.3 → 1.2.4');
  assert.equal(reasonToClear({ version: '1.2.3', lastSeenAt: NU - 10 * DAG }, { version: '1.2.3', now: NU }), '10 dagen niet geopend');
  assert.equal(MAX_IDLE_MS, 7 * DAG, 'lang niet geopend = een week');
});

test('de eerste start van 1.2.3 (nog geen stand bewaard, of een kapotte) leegt de oude cache', () => {
  for (const state of [null, {}, { version: 1 }, { version: '1.2.3' }, { version: '1.2.3', lastSeenAt: 'gisteren' }]) {
    assert.equal(reasonToClear(state, { version: '1.2.3', now: NU }), 'eerste start met deze opruiming', JSON.stringify(state));
  }
});

test('de stand wordt bewaard en teruggelezen; een kapot of ontbrekend bestand geeft null', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sonido-cache-'));
  const file = path.join(dir, 'chat-cache.json');
  const state = createCacheState({ file, fs, path });
  assert.equal(state.read(), null);
  state.write('1.2.3', NU);
  assert.deepEqual(state.read(), { version: '1.2.3', lastSeenAt: NU });
  assert.equal(reasonToClear(state.read(), { version: '1.2.3', now: NU + DAG }), null);
  fs.writeFileSync(file, '{kapot');
  assert.equal(state.read(), null);
  const onschrijfbaar = createCacheState({ file: path.join(file, 'kan-niet', 'x.json'), fs, path });
  assert.doesNotThrow(() => onschrijfbaar.write('1.2.3', NU));
});
