import assert from 'node:assert/strict';
import test from 'node:test';
import { providerAccess, voiceAccess } from '../agent/provider-access';

test('one portal key configures all three SDK transports', () => {
  const access = providerAccess({SVIAM_ASSIGNMENT_KEY:'test-key',SVIAM_GATEWAY_URL:'https://gateway.example/hiring/starter/gateway/'});
  assert.equal(access.openai.baseURL,'https://gateway.example/hiring/starter/gateway/openai/v1');
  assert.equal(access.deepgram.baseUrl,'wss://gateway.example/hiring/starter/gateway/deepgram');
  assert.equal(access.elevenlabs.baseURL,'https://gateway.example/hiring/starter/gateway/elevenlabs/v1');
  assert.equal(access.openai.apiKey,access.deepgram.apiKey);
});
test('rejects insecure remote gateway URLs and URL credentials', () => {
  for (const url of ['http://example.com','https://user:secret@example.com','https://example.com?key=secret']) {
    assert.throws(() => providerAccess({SVIAM_ASSIGNMENT_KEY:'test',SVIAM_GATEWAY_URL:url}));
  }
});

test('web and agent voice validation accept only the downloaded pack credentials', () => {
  const pack = { SVIAM_ASSIGNMENT_KEY: 'personal-key', SVIAM_GATEWAY_URL: 'https://gateway.example', ELEVEN_VOICE_ID: 'supplied-voice' };
  const access = voiceAccess(pack);
  assert.equal(access.openai.apiKey, pack.SVIAM_ASSIGNMENT_KEY);
  assert.equal(access.voiceId, pack.ELEVEN_VOICE_ID);
  assert.throws(() => voiceAccess({ ...pack, ELEVEN_VOICE_ID: '' }), /ELEVEN_VOICE_ID/);
  assert.throws(() => voiceAccess({ ...pack, SVIAM_ASSIGNMENT_KEY: '' }), /OPENAI_API_KEY/);
  assert.equal(voiceAccess({ OPENAI_API_KEY: 'own-model', DEEPGRAM_API_KEY: 'own-stt', ELEVEN_API_KEY: 'own-tts', ELEVEN_VOICE_ID: 'own-voice' }).voiceId, 'own-voice');
});
