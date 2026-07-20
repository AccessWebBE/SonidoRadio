const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isAllowedChatUrl,
  isCameraCheck,
  isCameraRequest,
  isSafeExternalUrl,
} = require('../src/policies');

test('staat alleen HTTPS-navigatie op de exacte chat-hosts toe', () => {
  assert.equal(isAllowedChatUrl('https://boxy.chattersnet.nl/chatbox/sonidoradio'), true);
  assert.equal(isAllowedChatUrl('https://chameleon.chattersnet.nl/'), true);
  assert.equal(isAllowedChatUrl('http://boxy.chattersnet.nl/'), false);
  assert.equal(isAllowedChatUrl('https://evil.boxy.chattersnet.nl/'), false);
  assert.equal(isAllowedChatUrl('geen-url'), false);
});

test('opent alleen normale web- en mail-links extern', () => {
  assert.equal(isSafeExternalUrl('https://www.sonidoradio.nl'), true);
  assert.equal(isSafeExternalUrl('http://example.com'), true);
  assert.equal(isSafeExternalUrl('mailto:info@example.com'), true);
  assert.equal(isSafeExternalUrl('file:///tmp/test'), false);
  assert.equal(isSafeExternalUrl('javascript:alert(1)'), false);
});

test('staat uitsluitend camera-aanvragen zonder audio toe', () => {
  assert.equal(isCameraRequest('media', { mediaTypes: ['video'] }), true);
  assert.equal(isCameraRequest('media', { mediaTypes: ['video', 'audio'] }), false);
  assert.equal(isCameraRequest('media', { mediaTypes: ['audio'] }), false);
  assert.equal(isCameraRequest('media', {}), false);
  assert.equal(isCameraRequest('notifications', { mediaTypes: ['video'] }), false);
});

test('keurt bij permission checks alleen video goed', () => {
  assert.equal(isCameraCheck('media', { mediaType: 'video' }), true);
  assert.equal(isCameraCheck('media', { mediaType: 'audio' }), false);
  assert.equal(isCameraCheck('media', { mediaType: 'unknown' }), false);
  assert.equal(isCameraCheck('geolocation', { mediaType: 'video' }), false);
});
