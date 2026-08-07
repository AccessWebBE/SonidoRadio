const { isSafeExternalUrl } = require('./policies');

const SEPARATOR = { type: 'separator' };

const flag = (value, fallback) => (value === undefined ? fallback : Boolean(value));

// Laat geen dubbele of losse scheidingslijnen aan de rand van het menu staan.
const trimSeparators = (items) => {
  const trimmed = [];

  for (const item of items) {
    const isSeparator = item.type === 'separator';
    if (isSeparator && (trimmed.length === 0 || trimmed[trimmed.length - 1].type === 'separator')) {
      continue;
    }
    trimmed.push(item);
  }

  while (trimmed.length > 0 && trimmed[trimmed.length - 1].type === 'separator') {
    trimmed.pop();
  }

  return trimmed;
};

const buildContextMenuTemplate = (params = {}) => {
  const editFlags = params.editFlags || {};
  const hasSelection = Boolean((params.selectionText || '').trim());
  const items = [];

  if (params.linkURL && isSafeExternalUrl(params.linkURL)) {
    items.push(
      { id: 'open-link', label: 'Link openen in browser' },
      { id: 'copy-link', label: 'Linkadres kopiëren' },
      SEPARATOR,
    );
  }

  if (params.mediaType === 'image' && params.srcURL) {
    items.push(
      { id: 'copy-image', role: 'copyImage', label: 'Afbeelding kopiëren' },
      { id: 'copy-image-address', label: 'Afbeeldingsadres kopiëren' },
      SEPARATOR,
    );
  }

  if (params.isEditable) {
    items.push(
      { id: 'undo', role: 'undo', label: 'Ongedaan maken', enabled: flag(editFlags.canUndo, false) },
      { id: 'redo', role: 'redo', label: 'Opnieuw', enabled: flag(editFlags.canRedo, false) },
      SEPARATOR,
      { id: 'cut', role: 'cut', label: 'Knippen', enabled: flag(editFlags.canCut, hasSelection) },
    );
  }

  items.push({
    id: 'copy',
    role: 'copy',
    label: 'Kopiëren',
    enabled: flag(editFlags.canCopy, hasSelection),
  });

  if (params.isEditable) {
    items.push({
      id: 'paste',
      role: 'paste',
      label: 'Plakken',
      enabled: flag(editFlags.canPaste, true),
    });
  }

  items.push(SEPARATOR, {
    id: 'select-all',
    role: 'selectAll',
    label: 'Alles selecteren',
    enabled: flag(editFlags.canSelectAll, true),
  });

  return trimSeparators(items);
};

const createClickHandler = (id, params, { clipboard, openExternal }) => {
  switch (id) {
    case 'open-link':
      return () => openExternal(params.linkURL);
    case 'copy-link':
      return () => clipboard.writeText(params.linkURL);
    case 'copy-image-address':
      return () => clipboard.writeText(params.srcURL);
    default:
      return null;
  }
};

const toMenuItems = (template, params, { clipboard, openExternal }) =>
  template.map((item) => {
    if (item.type === 'separator') {
      return { type: 'separator' };
    }

    const { id, ...menuItem } = item;
    const click = createClickHandler(id, params, { clipboard, openExternal });
    return click ? { ...menuItem, click } : menuItem;
  });

const configureContextMenu = (window, { Menu, clipboard, openExternal }) => {
  window.webContents.on('context-menu', (_event, params) => {
    if (window.isDestroyed()) {
      return;
    }

    const template = toMenuItems(buildContextMenuTemplate(params), params, {
      clipboard,
      openExternal,
    });

    if (template.length === 0) {
      return;
    }

    Menu.buildFromTemplate(template).popup({ window, x: params.x, y: params.y });
  });
};

module.exports = { buildContextMenuTemplate, configureContextMenu, toMenuItems };
