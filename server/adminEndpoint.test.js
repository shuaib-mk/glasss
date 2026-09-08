import test from 'node:test';
import assert from 'node:assert/strict';
import app from './index.js';

test('admin login creates a session without exposing the Groq key', async () => {
  const previous = {
    password: process.env.ADMIN_PASSWORD,
    sessionSecret: process.env.ADMIN_SESSION_SECRET,
    groqKey: process.env.GROQ_API_KEY,
    supabaseUrl: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  process.env.ADMIN_PASSWORD = 'test-admin-password';
  process.env.ADMIN_SESSION_SECRET = 'endpoint-test-session-secret';
  process.env.GROQ_API_KEY = 'gsk_server_only_example_1234567890';
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;

  try {
    const unauthorized = await fetch(`${origin}/api/admin`);
    assert.equal(unauthorized.status, 401);

    const login = await fetch(`${origin}/api/admin`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({ action: 'login', password: 'test-admin-password' })
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);

    const dashboard = await fetch(`${origin}/api/admin`, { headers: { cookie } });
    assert.equal(dashboard.status, 200);
    const payload = await dashboard.json();
    assert.equal(payload.config.maskedGroqApiKey, 'gsk_••••••••7890');
    assert.equal(JSON.stringify(payload).includes(process.env.GROQ_API_KEY), false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (previous.password === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = previous.password;
    if (previous.sessionSecret === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = previous.sessionSecret;
    if (previous.groqKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = previous.groqKey;
    if (previous.supabaseUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.supabaseUrl;
    if (previous.serviceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.serviceKey;
  }
});
