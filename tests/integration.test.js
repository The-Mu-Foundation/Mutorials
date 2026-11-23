const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { start, stop, signedInAgent, request } = require('./helpers');
const { subjectUnitDictionary } = require('../utils/constants/subjects');

let ctx;
let seq = 0;
const PASSWORD = 'correct-horse-battery-staple-42';

before(async () => {
  ctx = await start();
});
after(stop);
beforeEach(async () => {
  await Promise.all(
    ['User', 'Ques', 'PendingQues', 'Class', 'Attempt'].map((m) =>
      ctx.mongo[m].deleteMany({}),
    ),
  );
});

// each test gets distinct identities so tests cannot interfere with each other
async function newUser(overrides = {}) {
  seq += 1;
  return signedInAgent(ctx.app, {
    username: `user${seq}@example.com`,
    ign: `user${seq}`,
    ...overrides,
  });
}

const physicsUnit = () => 'Physics - ' + subjectUnitDictionary.Physics[0];

async function seedQuestion(overrides = {}) {
  return ctx.mongo.Ques.create({
    question: 'What is 2+2?',
    choices: ['3', '4', '5'],
    tags: [],
    rating: 1200,
    answer: ['4'],
    answer_ex: 'Arithmetic.',
    author: 'MU-AUTHOR',
    type: 'mc',
    ext_source: 'Original',
    subject: ['Physics'],
    units: [physicsUnit()],
    stats: { pass: 0, fail: 0 },
    ...overrides,
  });
}

async function rate(user, level = 1200) {
  await ctx.mongo.User.updateOne(
    { username: user.username },
    { $set: { 'rating.physics': level } },
  );
}

// ---------------------------------------------------------------- security

test('password reset cannot be taken over with a NoSQL operator payload', async () => {
  const { user } = await newUser();
  const before = await ctx.mongo.User.findOne({
    username: user.username,
  }).lean();

  for (const send of [
    (r) =>
      r
        .post('/forgotPassword')
        .type('form')
        .send(
          'username[$ne]=x&enteredCode[$ne]=x&newpw=Hacked-pass1&confirmnewpw=Hacked-pass1',
        ),
    (r) =>
      r.post('/forgotPassword').send({
        username: { $ne: '' },
        enteredCode: { $ne: '' },
        newpw: 'Hacked-pass1',
        confirmnewpw: 'Hacked-pass1',
      }),
  ]) {
    const res = await send(request(ctx.app));
    assert.ok([400, 302, 200].includes(res.status));
  }
  const after = await ctx.mongo.User.findOne({
    username: user.username,
  }).lean();
  assert.equal(after.hash, before.hash);
});

test('operator payloads in login are rejected', async () => {
  const res = await request(ctx.app)
    .post('/login')
    .send({ username: { $ne: '' }, password: { $ne: '' } });
  assert.equal(res.status, 400);
});

test('password reset: wrong code fails, attempts are capped, correct code works once', async () => {
  const { user } = await newUser();
  const code = 'ABCDEFGH23';
  await ctx.mongo.User.updateOne(
    { username: user.username },
    {
      $set: {
        passwordReset: {
          codeHash: crypto.createHash('sha256').update(code).digest('hex'),
          expiresAt: new Date(Date.now() + 60_000),
          attempts: 0,
        },
      },
    },
  );
  const reset = (enteredCode, newpw = 'Brand-new-pass9') =>
    request(ctx.app).post('/forgotPassword').type('form').send({
      username: user.username,
      enteredCode,
      newpw,
      confirmnewpw: newpw,
    });

  for (let i = 0; i < 5; i++) await reset('WRONGCODE1');
  // after 5 failures even the right code is refused
  await reset(code);
  let doc = await ctx.mongo.User.findOne({ username: user.username }).lean();
  assert.ok(doc.hash.startsWith('scrypt$'));
  const oldHash = doc.hash;
  assert.equal(doc.passwordReset.attempts >= 5, true);

  // fresh code, correct entry
  await ctx.mongo.User.updateOne(
    { username: user.username },
    { $set: { 'passwordReset.attempts': 0 } },
  );
  await reset(code);
  doc = await ctx.mongo.User.findOne({ username: user.username }).lean();
  assert.notEqual(doc.hash, oldHash);
  assert.equal(doc.emailVerified, true);
  assert.equal(doc.passwordReset, undefined);
  // a code can only be used once
  await reset(code, 'Another-pass77');
  const again = await ctx.mongo.User.findOne({
    username: user.username,
  }).lean();
  assert.equal(again.hash, doc.hash);
});

test('cross-site state-changing requests are blocked, same-origin ones are not', async () => {
  const blocked = await request(ctx.app)
    .post('/login')
    .set('Sec-Fetch-Site', 'cross-site')
    .type('form')
    .send({ username: 'a', password: 'b' });
  assert.equal(blocked.status, 403);
  const forgedOrigin = await request(ctx.app)
    .post('/login')
    .set('Origin', 'https://evil.example')
    .type('form')
    .send({ username: 'a', password: 'b' });
  assert.equal(forgedOrigin.status, 403);
  const nullOrigin = await request(ctx.app)
    .post('/login')
    .set('Origin', 'null')
    .type('form')
    .send({ username: 'a', password: 'b' });
  assert.equal(nullOrigin.status, 403);
  const same = await request(ctx.app)
    .post('/login')
    .set('Sec-Fetch-Site', 'same-origin')
    .type('form')
    .send({ username: 'a', password: 'b' });
  assert.equal(same.status, 302);
});

test('public profile data never exposes credentials', async () => {
  const { agent, user } = await newUser();
  const ign = user.ign;
  for (const path of [`/profile/${ign}`, `/stats/${ign}`]) {
    const res = await agent.get(path);
    const body = res.text + JSON.stringify(res.headers);
    assert.doesNotMatch(body, /scrypt\$/);
    assert.doesNotMatch(body, /passwordReset|codeHash/);
    const doc = await ctx.mongo.User.findOne({ ign }).lean();
    assert.equal(body.includes(doc.hash), false, path);
    assert.equal(body.includes(doc.salt), false, path);
  }
});

test('unauthenticated users are redirected from protected areas', async () => {
  for (const path of [
    '/homepage',
    '/train',
    '/class/dash',
    '/settings',
    '/admin/adminHomepage',
    '/reviewer/reviewQuestions',
    '/contributors/stats',
  ]) {
    const res = await request(ctx.app).get(path);
    assert.equal(res.status, 302, path);
    assert.match(res.headers.location, /^\/(signin)?$/, path);
  }
});

test('an unverified account with an admin address does not get admin access', async () => {
  const { adminList } = require('../utils/constants/sitesettings');
  const { agent } = await signedInAgent(ctx.app, {
    username: adminList[0],
    ign: 'wannabeadmin',
  });
  const res = await agent.get('/admin/adminHomepage');
  assert.equal(res.status, 302);
  await ctx.mongo.User.updateOne(
    { username: adminList[0] },
    { $set: { emailVerified: true } },
  );
  const ok = await agent.get('/admin/adminHomepage');
  assert.equal(ok.status, 200);
  for (const path of [
    '/admin/addquestion',
    '/admin/allQuestions',
    '/admin/analytics',
    '/admin/announcements',
    '/admin/usaboAdminHomepage',
    '/admin/allUSABOQuestions',
    '/reviewer/reviewQuestions',
    '/reviewer/reviewUSABOQuestions',
  ]) {
    const page = await agent.get(path);
    assert.equal(page.status, 200, path);
  }
});

test('legacy PBKDF2 accounts can log in and are upgraded to scrypt', async () => {
  const salt = crypto.randomBytes(16).toString('hex');
  const legacyHash = crypto
    .pbkdf2Sync('legacy-pass1', salt, 10000, 64, 'sha512')
    .toString('hex');
  await ctx.mongo.User.create({
    username: 'legacy@example.com',
    ign: 'legacy',
    hash: legacyHash,
    salt,
    profile: { name: 'legacy', location: 'x', yob: 2000, bio: '' },
    stats: { experience: 0, correct: 0, wrong: 0, collectedTags: [] },
    rating: { physics: -1, chemistry: -1, biology: -1, usabo: -1, ess: -1 },
  });
  const agent = request.agent(ctx.app);
  const login = await agent
    .post('/login')
    .type('form')
    .send({ username: 'legacy@example.com', password: 'legacy-pass1' });
  assert.equal(login.headers.location, '/homepage');
  const doc = await ctx.mongo.User.findOne({
    username: 'legacy@example.com',
  }).lean();
  assert.ok(doc.hash.startsWith('scrypt$'));
  const second = await request
    .agent(ctx.app)
    .post('/login')
    .type('form')
    .send({ username: 'legacy@example.com', password: 'legacy-pass1' });
  assert.equal(second.headers.location, '/homepage');
  const wrong = await request
    .agent(ctx.app)
    .post('/login')
    .type('form')
    .send({ username: 'legacy@example.com', password: 'nope-nope-1' });
  assert.equal(wrong.headers.location, '/signin');
});

test('contact form does not redirect off-site', async () => {
  const res = await request(ctx.app).post('/contact').type('form').send({
    name: 'x',
    email: 'a@b.co',
    message: 'hello',
    redirect: 'https://evil.example/phish',
  });
  assert.ok(!/evil\.example/.test(res.headers.location || ''));
});

// ----------------------------------------------------------- authorization

test("a user cannot delete or manage another teacher's class", async () => {
  const teacher = await newUser();
  await teacher.agent
    .post('/class/createClass')
    .type('form')
    .send({ name: 'Period 1' });
  const klass = await ctx.mongo.Class.findOne({ name: 'Period 1' }).lean();
  assert.ok(klass);

  const intruder = await newUser();
  await intruder.agent
    .post('/class/delete')
    .type('form')
    .send({ classId: String(klass._id) });
  assert.ok(await ctx.mongo.Class.findById(klass._id), 'class survived');

  const removal = await intruder.agent
    .post('/class/removeStudent')
    .type('form')
    .send({ classId: String(klass._id), ign: teacher.user.ign });
  assert.equal(removal.status, 403);
  const regen = await intruder.agent
    .post('/class/generateNewClassCode')
    .type('form')
    .send({ classId: String(klass._id) });
  assert.notEqual(regen.status, 200);
  const unchanged = await ctx.mongo.Class.findById(klass._id).lean();
  assert.equal(unchanged.classCode, klass.classCode);

  await teacher.agent
    .post('/class/delete')
    .type('form')
    .send({ classId: String(klass._id) });
  assert.equal(await ctx.mongo.Class.findById(klass._id), null);
});

test('students can join a class by code', async () => {
  const teacher = await newUser();
  await teacher.agent
    .post('/class/createClass')
    .type('form')
    .send({ name: 'Bio' });
  const klass = await ctx.mongo.Class.findOne({ name: 'Bio' }).lean();
  const student = await newUser();
  await student.agent
    .post('/class/joinClass')
    .type('form')
    .send({ classCode: klass.classCode });
  const doc = await ctx.mongo.User.findOne({ ign: student.user.ign }).lean();
  assert.equal(doc.classes.map(String).includes(String(klass._id)), true);
});

// ------------------------------------------------------------ answer pipeline

test('classic trainer: a correct answer raises ratings exactly once even if resubmitted', async () => {
  const { agent, user } = await newUser();
  await rate(user);
  const q = await seedQuestion();

  const page = await agent
    .get('/train/Physics/displayQuestion')
    .query({ units: physicsUnit() });
  assert.equal(page.status, 200, page.text.slice(0, 200));

  const submit = () =>
    agent
      .post('/train/checkAnswer')
      .type('form')
      .send({
        id: String(q._id),
        type: 'mc',
        answerChoice: '4',
        units: physicsUnit(),
      });
  const first = await submit();
  assert.equal(first.status, 200);
  const afterFirst = await ctx.mongo.User.findOne({
    username: user.username,
  }).lean();
  assert.ok(afterFirst.rating.physics > 1200);
  assert.equal(afterFirst.stats.correct, 1);

  const second = await submit();
  const afterSecond = await ctx.mongo.User.findOne({
    username: user.username,
  }).lean();
  assert.equal(
    afterSecond.rating.physics,
    afterFirst.rating.physics,
    'no double credit',
  );
  assert.equal(afterSecond.stats.correct, 1);
  assert.equal(await ctx.mongo.Attempt.countDocuments({ rated: true }), 1);
  assert.ok([200, 302].includes(second.status));
});

test('concurrent submissions of one question are credited at most once', async () => {
  const { agent, user } = await newUser();
  await rate(user);
  const q = await seedQuestion();
  await agent
    .get('/train/Physics/displayQuestion')
    .query({ units: physicsUnit() });
  const body = {
    id: String(q._id),
    type: 'mc',
    answerChoice: '4',
    units: physicsUnit(),
  };
  await Promise.all(
    Array.from({ length: 6 }, () =>
      agent.post('/train/checkAnswer').type('form').send(body),
    ),
  );
  const doc = await ctx.mongo.User.findOne({ username: user.username }).lean();
  assert.equal(doc.stats.correct, 1);
  assert.equal(await ctx.mongo.Attempt.countDocuments({ rated: true }), 1);
});

test('answering a question that was never served earns no rating (explain-only)', async () => {
  const { agent, user } = await newUser();
  await rate(user);
  const q = await seedQuestion();
  const res = await agent
    .post('/train/checkAnswer')
    .type('form')
    .send({
      id: String(q._id),
      type: 'mc',
      answerChoice: '4',
      units: physicsUnit(),
    });
  assert.equal(res.status, 200);
  const doc = await ctx.mongo.User.findOne({ username: user.username }).lean();
  assert.equal(doc.rating.physics, 1200);
  assert.equal(await ctx.mongo.Attempt.countDocuments({ rated: true }), 0);
});

test('ratings move in the expected direction on a surprising wrong answer', async () => {
  const { agent, user } = await newUser();
  await rate(user, 2400);
  const q = await seedQuestion({ rating: 600 });
  // queue it directly: the picker would not serve a question this far below the user
  await ctx.mongo.User.updateOne(
    { username: user.username },
    { $set: { 'stats.toAnswer.physics': String(q._id) } },
  );
  await agent
    .post('/train/checkAnswer')
    .type('form')
    .send({
      id: String(q._id),
      type: 'mc',
      answerChoice: '3',
      units: physicsUnit(),
    });
  const doc = await ctx.mongo.User.findOne({ username: user.username }).lean();
  const qdoc = await ctx.mongo.Ques.findById(q._id).lean();
  assert.ok(doc.rating.physics < 2400);
  assert.ok(qdoc.rating > 600);
  assert.equal(doc.stats.wrong, 1);
  assert.equal(qdoc.stats.fail, 1);
});

test('an even match leaves the question rating unchanged (quantisation in the K=16 / 25 scheme)', async () => {
  // Documents a known weakness of the legacy update rule: the question moves by
  // round(userDelta / 25), which is 0 whenever |userDelta| < 13.
  const { agent, user } = await newUser();
  await rate(user, 1200);
  const q = await seedQuestion({ rating: 1200 });
  await agent
    .get('/train/Physics/displayQuestion')
    .query({ units: physicsUnit() });
  await agent
    .post('/train/checkAnswer')
    .type('form')
    .send({
      id: String(q._id),
      type: 'mc',
      answerChoice: '3',
      units: physicsUnit(),
    });
  const qdoc = await ctx.mongo.Ques.findById(q._id).lean();
  assert.equal(qdoc.rating, 1200);
  assert.equal(qdoc.stats.fail, 1);
});

test('initial rating can be set once and cannot be reset by replay', async () => {
  const { agent, user } = await newUser();
  await agent
    .post('/private/initialRating')
    .type('form')
    .send({ subject: 'Physics', level: '600' });
  let doc = await ctx.mongo.User.findOne({ username: user.username }).lean();
  assert.equal(doc.rating.physics, 600);
  await agent
    .post('/private/initialRating')
    .type('form')
    .send({ subject: 'Physics', level: '2400' });
  doc = await ctx.mongo.User.findOne({ username: user.username }).lean();
  assert.equal(doc.rating.physics, 600);
  await agent
    .post('/private/initialRating')
    .type('form')
    .send({ subject: 'Physics', level: '99999' });
  doc = await ctx.mongo.User.findOne({ username: user.username }).lean();
  assert.equal(doc.rating.physics, 600);
});

// ------------------------------------------------------------ reviewer flow

test('reviewer flow publishes after two distinct reviews and blocks self-review', async () => {
  const subject = 'Physics';
  const pending = await ctx.mongo.PendingQues.create({
    question: 'Q?',
    choices: ['a', 'b'],
    tags: ['t'],
    rating: 1000,
    answer: ['a'],
    answer_ex: 'e',
    author: 'MU-AUTHOR',
    type: 'mc',
    ext_source: 'x',
    subject: [subject],
    units: [physicsUnit()],
    reviewers: [],
  });
  const form = (reviewerID) => ({
    questionID: String(pending._id),
    reviewerID,
    question: 'Q? (edited)',
    choices: 'a@b',
    tags: 't',
    rating: '1000',
    answer: 'a',
    answerExplanation: 'e',
    author: 'MU-AUTHOR',
    type: 'mc',
    externalSource: 'x',
    sourceStatement: '',
    subject: [subject],
    units: [physicsUnit()],
  });

  const makeReviewer = async (contributor) => {
    const u = await newUser();
    await ctx.mongo.User.updateOne(
      { username: u.user.username },
      { $set: { reviewer: true, contributor } },
    );
    return u;
  };
  const r1 = await makeReviewer('MU-R1');
  const r2 = await makeReviewer('MU-R2');
  const author = await makeReviewer('MU-AUTHOR');

  // the author may not review their own question
  let res = await author.agent
    .post('/reviewer/editQuestion')
    .type('form')
    .send(form('MU-AUTHOR'));
  assert.equal(res.body.success, false);
  // a reviewer cannot impersonate another reviewer
  res = await r1.agent
    .post('/reviewer/editQuestion')
    .type('form')
    .send(form('MU-R2'));
  assert.equal(res.body.success, false);

  res = await r1.agent
    .post('/reviewer/editQuestion')
    .type('form')
    .send(form('MU-R1'));
  assert.equal(res.body.success, true);
  assert.equal(
    await ctx.mongo.Ques.countDocuments({}),
    0,
    'one review is not enough',
  );
  // the same reviewer reviewing twice does not count twice
  await r1.agent
    .post('/reviewer/editQuestion')
    .type('form')
    .send(form('MU-R1'));
  assert.equal(await ctx.mongo.Ques.countDocuments({}), 0);

  res = await r2.agent
    .post('/reviewer/editQuestion')
    .type('form')
    .send(form('MU-R2'));
  assert.equal(res.body.success, true);
  const live = await ctx.mongo.Ques.find({}).lean();
  assert.equal(live.length, 1);
  assert.equal(live[0].question, 'Q? (edited)');
  assert.equal(typeof live[0].rating, 'number');
  assert.equal(String(live[0]._id), String(pending._id));
  assert.equal(await ctx.mongo.PendingQues.countDocuments({}), 0);
});

test('contributors cannot forge the author and cannot read other contributors', async () => {
  const c = await newUser();
  await ctx.mongo.User.updateOne(
    { username: c.user.username },
    { $set: { contributor: 'MU-C1' } },
  );
  const subject = 'Physics';
  const res = await c.agent
    .post('/contributors/addQuestion')
    .type('form')
    .send({
      question: 'Q?',
      choices: 'a@b',
      tags: 't',
      rating: '1000',
      answer: 'a',
      answerExplanation: 'e',
      author: 'SOMEONE-ELSE',
      type: 'mc',
      externalSource: 'x',
      sourceStatement: '',
      subject: [subject],
      units: [physicsUnit()],
    });
  assert.equal(res.body.success, true);
  const doc = await ctx.mongo.PendingQues.findOne({}).lean();
  assert.equal(doc.author, 'MU-C1');
  assert.equal(doc.rating, 1000);

  await ctx.mongo.PendingQues.create({
    ...doc,
    _id: undefined,
    author: 'MU-OTHER',
    question: 'secret',
  });
  const stats = await c.agent
    .get('/contributors/getContributorStats')
    .query({ id: 'MU-OTHER' });
  assert.equal(stats.status, 200);
  assert.doesNotMatch(JSON.stringify(stats.body), /secret/);
});

test('non-contributors cannot reach contributor endpoints', async () => {
  const { agent } = await newUser();
  const res = await agent
    .post('/contributors/addUSABOQuestion')
    .type('form')
    .send({ question: 'x' });
  assert.equal(res.status, 302);
  assert.equal(await ctx.mongo.USABOPendingQues.countDocuments({}), 0);
});

// ----------------------------------------------------------- authenticated render

test('authenticated pages render without template errors (Express 5 / EJS)', async () => {
  const { agent, user } = await newUser();
  await rate(user);
  await seedQuestion();
  const paths = [
    '/homepage',
    '/usaboHomepage',
    '/train',
    '/train/chooseSubject',
    '/train/Physics/chooseUnits',
    '/train/Physics/proficiency',
    '/train/rush',
    '/train/daily',
    '/settings',
    '/class/dash',
    '/class/join',
    '/class/create',
    `/profile/${user.ign}`,
    `/stats/${user.ign}`,
    '/announcements',
    '/references',
    '/contributors/addQuestion',
  ];
  const failures = [];
  for (const path of paths) {
    const res = await agent.get(path);
    if (![200, 302].includes(res.status))
      failures.push(`${path} -> ${res.status}`);
  }
  assert.deepEqual(failures, []);
});

test('account deletion removes the user and their attempts', async () => {
  const { agent, user } = await newUser();
  await rate(user);
  const q = await seedQuestion();
  await agent
    .get('/train/Physics/displayQuestion')
    .query({ units: physicsUnit() });
  await agent
    .post('/train/checkAnswer')
    .type('form')
    .send({
      id: String(q._id),
      type: 'mc',
      answerChoice: '4',
      units: physicsUnit(),
    });
  assert.equal(await ctx.mongo.Attempt.countDocuments({}), 1);
  await agent
    .post('/deleteAccount')
    .type('form')
    .send({ delassword: PASSWORD });
  assert.equal(
    await ctx.mongo.User.countDocuments({ username: user.username }),
    0,
  );
  assert.equal(await ctx.mongo.Attempt.countDocuments({}), 0);
});
