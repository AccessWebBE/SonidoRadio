const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const { buildVolumeScript, isPlayerPageUrl } = require('../src/player-volume');

const PAGE = { component: 'Chatter/Chatboxes/Public', props: { chatbox: { id: 7, radio_settings: { enabled: true } } } };

class FakeAudio {
  constructor({ inPlayer = true, volume = 0.7, muted = false } = {}) {
    this.inPlayer = inPlayer;
    this.volume = volume;
    this.muted = muted;
  }

  closest(selector) {
    return selector === '.radio-player' && this.inPlayer ? {} : null;
  }
}

class FakeVideo {
  constructor() {
    this.volume = 0.5;
    this.muted = false;
  }

  closest() {
    return {}; // zelfs binnen het spelerblok is een video geen radio
  }
}

// Een pagina zoals BoxyChat ze opbouwt: de Inertia-gegevens in data-page, of alleen in de geschiedenis.
const newPage = ({ dataPage = JSON.stringify(PAGE), historyPage = null, storageFails = false } = {}) => {
  const listeners = [];
  const store = new Map();
  const sandbox = {
    HTMLAudioElement: FakeAudio,
    localStorage: {
      setItem: (key, value) => {
        if (storageFails) throw new Error('QuotaExceededError');
        store.set(key, String(value));
      },
      getItem: (key) => (store.has(key) ? store.get(key) : null),
    },
    document: {
      querySelector: (selector) =>
        selector === '[data-page]' && dataPage !== null ? { getAttribute: (name) => (name === 'data-page' ? dataPage : null) } : null,
      addEventListener: (type, handler, capture) => listeners.push({ type, handler, capture }),
    },
  };
  sandbox.window = sandbox;
  sandbox.window.history = { state: historyPage ? { page: historyPage } : null };
  vm.createContext(sandbox);
  const run = () => vm.runInContext(buildVolumeScript(), sandbox);
  const change = (target) => listeners.filter((l) => l.type === 'volumechange').forEach((l) => l.handler({ target }));
  return { run, change, store, listeners };
};

test('herkent alleen de chatboxpagina als spelerpagina', () => {
  assert.equal(isPlayerPageUrl('https://boxy.chattersnet.nl/chatbox/sonidoradio'), true);
  assert.equal(isPlayerPageUrl('https://boxy.chattersnet.nl/irc-chatbox/chattersnet/sonidoradio'), false, 'het chatframe heeft geen radio');
  assert.equal(isPlayerPageUrl('http://boxy.chattersnet.nl/chatbox/sonidoradio'), false);
  assert.equal(isPlayerPageUrl('https://chameleon.chattersnet.nl/chatbox/sonidoradio'), false);
  assert.equal(isPlayerPageUrl('file:///opt/Sonido/resources/app.asar/src/index.html'), false, 'de foutpagina niet');
  assert.equal(isPlayerPageUrl('geen url'), false);
});

test('bewaart het volume van de radio onder de sleutel die de speler bij het starten leest', () => {
  const page = newPage();
  assert.equal(page.run(), 'actief');
  page.change(new FakeAudio({ volume: 0.35 }));
  assert.equal(page.store.get('chammy_player_7_volume'), '0.35');
  page.change(new FakeAudio({ volume: 0.9 }));
  assert.equal(page.store.get('chammy_player_7_volume'), '0.9', 'de laatste wijziging telt');
});

test('luistert in de capturefase, want volumechange bubbelt niet', () => {
  const page = newPage();
  page.run();
  const volume = page.listeners.filter((l) => l.type === 'volumechange');
  assert.equal(volume.length, 1);
  assert.equal(volume[0].capture, true);
});

test('rondt af op twee decimalen', () => {
  const page = newPage();
  page.run();
  page.change(new FakeAudio({ volume: 0.36000000000000004 }));
  assert.equal(page.store.get('chammy_player_7_volume'), '0.36');
});

test('onthoudt dempen niet, anders start de radio de volgende keer stil', () => {
  const page = newPage();
  page.run();
  page.change(new FakeAudio({ volume: 0.5 }));
  page.change(new FakeAudio({ volume: 0 }));
  page.change(new FakeAudio({ volume: 0.8, muted: true }));
  assert.equal(page.store.get('chammy_player_7_volume'), '0.5');
});

test('negeert de spraakchat en de webcams', () => {
  const page = newPage();
  page.run();
  page.change(new FakeAudio({ volume: 0.2, inPlayer: false }));
  page.change(new FakeVideo());
  assert.equal(page.store.has('chammy_player_7_volume'), false);
});

test('vindt de chatbox ook via de geschiedenis als data-page ontbreekt', () => {
  const page = newPage({ dataPage: null, historyPage: { props: { chatbox: { id: 12 } } } });
  assert.equal(page.run(), 'actief');
  page.change(new FakeAudio({ volume: 0.4 }));
  assert.equal(page.store.get('chammy_player_12_volume'), '0.4');
});

test('doet niets zonder chatbox, ook niet bij onleesbare paginagegevens', () => {
  for (const options of [{ dataPage: null }, { dataPage: '{kapot' }, { dataPage: JSON.stringify({ props: {} }) }]) {
    const page = newPage(options);
    assert.equal(page.run(), 'geen-chatbox');
    assert.equal(page.listeners.length, 0);
  }
});

test('installeert zich maar één keer per document', () => {
  const page = newPage();
  assert.equal(page.run(), 'actief');
  assert.equal(page.run(), 'al-actief');
  assert.equal(page.listeners.length, 1);
});

test('een volle of geblokkeerde opslag breekt de pagina niet', () => {
  const page = newPage({ storageFails: true });
  page.run();
  assert.doesNotThrow(() => page.change(new FakeAudio({ volume: 0.3 })));
});
