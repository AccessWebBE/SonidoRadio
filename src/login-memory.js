// Onthoudt de nickname (en desgewenst het wachtwoord) van het welkomstscherm van de chat.
//
// De chat is een KiwiIRC-scherm van BoxyChat zonder eigen geheugen: de nickname staat leeg en de velden hebben
// autocomplete="off". In een gewone browser vullen automatisch invullen en de wachtwoordbeheerder ze toch in;
// Electron heeft geen van beide. Deze module doet dat werk: ze bewaart wat je invulde en vult het de volgende
// keer weer in. Het wachtwoord gaat alleen versleuteld op schijf (Electron safeStorage: Windows-account,
// KWallet of GNOME-sleutelbos) en nooit als er op Linux geen echte sleutelbos is.
//
// Sinds 1.2.2 (Electron 45) de asynchrone safeStorage: de synchrone functies zijn afgeschreven en verdwijnen in
// Electron 46. Electron zegt dat decryptStringAsync() leest wat encryptString() bewaarde, maar gemeten op 31-10-2026
// (KWallet 6, Electron 43 → 45) klopt dat NIET: de oude versleuteling geeft een fout. Daarom één keer omzetten: lukt
// de asynchrone weg niet, dan de (in 45 nog bestaande) synchrone, en meteen opnieuw versleutelen in het nieuwe
// formaat. Dat kan alleen zolang Sonido op Electron 45 draait: pas naar 46+ als iedereen 1.2.2 heeft gestart.

const LOGIN_HOST = 'boxy.chattersnet.nl';
const LOGIN_PATH = '/irc-chatbox/';
// Zonder echte sleutelbos versleutelt Chromium op Linux met een vaste sleutel: dat is geen bescherming.
const UNSAFE_LINUX_BACKENDS = new Set(['basic_text', 'unknown']);

const parseUrl = (value) => {
  try {
    return new URL(value);
  } catch (_error) {
    return null;
  }
};

const isLoginFrameUrl = (value) => {
  const url = parseUrl(value);
  return Boolean(
    url && url.protocol === 'https:' && url.hostname === LOGIN_HOST && url.pathname.startsWith(LOGIN_PATH),
  );
};

const createLoginMemory = ({ file, fs, path, safeStorage, platform }) => {
  const read = () => {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch (_error) {
      return {};
    }
  };

  const write = (data) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
  };

  const update = (changes) => write({ ...read(), ...changes });

  const canStorePassword = async () => {
    try {
      if (!(await safeStorage.isAsyncEncryptionAvailable())) {
        return false;
      }
      if (platform === 'linux' && typeof safeStorage.getSelectedStorageBackend === 'function') {
        return !UNSAFE_LINUX_BACKENDS.has(safeStorage.getSelectedStorageBackend());
      }
      return true;
    } catch (_error) {
      return false;
    }
  };

  const encrypt = async (password) => (await safeStorage.encryptStringAsync(password)).toString('base64');

  // Alleen om een wachtwoord van 1.2.0/1.2.1 (synchrone encryptString) om te zetten; weg zodra Electron 46 hem schrapt.
  const decryptLegacy = (buffer) => {
    if (typeof safeStorage.decryptString !== 'function') {
      return '';
    }
    try {
      return safeStorage.decryptString(buffer) || '';
    } catch (_error) {
      return '';
    }
  };

  const decrypt = async (encoded) => {
    if (!encoded || !(await canStorePassword())) {
      return '';
    }
    const buffer = Buffer.from(encoded, 'base64');
    const reEncrypt = async (password) => {
      try {
        update({ password: await encrypt(password) });
      } catch (_error) {
        // lukt dat niet, dan blijft de oude versleuteling staan; volgende keer opnieuw
      }
    };
    try {
      const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(buffer);
      if (shouldReEncrypt && result) {
        await reEncrypt(result); // de sleutel is vernieuwd: anders kan het wachtwoord later onleesbaar worden
      }
      return result || '';
    } catch (_error) {
      const oud = decryptLegacy(buffer);
      if (oud) {
        await reEncrypt(oud); // bewaard door 1.2.0/1.2.1: nu omzetten naar het nieuwe formaat
        return oud;
      }
      return ''; // ander account of andere sleutelbos: dan gewoon opnieuw invullen
    }
  };

  return {
    canStorePassword,

    async load() {
      const data = read();
      return {
        nick: typeof data.nick === 'string' ? data.nick : '',
        password: await decrypt(data.password),
        autoConnect: data.autoConnect === true,
        passwordChoice: data.passwordChoice === 'never' ? 'never' : 'ask',
      };
    },

    hasSaved() {
      const data = read();
      return Boolean(data.nick || data.password);
    },

    // Voor het rechtsklikmenu: zonder het wachtwoord te ontsleutelen (op Linux kan dat een KWallet-venster geven).
    menuState() {
      const data = read();
      return { autoConnect: data.autoConnect === true, hasSaved: Boolean(data.nick || data.password) };
    },

    rememberNick(nick) {
      const clean = String(nick || '').trim();
      if (clean) {
        update({ nick: clean });
      }
    },

    async rememberPassword(password) {
      if (!password || !(await canStorePassword())) {
        return false;
      }
      update({ password: await encrypt(password), passwordChoice: 'ask' });
      return true;
    },

    setPasswordChoice(choice) {
      update({ passwordChoice: choice === 'never' ? 'never' : 'ask' });
    },

    setAutoConnect(value) {
      update({ autoConnect: Boolean(value) });
    },

    // Nickname en wachtwoord weg, en "nooit vragen" terug naar vragen. Automatisch verbinden is een voorkeur,
    // geen gegeven: die blijft staan.
    forget() {
      const { autoConnect } = read();
      write(autoConnect ? { autoConnect: true } : {});
    },
  };
};

// Het script dat in het chatframe draait. Het vult het welkomstformulier in en geeft, zodra het formulier
// verdwijnt (de chat verbindt), terug wat er als laatste verstuurd werd. Pas dan: een nickname die KiwiIRC
// afkeurt en die je daarna verbetert, wordt zo niet in zijn foute vorm onthouden.
const buildLoginScript = ({ nick = '', password = '', autoConnect = false } = {}) => `(() => new Promise((resolve) => {
  const DATA = ${JSON.stringify({ nick, password, autoConnect: Boolean(autoConnect) })};
  const setValue = (field, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const waitFor = (find, timeoutMs) => new Promise((done) => {
    const start = Date.now();
    const look = () => {
      const found = find();
      if (found) return done(found);
      if (Date.now() - start > timeoutMs) return done(null);
      setTimeout(look, 150);
    };
    look();
  });
  (async () => {
    const form = await waitFor(() => document.querySelector('form.kiwi-welcome-simple-form'), 20000);
    if (!form) return resolve({ status: 'no-form' });
    // het nicknameveld heeft GEEN type-attribuut (<input class="u-input">): input[type=text] vindt het niet
    const nickField = form.querySelector('input.u-input:not([type=password]):not([type=checkbox])');
    const passwordBox = form.querySelector('.kiwi-welcome-simple-have-password input[type=checkbox]');
    if (DATA.nick && nickField && !nickField.value) setValue(nickField, DATA.nick);
    if (DATA.password && passwordBox) {
      if (!passwordBox.checked) passwordBox.click();
      const passwordField = await waitFor(() => form.querySelector('input[type=password]'), 3000);
      if (passwordField && !passwordField.value) setValue(passwordField, DATA.password);
    }
    let last = null;
    const capture = () => {
      const passwordField = form.querySelector('input[type=password]');
      last = {
        status: 'submitted',
        nick: ((nickField && nickField.value) || '').trim(),
        password: passwordBox && passwordBox.checked && passwordField ? passwordField.value : '',
      };
    };
    form.addEventListener('submit', capture, true);
    const startButton = form.querySelector('.kiwi-welcome-simple-start');
    if (startButton) startButton.addEventListener('click', capture, true);
    // KiwiIRC verbindt: het welkomstscherm wordt weggehaald — of verborgen; beide opvangen (verborgen pas na een
    // verzending, zodat een scherm dat nog aan het opbouwen is niet als "verbonden" telt)
    const watcher = new MutationObserver(() => {
      if (!document.contains(form) || (last && form.offsetParent === null)) {
        watcher.disconnect();
        resolve(last || { status: 'gone' });
      }
    });
    watcher.observe(document.documentElement, { childList: true, subtree: true });
    if (DATA.autoConnect && DATA.nick && startButton) setTimeout(() => startButton.click(), 400);
  })();
}))()`;

module.exports = { buildLoginScript, createLoginMemory, isLoginFrameUrl };
