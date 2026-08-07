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
