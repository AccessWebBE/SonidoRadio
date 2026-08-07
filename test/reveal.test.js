const test = require('node:test');
const assert = require('node:assert/strict');
const { createRevealScheduler } = require('../src/reveal');

// Nagebootste klok en timers, zodat de test niet echt hoeft te wachten.
const createClock = () => {
  let tijd = 0;
  const geplande = [];

  return {
    now: () => tijd,
    setTimeoutFn: (callback, delay) => {
      const taak = { callback, at: tijd + delay, geannuleerd: false };
      geplande.push(taak);
      return taak;
    },
    clearTimeoutFn: (taak) => {
      if (taak) {
        taak.geannuleerd = true;
      }
    },
    // Zet de klok vooruit en voer alles uit wat in die periode zou afgaan.
    verstrijk: (ms) => {
      const doel = tijd + ms;
      for (;;) {
        const volgende = geplande
          .filter((taak) => !taak.geannuleerd && taak.at <= doel)
          .sort((a, b) => a.at - b.at)[0];
        if (!volgende) {
          break;
        }
        volgende.geannuleerd = true;
        tijd = volgende.at;
        volgende.callback();
      }
      tijd = doel;
    },
  };
};

const opstelling = (options = {}) => {
  const klok = createClock();
  let getoond = 0;
  const scheduler = createRevealScheduler({
    minDelayMs: 1_000,
    maxDelayMs: 4_000,
    reveal: () => {
      getoond += 1;
    },
    now: klok.now,
    setTimeoutFn: klok.setTimeoutFn,
    clearTimeoutFn: klok.clearTimeoutFn,
    ...options,
  });

  return { klok, scheduler, aantalKeerGetoond: () => getoond };
};

test('houdt de splash minstens de ondergrens in beeld', () => {
  const { klok, scheduler, aantalKeerGetoond } = opstelling();

  // Windows: ready-to-show komt al na een halve seconde.
  klok.verstrijk(500);
  scheduler.request();
  assert.equal(aantalKeerGetoond(), 0, 'mag nog niet flitsen');

  klok.verstrijk(499);
  assert.equal(aantalKeerGetoond(), 0);

  klok.verstrijk(1);
  assert.equal(aantalKeerGetoond(), 1, 'precies op de ondergrens');
});

test('toont meteen zodra de ondergrens al voorbij is', () => {
  const { klok, scheduler, aantalKeerGetoond } = opstelling();

  klok.verstrijk(1_500);
  scheduler.request();

  assert.equal(aantalKeerGetoond(), 1);
});

test('valt terug op de noodtermijn als geen enkel signaal komt', () => {
  const { klok, aantalKeerGetoond } = opstelling();

  // Linux: ready-to-show vuurt nooit bij een verborgen venster.
  klok.verstrijk(3_999);
  assert.equal(aantalKeerGetoond(), 0);

  klok.verstrijk(1);
  assert.equal(aantalKeerGetoond(), 1);
});

test('toont het venster hoogstens één keer', () => {
  const { klok, scheduler, aantalKeerGetoond } = opstelling();

  klok.verstrijk(300);
  scheduler.request(); // did-finish-load
  klok.verstrijk(300);
  scheduler.request(); // ready-to-show
  klok.verstrijk(5_000); // en de noodtermijn
  scheduler.request();

  assert.equal(aantalKeerGetoond(), 1);
});

test('toont niets meer na annuleren', () => {
  const { klok, scheduler, aantalKeerGetoond } = opstelling();

  scheduler.cancel();
  scheduler.request();
  klok.verstrijk(10_000);

  assert.equal(aantalKeerGetoond(), 0);
});

test('laat de noodtermijn niet alsnog afgaan na een vroeg signaal', () => {
  const { klok, scheduler, aantalKeerGetoond } = opstelling();

  klok.verstrijk(400);
  scheduler.request();
  klok.verstrijk(10_000);

  assert.equal(aantalKeerGetoond(), 1);
});
