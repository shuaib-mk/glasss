import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminSessionCookie, isAdminAuthenticated, verifyAdminPassword } from './adminAuth.js';
import { buildSystemPrompt, decryptSecret, encryptSecret, maskApiKey } from './adminConfig.js';

test('admin sessions are server-signed and HttpOnly', () => {
  const previousPassword = process.env.ADMIN_PASSWORD;
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_PASSWORD = 'test-admin-password';
  process.env.ADMIN_SESSION_SECRET = 'test-session-secret-that-is-long-enough';

  try {
    const request = { headers: { host: 'localhost:3001' }, ip: '127.0.0.1' };
    assert.equal(verifyAdminPassword(request, 'test-admin-password'), true);
    const cookie = createAdminSessionCookie(request);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.equal(isAdminAuthenticated({ headers: { cookie } }), true);
  } finally {
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
    if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previousSecret;
  }
});

test('stored provider keys are encrypted and only returned masked', () => {
  const previousKey = process.env.CONFIG_ENCRYPTION_KEY;
  process.env.CONFIG_ENCRYPTION_KEY = 'test-encryption-secret-that-is-different';
  try {
    const apiKey = 'gsk_example_api_key_1234567890';
    const encrypted = encryptSecret(apiKey);
    assert.notEqual(encrypted.includes(apiKey), true);
    assert.equal(decryptSecret(encrypted), apiKey);
    assert.equal(maskApiKey(apiKey), 'gsk_••••••••7890');
  } finally {
    if (previousKey === undefined) delete process.env.CONFIG_ENCRYPTION_KEY;
    else process.env.CONFIG_ENCRYPTION_KEY = previousKey;
  }
});

test('creator identity is injected into the server prompt', () => {
  const prompt = buildSystemPrompt({
    assistantName: 'Sunni AI',
    creatorName: 'New Developer',
    creatorDetails: 'Builds educational tools.',
    systemPrompt: 'Be concise.'
  });
  assert.match(prompt, /created by New Developer/);
  assert.match(prompt, /Builds educational tools/);
  assert.match(prompt, /Be concise/);
});
