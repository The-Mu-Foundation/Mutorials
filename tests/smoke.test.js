const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, signedInAgent, request } = require('./helpers');

let ctx;
before(async () => {
  ctx = await start();
});
after(stop);

test('public pages render', async () => {
  for (const path of [
    '/',
    '/signin',
    '/signup',
    '/whoWeAre',
    '/termsOfService',
    '/robots.txt',
  ]) {
    const res = await request(ctx.app).get(path);
    assert.equal(res.status, 200, `${path} -> ${res.status}`);
  }
});

test('unknown pages redirect home; unknown non-GET requests get a bare 404', async () => {
  const get = await request(ctx.app).get('/definitely-not-a-page');
  assert.equal(get.status, 302);
  assert.equal(get.headers.location, '/');
  const post = await request(ctx.app)
    .post('/definitely-not-a-page')
    .type('form')
    .send({});
  assert.equal(post.status, 404);
  assert.doesNotMatch(post.text, /node_modules|at Object\./);
});

test('security headers are present', async () => {
  const res = await request(ctx.app).get('/');
  assert.ok(res.headers['x-content-type-options']);
  assert.ok(res.headers['content-security-policy']);
  assert.equal(res.headers['x-powered-by'], undefined);
});

test('register, login and load the homepage', async () => {
  const { agent } = await signedInAgent(ctx.app);
  const res = await agent.get('/homepage');
  assert.equal(res.status, 200);
  const user = await ctx.mongo.User.findOne({
    username: 'tester@example.com',
  }).lean();
  assert.ok(user.hash.startsWith('scrypt$'));
  assert.equal(user.emailVerified, false);
});
