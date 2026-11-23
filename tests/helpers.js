// Shared test harness: boots the real Express app against an in-memory MongoDB.
process.env.NODE_ENV = 'test';

const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

let server;
let ctx;

async function start() {
  if (ctx) return ctx;
  server = await MongoMemoryServer.create();
  process.env.DB_URL = server.getUri('mutorials_test');
  const mongo = require('../utils/functions/mongo');
  await mongo.connected;
  const { ensureSiteData } = require('../utils/functions/database');
  await ensureSiteData(mongo.SiteData);
  const app = require('../app');
  ctx = { app, mongo };
  return ctx;
}

async function stop() {
  if (!ctx) return;
  const mongoose = require('mongoose');
  await mongoose.disconnect();
  await server.stop();
  ctx = undefined;
}

/** Registers a user and returns a logged-in supertest agent. */
async function signedInAgent(app, overrides = {}) {
  const user = {
    username: 'tester@example.com',
    ign: 'tester',
    password: 'correct-horse-battery-staple-42',
    yob: '2005',
    ...overrides,
  };
  const agent = request.agent(app);
  await agent
    .post('/register')
    .type('form')
    .send({ ...user, confirmPassword: user.password, agreeTOS: 'on' });
  await agent
    .post('/login')
    .type('form')
    .send({ username: user.username, password: user.password });
  return { agent, user };
}

module.exports = { start, stop, signedInAgent, request };
