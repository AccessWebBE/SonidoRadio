// Onthoudt het volume van de radiospeler op de chatpagina.
//
// De speler van BoxyChat leest bij het starten zijn beginvolume uit localStorage
// (`chammy_player_<chatbox-id>_volume`, standaard 0.7). Die waarde verandert alleen via de schuif in de
// spelerinstellingen; de volumebalk in de speler zelf past het geluid aan maar bewaart niets. Na een herstart
// stond het volume daardoor altijd weer op de beginwaarde, in elke browser.
//
// Dit script luistert naar volumewijzigingen van het audio-element van de radio en schrijft ze weg onder die
// sleutel. De pagina neemt de waarde bij de volgende start zelf over, ook in haar instellingenschuif.

const PLAYER_HOST = 'boxy.chattersnet.nl';
const PLAYER_PATH = '/chatbox/';

const isPlayerPageUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === PLAYER_HOST && url.pathname.startsWith(PLAYER_PATH);
  } catch (_error) {
    return false;
  }
};

// Resultaat: 'actief', 'al-actief' (tweede keer in hetzelfde document) of 'geen-chatbox'.
const buildVolumeScript = () => `(() => {
  if (window.__sonidoVolumeMemory) return 'al-actief';
  const chatboxFrom = (page) => page && page.props && page.props.chatbox && page.props.chatbox.id;
  const readId = () => {
    const holder = document.querySelector('[data-page]');
    if (holder) {
      try {
        const id = chatboxFrom(JSON.parse(holder.getAttribute('data-page')));
        if (Number.isInteger(id)) return id;
      } catch (_error) {}
    }
    // Inertia bewaart de pagina ook in de geschiedenis, voor het geval het attribuut weg is
    const id = chatboxFrom(window.history.state && window.history.state.page);
    return Number.isInteger(id) ? id : null;
  };
  const id = readId();
  if (id === null) return 'geen-chatbox';
  const key = 'chammy_player_' + id + '_volume';
  window.__sonidoVolumeMemory = true;
  // volumechange bubbelt niet; in de capturefase komt hij toch langs het document
  document.addEventListener('volumechange', (event) => {
    const audio = event.target;
    // alleen de radio: niet de spraakchat of de webcams
    if (!(audio instanceof HTMLAudioElement) || !audio.closest('.radio-player')) return;
    // dempen zet het volume op 0: niet onthouden, anders start de radio de volgende keer zonder geluid
    if (audio.muted || !(audio.volume > 0)) return;
    try {
      localStorage.setItem(key, String(Math.round(audio.volume * 100) / 100));
    } catch (_error) {}
  }, true);
  return 'actief';
})()`;

module.exports = { buildVolumeScript, isPlayerPageUrl };
