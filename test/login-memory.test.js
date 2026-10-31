const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { buildLoginScript, createLoginMemory, isLoginFrameUrl } = require('../src/login-memory');

// safeStorage zoals Electron 45 hem aanbiedt. Twee formaten, zoals gemeten op 31-10-2026 (KWallet 6): wat de
// asynchrone functies versleutelen ("async:") en wat 1.2.0/1.2.1 met de synchrone encryptString bewaarde ("oud:").
// decryptStringAsync leest het oude formaat NIET; alleen de (afgeschreven) synchrone decryptString doet dat.
const fakeSafeStorage = ({ available = true, backend = 'kwallet6', failDecrypt = false, reEncrypt = false, electron46 = false } = {}) => {
  const calls = { decrypt: 0, encrypt: 0, sync: 0 };
  const afgeschreven = () => {
    throw new Error('synchrone safeStorage is afgeschreven (Electron 45) en weg in 46');
  };
  const decode = (buffer, prefix) => {
    const tekst = buffer.toString();
    if (!tekst.startsWith(prefix)) throw new Error('Error while decrypting the ciphertext');
    return Buffer.from(tekst.slice(prefix.length), 'hex').toString();
  };
  const nep = {
    calls,
    isEncryptionAvailable: afgeschreven,
    encryptString: afgeschreven,
    decryptString: (buffer) => {
      calls.sync += 1;
      return decode(buffer, 'oud:');
    },
    isAsyncEncryptionAvailable: async () => available,
    getSelectedStorageBackend: () => backend,
    encryptStringAsync: async (text) => {
      calls.encrypt += 1;
      return Buffer.from(`async:${Buffer.from(text).toString('hex')}`);
    },
    decryptStringAsync: async (buffer) => {
      calls.decrypt += 1;
      if (failDecrypt) throw new Error('andere sleutelbos');
      return { result: decode(buffer, 'async:'), shouldReEncrypt: reEncrypt };
    },
  };
  if (electron46) delete nep.decryptString;
  return nep;
};

// een login.json zoals Sonido 1.2.0/1.2.1 hem achterliet
const oudBestand = (file, password) =>
  fs.writeFileSync(file, JSON.stringify({ nick: 'Jellis', password: Buffer.from(`oud:${Buffer.from(password).toString('hex')}`).toString('base64') }));

const newMemory = (options = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sonido-login-'));
  const file = path.join(dir, 'login.json');
  const safeStorage = fakeSafeStorage(options);
  const memory = createLoginMemory({ file, fs, path, safeStorage, platform: options.platform || 'linux' });
  return { memory, file, safeStorage };
};

test('herkent alleen het KiwiIRC-chatframe', () => {
  assert.equal(isLoginFrameUrl('https://boxy.chattersnet.nl/irc-chatbox/chattersnet/sonidoradio'), true);
  assert.equal(isLoginFrameUrl('https://boxy.chattersnet.nl/chatbox/sonidoradio'), false, 'de buitenpagina heeft geen formulier');
  assert.equal(isLoginFrameUrl('http://boxy.chattersnet.nl/irc-chatbox/x'), false);
  assert.equal(isLoginFrameUrl('https://chameleon.chattersnet.nl/irc-chatbox/x'), false);
  assert.equal(isLoginFrameUrl('https://www.google.com/recaptcha/api2/anchor'), false);
});

test('onthoudt de nickname, zonder spaties rond', async () => {
  const { memory } = newMemory();
  assert.equal((await memory.load()).nick, '');
  memory.rememberNick('  Jellis  ');
  assert.equal((await memory.load()).nick, 'Jellis');
  memory.rememberNick('   ');
  assert.equal((await memory.load()).nick, 'Jellis', 'een lege nickname wist niets');
});

test('bewaart het wachtwoord alleen versleuteld', async () => {
  const { memory, file } = newMemory();
  assert.equal(await memory.rememberPassword('Zeer$Geheim1'), true);
  const opSchijf = fs.readFileSync(file, 'utf8');
  assert.equal(opSchijf.includes('Zeer$Geheim1'), false, 'het wachtwoord mag nooit leesbaar op schijf staan');
  assert.equal((await memory.load()).password, 'Zeer$Geheim1');
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(file).mode & 0o777, 0o600, 'alleen leesbaar voor de gebruiker');
  }
});

test('geen wachtwoord zonder echte sleutelbos (Linux basic_text)', async () => {
  const { memory } = newMemory({ backend: 'basic_text' });
  assert.equal(await memory.canStorePassword(), false);
  assert.equal(await memory.rememberPassword('x'), false);
  assert.equal((await memory.load()).password, '');
  const windows = newMemory({ backend: 'basic_text', platform: 'win32' });
  assert.equal(await windows.memory.canStorePassword(), true, 'op Windows beschermt DPAPI; de backendvraag is Linux-specifiek');
  const geen = newMemory({ available: false, platform: 'win32' });
  assert.equal(await geen.memory.canStorePassword(), false, 'geen versleuteling beschikbaar: niets bewaren');
});

test('een wachtwoord dat niet te ontsleutelen is, wordt gewoon opnieuw gevraagd', async () => {
  const { memory } = newMemory({ failDecrypt: true });
  await memory.rememberPassword('x');
  assert.equal((await memory.load()).password, '');
});

test('een vernieuwde sleutel: het wachtwoord wordt opnieuw versleuteld bewaard (shouldReEncrypt)', async () => {
  const { memory, file, safeStorage } = newMemory({ reEncrypt: true });
  await memory.rememberPassword('Geheim2');
  const voor = safeStorage.calls.encrypt;
  assert.equal((await memory.load()).password, 'Geheim2');
  assert.equal(safeStorage.calls.encrypt, voor + 1, 'na shouldReEncrypt opnieuw versleutelen');
  assert.equal(fs.readFileSync(file, 'utf8').includes('Geheim2'), false);
});

test('de gewone weg gebruikt nooit de afgeschreven synchrone safeStorage', async () => {
  const { memory, safeStorage } = newMemory();
  memory.rememberNick('Jellis');
  await memory.rememberPassword('x');
  assert.equal((await memory.load()).password, 'x');
  memory.menuState();
  memory.forget();
  assert.equal(safeStorage.calls.sync, 0);
});

test('een wachtwoord van 1.2.0/1.2.1 wordt één keer omgezet naar het nieuwe formaat', async () => {
  const { memory, file, safeStorage } = newMemory();
  oudBestand(file, 'Zeer$Geheim1');
  assert.equal((await memory.load()).password, 'Zeer$Geheim1', 'de asynchrone weg faalt, de synchrone leest het');
  assert.equal(safeStorage.calls.sync, 1);
  const opSchijf = Buffer.from(JSON.parse(fs.readFileSync(file, 'utf8')).password, 'base64').toString();
  assert.ok(opSchijf.startsWith('async:'), 'meteen opnieuw versleuteld in het nieuwe formaat');
  assert.equal(opSchijf.includes('Zeer$Geheim1'), false);
  assert.equal((await memory.load()).password, 'Zeer$Geheim1');
  assert.equal(safeStorage.calls.sync, 1, 'daarna nooit meer de synchrone weg');
});

test('een oud wachtwoord dat ook synchroon niet te lezen is, wordt gewoon opnieuw gevraagd', async () => {
  const { memory, file } = newMemory();
  fs.writeFileSync(file, JSON.stringify({ nick: 'Jellis', password: Buffer.from('rommel').toString('base64') }));
  assert.equal((await memory.load()).password, '');
});

test('in Electron 46 (geen synchrone safeStorage meer) breekt een oud wachtwoord niets', async () => {
  const { memory, file } = newMemory({ electron46: true });
  oudBestand(file, 'x');
  assert.deepEqual(await memory.load(), { nick: 'Jellis', password: '', autoConnect: false, passwordChoice: 'ask' });
});

test('vergeten wist nickname en wachtwoord, maar niet de voorkeur voor automatisch verbinden', async () => {
  const { memory } = newMemory();
  memory.rememberNick('Jellis');
  await memory.rememberPassword('x');
  memory.setAutoConnect(true);
  memory.setPasswordChoice('never');
  assert.deepEqual(memory.menuState(), { autoConnect: true, hasSaved: true });
  memory.forget();
  assert.deepEqual(await memory.load(), { nick: '', password: '', autoConnect: true, passwordChoice: 'ask' });
  assert.equal(memory.hasSaved(), false);
});

test('het menu leest de stand zonder het wachtwoord te ontsleutelen', async () => {
  const { memory, safeStorage } = newMemory();
  await memory.rememberPassword('x');
  const voor = safeStorage.calls.decrypt;
  memory.menuState();
  assert.equal(safeStorage.calls.decrypt, voor, 'op Linux kan ontsleutelen een KWallet-venster geven');
});

test('een kapot bestand geeft gewoon lege standaarden', async () => {
  const { memory, file } = newMemory();
  fs.writeFileSync(file, '{kapot');
  assert.deepEqual(await memory.load(), { nick: '', password: '', autoConnect: false, passwordChoice: 'ask' });
});

// --- het invulscript, in een nagebootst KiwiIRC-welkomstformulier (zelfde klassen als de echte pagina)

// Een klein selectormatcher met échte attribuutsemantiek. De vorige versie beantwoordde de selectorstrings
// letterlijk en ving zo niet dat het echte nicknameveld GEEN type-attribuut heeft (input[type=text] → niets).
const matches = (el, selector) => {
  const delen = selector.trim().split(/\s+/);
  const doel = delen.pop();
  const ouder = delen.pop();
  if (ouder && !(ouder.startsWith('.') && el.ouderKlassen.has(ouder.slice(1)))) return false;
  const tag = /^[a-z]+/.exec(doel);
  if (tag && tag[0] !== el.tag) return false;
  for (const [, klasse] of doel.matchAll(/(?<![\w-])\.([\w-]+)/g)) {
    if (!el.klassen.has(klasse)) return false;
  }
  const zonderNot = doel.replace(/:not\(\[type=([\w-]+)\]\)/g, (_m, t) => {
    if (el.attrs.type === t) el.uitgesloten = true;
    return '';
  });
  if (el.uitgesloten) {
    el.uitgesloten = false;
    return false;
  }
  for (const [, naam, waarde] of zonderNot.matchAll(/\[([\w-]+)=([\w-]+)\]/g)) {
    if (el.attrs[naam] !== waarde) return false;
  }
  return true;
};

const fakeKiwi = () => {
  class Event {
    constructor(type) {
      this.type = type;
    }
  }
  class HTMLInputElement {
    constructor({ tag = 'input', type = null, klassen = [], ouderKlassen = [] } = {}) {
      this.tag = tag;
      this.attrs = type ? { type } : {}; // attribuut, zoals in de HTML — niet de eigenschap
      this.type = type || 'text';
      this.klassen = new Set(klassen);
      this.ouderKlassen = new Set(ouderKlassen);
      this._value = '';
      this.checked = false;
      this.events = [];
      this.listeners = {};
    }
    get value() {
      return this._value;
    }
    set value(v) {
      this._value = String(v);
    }
    dispatchEvent(event) {
      this.events.push(event.type);
    }
    addEventListener(type, fn) {
      (this.listeners[type] ||= []).push(fn);
    }
    click() {
      if (this.type === 'checkbox') {
        this.checked = !this.checked;
        form.showPassword = this.checked;
      }
      for (const fn of this.listeners.click || []) fn();
    }
  }
  // zoals de echte pagina (24-09): nickname zonder type-attribuut, vinkje in een label, wachtwoord pas na het vinkje
  const nick = new HTMLInputElement({ klassen: ['u-input'], ouderKlassen: ['u-input-text'] });
  const box = new HTMLInputElement({ type: 'checkbox', ouderKlassen: ['kiwi-welcome-simple-have-password'] });
  const password = new HTMLInputElement({ type: 'password', klassen: ['u-input', 'u-form-input-plaintext'] });
  const start = new HTMLInputElement({ tag: 'button', type: 'submit', klassen: ['u-button', 'kiwi-welcome-simple-start'] });
  let observer = null;
  let inDocument = true;
  const form = {
    showPassword: false,
    listeners: {},
    addEventListener(type, fn) {
      (this.listeners[type] ||= []).push(fn);
    },
    submit() {
      for (const fn of this.listeners.submit || []) fn();
    },
    querySelector(selector) {
      const elementen = [nick, box, ...(this.showPassword ? [password] : []), start];
      return elementen.find((el) => matches(el, selector)) || null;
    },
  };
  start.addEventListener('click', () => form.submit());
  const context = {
    Event,
    HTMLInputElement,
    MutationObserver: class {
      constructor(cb) {
        this.cb = cb;
        observer = this;
      }
      observe() {}
      disconnect() {}
    },
    setTimeout,
    Date,
    Promise,
    Object,
    document: {
      documentElement: {},
      querySelector: (s) => (s === 'form.kiwi-welcome-simple-form' ? form : null),
      contains: () => inDocument,
    },
  };
  form.offsetParent = {}; // zichtbaar
  const connect = () => {
    inDocument = false; // KiwiIRC verbindt: het welkomstscherm verdwijnt
    observer.cb();
  };
  const hide = () => {
    form.offsetParent = null; // of: KiwiIRC verbergt het welkomstscherm alleen
    observer.cb();
  };
  return { context, nick, box, password, start, form, connect, hide };
};

test('de matcher kijkt naar het attribuut, zoals de browser (de fout van 24-09)', () => {
  const kiwi = fakeKiwi();
  assert.equal(kiwi.form.querySelector('input[type=text]'), null, 'het echte nicknameveld heeft geen type-attribuut');
  assert.equal(kiwi.form.querySelector('input.u-input:not([type=password]):not([type=checkbox])'), kiwi.nick);
});

const run = (data, kiwi) => vm.runInNewContext(buildLoginScript(data), kiwi.context);
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
// het resultaat komt uit een andere context (ander Object-prototype): vergelijk de gegevens, niet het prototype
const plain = (value) => JSON.parse(JSON.stringify(value));

test('vult de onthouden nickname in en meldt dat aan KiwiIRC (input-event)', async () => {
  const kiwi = fakeKiwi();
  const klaar = run({ nick: 'Jellis' }, kiwi);
  await tick();
  assert.equal(kiwi.nick.value, 'Jellis');
  assert.ok(kiwi.nick.events.includes('input'), 'zonder input-event ziet Vue de waarde niet');
  assert.equal(kiwi.box.checked, false, 'zonder wachtwoord het vinkje niet aanzetten');
  kiwi.start.click();
  kiwi.connect();
  assert.deepEqual(plain(await klaar), { status: 'submitted', nick: 'Jellis', password: '' });
});

test('vinkt "Ik heb een wachtwoord" aan en vult het wachtwoord in', async () => {
  const kiwi = fakeKiwi();
  const klaar = run({ nick: 'Jellis', password: 'Zeer$Geheim1' }, kiwi);
  await tick(300);
  assert.equal(kiwi.box.checked, true);
  assert.equal(kiwi.password.value, 'Zeer$Geheim1');
  kiwi.form.submit(); // Enter in het formulier
  kiwi.connect();
  assert.deepEqual(plain(await klaar), { status: 'submitted', nick: 'Jellis', password: 'Zeer$Geheim1' });
});

test('onthoudt pas wat er als laatste verstuurd werd (een afgekeurde nickname wordt verbeterd)', async () => {
  const kiwi = fakeKiwi();
  const klaar = run({}, kiwi);
  await tick();
  kiwi.nick.value = 'fout nick';
  kiwi.start.click(); // KiwiIRC keurt af, het formulier blijft staan
  kiwi.nick.value = 'GoedeNick';
  kiwi.start.click();
  kiwi.connect();
  assert.equal((await klaar).nick, 'GoedeNick');
});

test('automatisch verbinden drukt zelf op Start, maar alleen met een nickname', async () => {
  const met = fakeKiwi();
  let geklikt = 0;
  met.start.addEventListener('click', () => (geklikt += 1));
  run({ nick: 'Jellis', autoConnect: true }, met);
  await tick(600);
  assert.equal(geklikt, 1);
  const zonder = fakeKiwi();
  let niets = 0;
  zonder.start.addEventListener('click', () => (niets += 1));
  run({ autoConnect: true }, zonder);
  await tick(600);
  assert.equal(niets, 0, 'zonder nickname niets versturen');
});

test('een typefout in een nickname kan het script niet breken', () => {
  const script = buildLoginScript({ nick: "O'Brien`${x}\"</script>\u2028", password: '\\n"\'' });
  assert.doesNotThrow(() => new vm.Script(script), 'waarden worden als JSON ingevoegd, niet als code');
});

test('ook een verborgen (niet weggehaald) welkomstscherm telt als verbonden — maar pas na een verzending', async () => {
  const kiwi = fakeKiwi();
  let klaar = false;
  const uitkomst = run({ nick: 'Jellis' }, kiwi).then((r) => {
    klaar = true;
    return r;
  });
  await tick();
  kiwi.hide(); // nog niets verstuurd: bv. het scherm bouwt nog op
  await tick();
  assert.equal(klaar, false, 'zonder verzending niet als verbonden tellen');
  kiwi.form.offsetParent = {};
  kiwi.start.click();
  kiwi.hide();
  assert.equal((await uitkomst).nick, 'Jellis');
});
