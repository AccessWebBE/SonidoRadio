const test = require('node:test');
const assert = require('node:assert/strict');
const { buildContextMenuTemplate, toMenuItems } = require('../src/context-menu');

const idsOf = (template) => template.filter((item) => item.id).map((item) => item.id);
const find = (template, id) => template.find((item) => item.id === id);

test('toont in een invoerveld de volledige bewerkingsopties', () => {
  const template = buildContextMenuTemplate({
    isEditable: true,
    selectionText: 'hallo',
    editFlags: {
      canUndo: true,
      canRedo: false,
      canCut: true,
      canCopy: true,
      canPaste: true,
      canSelectAll: true,
    },
  });

  assert.deepEqual(idsOf(template), [
    'undo',
    'redo',
    'cut',
    'copy',
    'paste',
    'select-all',
  ]);
  assert.equal(find(template, 'copy').role, 'copy');
  assert.equal(find(template, 'paste').role, 'paste');
  assert.equal(find(template, 'redo').enabled, false);
});

test('toont buiten een invoerveld geen knippen of plakken', () => {
  const template = buildContextMenuTemplate({
    isEditable: false,
    selectionText: 'gekozen tekst',
    editFlags: { canCopy: true, canSelectAll: true },
  });

  assert.deepEqual(idsOf(template), ['copy', 'select-all']);
});

test('schakelt kopiëren uit zonder selectie', () => {
  const template = buildContextMenuTemplate({ isEditable: false, selectionText: '   ' });

  assert.equal(find(template, 'copy').enabled, false);
  assert.equal(find(template, 'select-all').enabled, true);
});

test('voegt linkopties toe voor veilige links en laat onveilige weg', () => {
  const veilig = buildContextMenuTemplate({ linkURL: 'https://www.sonidoradio.nl' });
  assert.deepEqual(idsOf(veilig), ['open-link', 'copy-link', 'copy', 'select-all']);

  const onveilig = buildContextMenuTemplate({ linkURL: 'javascript:alert(1)' });
  assert.deepEqual(idsOf(onveilig), ['copy', 'select-all']);
});

test('voegt afbeeldingsopties toe bij een afbeelding', () => {
  const template = buildContextMenuTemplate({
    mediaType: 'image',
    srcURL: 'https://boxy.chattersnet.nl/smiley.png',
  });

  assert.deepEqual(idsOf(template), ['copy-image', 'copy-image-address', 'copy', 'select-all']);
  assert.equal(find(template, 'copy-image').role, 'copyImage');
});

test('laat geen losse of dubbele scheidingslijnen aan de randen staan', () => {
  const template = buildContextMenuTemplate({ isEditable: true, editFlags: {} });

  assert.notEqual(template[0].type, 'separator');
  assert.notEqual(template[template.length - 1].type, 'separator');
  template.forEach((item, index) => {
    if (index > 0 && item.type === 'separator') {
      assert.notEqual(template[index - 1].type, 'separator');
    }
  });
});

test('koppelt klik-acties aan de link- en afbeeldingsitems', () => {
  const params = {
    linkURL: 'https://www.sonidoradio.nl',
    mediaType: 'image',
    srcURL: 'https://boxy.chattersnet.nl/smiley.png',
    isEditable: true,
    editFlags: { canCopy: true, canPaste: true },
  };

  const gekopieerd = [];
  const geopend = [];
  const items = toMenuItems(buildContextMenuTemplate(params), params, {
    clipboard: { writeText: (value) => gekopieerd.push(value) },
    openExternal: (value) => geopend.push(value),
  });

  const byLabel = (label) => items.find((item) => item.label === label);

  byLabel('Link openen in browser').click();
  byLabel('Linkadres kopiëren').click();
  byLabel('Afbeeldingsadres kopiëren').click();

  assert.deepEqual(geopend, ['https://www.sonidoradio.nl']);
  assert.deepEqual(gekopieerd, [
    'https://www.sonidoradio.nl',
    'https://boxy.chattersnet.nl/smiley.png',
  ]);

  // Kopiëren en plakken laten we door Electron zelf afhandelen via hun role.
  assert.equal(byLabel('Kopiëren').click, undefined);
  assert.equal(byLabel('Plakken').click, undefined);
  assert.equal(byLabel('Plakken').role, 'paste');
  assert.ok(items.some((item) => item.type === 'separator'));
  assert.ok(items.every((item) => item.id === undefined));
});

test('toont de aanmelditems alleen als de app ze aanlevert', () => {
  assert.equal(idsOf(buildContextMenuTemplate({})).includes('auto-connect'), false);
  const met = buildContextMenuTemplate({}, { autoConnect: true, hasSaved: false });
  assert.deepEqual(idsOf(met).slice(-2), ['auto-connect', 'forget-login']);
  assert.equal(find(met, 'auto-connect').type, 'checkbox');
  assert.equal(find(met, 'auto-connect').checked, true);
  assert.equal(find(met, 'forget-login').enabled, false, 'niets opgeslagen: vergeten uitgeschakeld');
});

test('de aanmelditems roepen de juiste acties aan', () => {
  const gedaan = [];
  const login = { setAutoConnect: (v) => gedaan.push(['auto', v]), forget: () => gedaan.push(['vergeten']) };
  const template = buildContextMenuTemplate({}, { autoConnect: false, hasSaved: true });
  const items = toMenuItems(template, {}, { clipboard: {}, openExternal: () => {}, login });
  items.find((i) => i.label === 'Automatisch verbinden').click({ checked: true });
  items.find((i) => i.label === 'Opgeslagen nickname en wachtwoord vergeten').click();
  assert.deepEqual(gedaan, [['auto', true], ['vergeten']]);
});

test('kopiëren werkt met de asynchrone clipboard van Electron 44+, ook als het mislukt', async () => {
  const params = { linkURL: 'https://www.sonidoradio.nl', editFlags: {} };
  const gekopieerd = [];
  const goed = toMenuItems(buildContextMenuTemplate(params), params, {
    clipboard: { writeText: async (value) => { gekopieerd.push(value); } },
    openExternal: () => {},
  });
  await goed.find((item) => item.label === 'Linkadres kopiëren').click();
  assert.deepEqual(gekopieerd, ['https://www.sonidoradio.nl']);

  const fouten = [];
  const origineel = console.error;
  console.error = (...args) => fouten.push(args.join(' '));
  try {
    const mislukt = toMenuItems(buildContextMenuTemplate(params), params, {
      clipboard: { writeText: () => Promise.reject(new Error('klembord bezet')) },
      openExternal: () => {},
    });
    // geen onafgehandelde afwijzing: de klik geeft een Promise die gewoon afloopt
    await mislukt.find((item) => item.label === 'Linkadres kopiëren').click();
    const gooit = toMenuItems(buildContextMenuTemplate(params), params, {
      clipboard: { writeText: () => { throw new Error('klembord weg'); } },
      openExternal: () => {},
    });
    await gooit.find((item) => item.label === 'Linkadres kopiëren').click();
  } finally {
    console.error = origineel;
  }
  assert.equal(fouten.length, 2, 'beide mislukkingen worden gelogd, niet doorgegooid');
});

test('"Chat herladen (nieuwste versie)" staat onderaan en roept de herlaadfunctie aan', () => {
  const params = { editFlags: {} };
  const zonder = buildContextMenuTemplate(params, null);
  assert.equal(zonder.some((item) => item.id === 'reload-chat'), false, 'zonder herlaadfunctie geen item');

  const met = buildContextMenuTemplate(params, { autoConnect: false, hasSaved: false }, { reload: true });
  assert.equal(met[met.length - 1].id, 'reload-chat');
  assert.equal(met[met.length - 2].type, 'separator');

  let herladen = 0;
  const items = toMenuItems(met, params, { clipboard: {}, openExternal: () => {}, reloadChat: () => { herladen += 1; } });
  items.find((item) => item.label === 'Chat herladen (nieuwste versie)').click();
  assert.equal(herladen, 1);
});
