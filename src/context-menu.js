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

// login: { autoConnect, hasSaved } — de onthouden aanmeldgegevens (zie login-memory.js); weglaten = geen items.
const buildContextMenuTemplate = (params = {}, login = null) => {
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

  if (login) {
    items.push(
      SEPARATOR,
      {
        id: 'auto-connect',
        type: 'checkbox',
        label: 'Automatisch verbinden',
        checked: Boolean(login.autoConnect),
      },
      {
        id: 'forget-login',
        label: 'Opgeslagen nickname en wachtwoord vergeten',
        enabled: Boolean(login.hasSaved),
      },
    );
  }

  return trimSeparators(items);
};

const createClickHandler = (id, params, { clipboard, openExternal, login }) => {
  switch (id) {
    case 'auto-connect':
      return login ? (menuItem) => login.setAutoConnect(menuItem.checked) : null;
    case 'forget-login':
      return login ? () => login.forget() : null;
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

const toMenuItems = (template, params, { clipboard, openExternal, login }) =>
  template.map((item) => {
    if (item.type === 'separator') {
      return { type: 'separator' };
    }

    const { id, ...menuItem } = item;
    const click = createClickHandler(id, params, { clipboard, openExternal, login });
    return click ? { ...menuItem, click } : menuItem;
  });

// login (optioneel): { getState() → { autoConnect, hasSaved }, setAutoConnect(bool), forget() }
const configureContextMenu = (window, { Menu, clipboard, openExternal, login }) => {
  window.webContents.on('context-menu', (_event, params) => {
    if (window.isDestroyed()) {
      return;
    }

    const template = toMenuItems(buildContextMenuTemplate(params, login ? login.getState() : null), params, {
      clipboard,
      openExternal,
      login,
    });

    if (template.length === 0) {
      return;
    }

    Menu.buildFromTemplate(template).popup({ window, x: params.x, y: params.y });
  });
};

module.exports = { buildContextMenuTemplate, configureContextMenu, toMenuItems };
