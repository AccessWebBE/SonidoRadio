<div align="center">
  <img src="build/icon.png" alt="Sonido" width="128" />

  # Sonido

  ### De desktop-app voor de Sonido Radio WebChat

  Chatten én je webcam gebruiken in één handig venster — zonder gedoe met je browser.

  [![Download](https://img.shields.io/github/v/release/AccessWebBE/SonidoRadio?label=download&sort=semver&color=5b21b6)](https://github.com/AccessWebBE/SonidoRadio/releases/latest)
  [![Downloads](https://img.shields.io/github/downloads/AccessWebBE/SonidoRadio/total?color=2563eb)](https://github.com/AccessWebBE/SonidoRadio/releases)
  [![Licentie: MIT](https://img.shields.io/badge/licentie-MIT-blue.svg)](LICENSE)
</div>

---

## 👋 Wat is dit?

**Sonido** is een gratis app voor **Windows** en **Linux** waarmee je rechtstreeks naar de **Sonido Radio WebChat** gaat — de live chat van Sonido Radio waar luisteraars samenkomen.

De chat draait op **BoxyChat** (`boxychat.be` · `chattersnet.nl`), het chatplatform dat wij zelf mee beheren. In een gewone webbrowser wil het aanzetten van je **webcam** wel eens weigeren. Deze app opent de chat in een eigen venster waar de **webcam gewoon werkt**. Verder hoef je niks te weten: **installeren en chatten maar.** 🎉

---

## ⬇️ Downloaden & installeren

Ga naar de **[downloadpagina](https://github.com/AccessWebBE/SonidoRadio/releases/latest)** en kies het bestand voor jouw computer.

### 🪟 Windows

1. Download **`Sonido-Setup-x.y.z.exe`**.
2. Dubbelklik het gedownloade bestand.
3. Zie je een blauw venster *"Windows heeft je pc beschermd"*? Dat is normaal (de app is nog niet officieel ondertekend). Klik op **Meer informatie** → **Toch uitvoeren**. Dit hoeft maar één keer.
4. Volg de installatie. Klaar! Sonido staat nu op je **bureaublad** en in je **Start-menu**.

### 🐧 Linux

**De makkelijkste manier (werkt op elke distributie) — AppImage:**

1. Download **`Sonido-x.y.z.AppImage`**.
2. Maak het bestand uitvoerbaar: rechtsklik → *Eigenschappen* → vinkje **"Uitvoeren toestaan"** (of in een terminal: `chmod +x Sonido-*.AppImage`).
3. Dubbelklik om te starten. Geen installatie nodig.

**Gebruik je Debian, Ubuntu of Linux Mint?** Dan kan het ook via het `.deb`-pakket (dan verschijnt Sonido netjes in je menu):

```bash
sudo apt install ./Sonido-x.y.z.deb
```

---

## ❓ Veelgestelde vragen

**Werkt mijn webcam?**
Ja — dat is nu net waarvoor deze app bestaat. 📹

**En mijn microfoon?**
Nee, die staat bewust uit. Sonido is een radio, dus de chat gebruikt geen microfoons.

**Is het veilig?**
Ja. De app is open source (je kunt alle code hieronder inkijken), opent enkel de Sonido Radio-chat, en geeft enkel je camera vrij — verder niks (geen locatie, geen meldingen, geen scherm delen).

**Waarom die waarschuwing bij het installeren op Windows?**
Omdat de app nog niet "code-signed" is. Dat is een (betalende/aan te vragen) digitale handtekening die we later toevoegen. Zolang je downloadt van de officiële downloadpagina hierboven, zit je goed.

**Hoe krijg ik updates?**
Sonido controleert automatisch op nieuwe officiële releases. Zodra een update klaarstaat, kun je meteen herstarten of ze automatisch laten installeren wanneer je de app afsluit. De gewone Windows-installer werkt ook als upgrade en behoudt je bestaande installatie.

**Kost het iets?**
Nee, helemaal gratis.

---

## ✨ In het kort

- 📹 **Webcam werkt** — meteen, zonder browser-gedoe.
- 🔇 **Geen microfoon** — bewust uitgeschakeld.
- 🔒 **Enkel de chat** — alleen `*.chattersnet.nl` mag je camera; al de rest wordt geweigerd.
- 🪶 **Licht & simpel** — één venster, native op Windows en Linux.
- 💸 **Gratis & open source.**

---

## 🛠️ Zelf bouwen (voor ontwikkelaars)

Wil je de app vanuit de broncode bouwen? Je hebt [Node.js](https://nodejs.org) 20 of hoger nodig.

```bash
git clone https://github.com/AccessWebBE/SonidoRadio.git
cd SonidoRadio
npm install

npm start          # de app draaien vanuit de broncode
npm run dist:linux # AppImage + .deb bouwen  → in de map release/
npm run dist:win   # Windows-installer bouwen (op Windows, of via Wine)
```

Nieuwe officiële releases worden automatisch gebouwd door GitHub Actions (Windows- én Linux-installers) zodra er een versie-tag `vX.Y.Z` gepusht wordt.

---

## 📄 Licentie

[MIT](LICENSE) © AccessWebBE (Jellis Onsea)

Sonido Radio, **BoxyChat** en **chattersnet.nl** worden (mede) beheerd door AccessWebBE / Jellis Onsea.
Deze app is een eenvoudige desktop-schil rond de publieke Sonido Radio WebChat.
