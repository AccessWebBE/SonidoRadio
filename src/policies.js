const CHAT_URL = 'https://boxy.chattersnet.nl/chatbox/sonidoradio';
const CHAT_HOSTS = new Set(['boxy.chattersnet.nl', 'chameleon.chattersnet.nl']);
const EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);

const parseUrl = (value) => {
  try {
    return new URL(value);
  } catch (_error) {
    return null;
  }
};

const isAllowedChatUrl = (value) => {
  const url = parseUrl(value);
  return Boolean(url && url.protocol === 'https:' && CHAT_HOSTS.has(url.hostname));
};

const isSafeExternalUrl = (value) => {
  const url = parseUrl(value);
  return Boolean(url && EXTERNAL_PROTOCOLS.has(url.protocol));
};

const isCameraRequest = (permission, details = {}) => {
  const mediaTypes = details.mediaTypes;
  return (
    permission === 'media' &&
    Array.isArray(mediaTypes) &&
    mediaTypes.length > 0 &&
    mediaTypes.every((type) => type === 'video')
  );
};

const isCameraCheck = (permission, details = {}) => {
  return permission === 'media' && details.mediaType === 'video';
};

module.exports = {
  CHAT_URL,
  isAllowedChatUrl,
  isCameraCheck,
  isCameraRequest,
  isSafeExternalUrl,
};
