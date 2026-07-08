<div align="center">
  <img src="build/icon.png" alt="Sonido" width="120" />

  # Sonido

  **De Sonido Radio webchat als desktop-app voor Windows en Linux — met webcam-ondersteuning.**

  [![Release](https://img.shields.io/github/v/release/AccessWebBE/SonidoRadio?label=download&sort=semver)](https://github.com/AccessWebBE/SonidoRadio/releases/latest)
  [![Downloads](https://img.shields.io/github/downloads/AccessWebBE/SonidoRadio/total)](https://github.com/AccessWebBE/SonidoRadio/releases)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
</div>

---

Een lichte desktop-schil rond de [Sonido Radio webchat](https://boxy.chattersnet.nl/chatbox/sonidoradio) (BoxyChat).
De app opent de chat in een eigen venster en geeft de webcam vrij, zodat je niet meer via de browser hoeft en cam gewoon werkt.

## ⬇️ Downloaden & installeren

Ga naar de **[Releases-pagina](https://github.com/AccessWebBE/SonidoRadio/releases/latest)** en kies het bestand voor jouw systeem:

| Systeem | Bestand | Installeren |
| --- | --- | --- |
| **Windows** | `Sonido-Setup-x.y.z.exe` | Dubbelklik en volg de installer. Snelkoppeling verschijnt op je bureaublad en in het Start-menu. |
| **Linux (universeel)** | `Sonido-x.y.z.AppImage` | Uitvoerbaar maken (`chmod +x Sonido-*.AppImage`) en dubbelklikken/uitvoeren. Geen installatie nodig. |
| **Linux (Debian/Ubuntu)** | `Sonido-x.y.z.deb` | `sudo apt install ./Sonido-*.deb` — verschijnt daarna in je applicatiemenu. |

### Windows: SmartScreen-melding
De installer is (nog) niet code-signed. Windows kan bij de eerste keer *"Windows heeft je pc beschermd"* tonen → klik **Meer informatie → Toch uitvoeren**. Dit is eenmalig.

### Linux: AppImage uitvoerbaar maken
```bash
chmod +x Sonido-*.AppImage
./Sonido-*.AppImage
```

## ✨ Kenmerken

- 📹 **Webcam werkt** — de app geeft camera-toegang vrij voor de chat.
- 🔇 **Geen microfoon** — bewust uitgeschakeld (radio speelt; de chat gebruikt geen mics).
- 🔒 **Alleen de chat** — enkel `*.chattersnet.nl` mag camera; alle andere permissies (locatie, meldingen, scherm delen) worden geweigerd.
- 🪶 **Licht** — één venster, native op Windows en Linux (Electron).

## 🛠️ Zelf bouwen (vanuit de broncode)

Vereist: [Node.js](https://nodejs.org) 20+.

```bash
git clone https://github.com/AccessWebBE/SonidoRadio.git
cd SonidoRadio
npm install

npm start          # de app draaien vanuit de broncode
npm run dist:linux # AppImage + .deb bouwen (in release/)
npm run dist:win   # Windows-installer bouwen (op Windows, of via Wine)
```

De installers komen in de map `release/`.

## 🤖 Releases

Nieuwe releases worden automatisch gebouwd door GitHub Actions: een tag `vX.Y.Z` pushen bouwt de
Windows- én Linux-installers op de juiste runners en hangt ze aan een GitHub Release.

```bash
npm version patch      # of minor / major — bumpt versie + maakt de tag
git push --follow-tags
```

## 📄 Licentie

[MIT](LICENSE) © AccessWebBE (Jellis Onsea)

Sonido Radio en de chat-dienst (chattersnet.nl / BoxyChat) zijn eigendom van hun respectieve eigenaars;
deze app is enkel een desktop-schil rond de publieke webchat.
