// Altijd de nieuwste versie van de chat, zonder elke start alles opnieuw te downloaden.
//
// BoxyChat laat zijn pagina bij elke start opnieuw ophalen en geeft zijn scripts een versienummer in de naam: een
// nieuwe BoxyChat komt dus vanzelf binnen. Wat wel kan blijven hangen: onderdelen zonder versienummer (thema's van
// KiwiIRC, die mogen een uur in de cache), en een service worker of Cache Storage als BoxyChat die ooit gebruikt.
//
// Daarom leegt Sonido de cache alleen (Jellis, 24-11-2026):
//   - na een update van Sonido zelf (de eerste start met een andere versie, ook de eerste start van 1.2.3),
//   - als Sonido lang niet geopend is (MAX_IDLE_MS),
//   - en als de gebruiker rechtsklikt op "Chat herladen (nieuwste versie)".
//
// Bewust NIET gewist: cookies, localStorage (volume van de radio, instellingen van de chat), IndexedDB en het eigen
// login.json met de onthouden nickname. Dat is wat de gebruiker heeft ingesteld, geen verouderde code.

const STALE_STORAGES = ['serviceworkers', 'cachestorage'];
const MAX_IDLE_MS = 7 * 24 * 60 * 60 * 1000; // "lang niet geopend": een week
const STATE_FILE = 'chat-cache.json';

// Waarom de cache nu geleegd moet worden, of null als het niet hoeft. state = wat de vorige start bewaarde.
const reasonToClear = (state, { version, now, maxIdleMs = MAX_IDLE_MS }) => {
  if (!state || typeof state.version !== 'string' || !Number.isFinite(state.lastSeenAt)) {
    return 'eerste start met deze opruiming';
  }
  if (state.version !== version) {
    return `nieuwe versie ${state.version} → ${version}`;
  }
  if (now - state.lastSeenAt > maxIdleMs) {
    return `${Math.floor((now - state.lastSeenAt) / (24 * 60 * 60 * 1000))} dagen niet geopend`;
  }
  return null;
};

const createCacheState = ({ file, fs, path }) => ({
  read() {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    } catch (_error) {
      return null;
    }
  },
  write(version, now) {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ version, lastSeenAt: now }));
    } catch (_error) {
      // niet kunnen schrijven: dan wordt de cache de volgende keer gewoon nog eens geleegd
    }
  },
});

// Nooit gooien: lukt het opruimen niet, dan laadt de chat gewoon zoals vroeger.
const clearStaleContent = async (session, log = null) => {
  const result = { cacheBytes: null, cleared: false };
  try {
    if (typeof session.getCacheSize === 'function') {
      result.cacheBytes = await session.getCacheSize();
    }
    await session.clearCache();
    await session.clearStorageData({ storages: STALE_STORAGES });
    result.cleared = true;
  } catch (error) {
    if (log) {
      log.warn(`Cache van de chat legen lukte niet (${error && error.message})`);
    }
  }
  return result;
};

module.exports = { MAX_IDLE_MS, STALE_STORAGES, STATE_FILE, clearStaleContent, createCacheState, reasonToClear };
