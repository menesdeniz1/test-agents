'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const store = require('../src/store');

let server;
let baseUrl;

function jsonRequest(method, path, body) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  return fetch(`${baseUrl}${path}`, init);
}

test.before(() => {
  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(() => new Promise((resolve, reject) => {
  server.close((err) => (err ? reject(err) : resolve()));
}));

test.beforeEach(() => {
  store.notes.length = 0;
  store.tags.length = 0;
});

test('GET /search with neither q nor tag returns 400', async () => {
  const res = await jsonRequest('GET', '/search');
  assert.equal(res.status, 400);
  const payload = await res.json();
  assert.equal(payload.error, 'Query parameter "q" or "tag" is required');
});

test('GET /search?q= matches notes by title, case-insensitively', async () => {
  const match = await (await jsonRequest('POST', '/notes', {
    title: 'Grocery Shopping',
    body: 'irrelevant',
  })).json();
  await jsonRequest('POST', '/notes', { title: 'Vacation plans', body: 'irrelevant' });

  const res = await jsonRequest('GET', '/search?q=grocery');
  assert.equal(res.status, 200);
  const results = await res.json();
  assert.equal(results.length, 1);
  assert.equal(results[0].id, match.id);
});

test('GET /search?q= matches notes by body content', async () => {
  const match = await (await jsonRequest('POST', '/notes', {
    title: 'Untitled',
    body: 'remember to buy MILK',
  })).json();
  await jsonRequest('POST', '/notes', { title: 'Untitled', body: 'nothing relevant' });

  const res = await jsonRequest('GET', '/search?q=milk');
  const results = await res.json();
  assert.equal(results.length, 1);
  assert.equal(results[0].id, match.id);
});

test('GET /search?q= returns an empty array when nothing matches', async () => {
  await jsonRequest('POST', '/notes', { title: 'Alpha', body: 'Beta' });

  const res = await jsonRequest('GET', '/search?q=zzz_no_match_zzz');
  assert.deepEqual(await res.json(), []);
});

test('GET /search?q= (empty string) matches every note, since "" is a substring of any string', async () => {
  await jsonRequest('POST', '/notes', { title: 'A' });
  await jsonRequest('POST', '/notes', { title: 'B' });

  const res = await jsonRequest('GET', '/search?q=');
  assert.equal(res.status, 200);
  const results = await res.json();
  assert.equal(results.length, 2);
});

test('GET /search?tag= matches notes tagged with that tag name, case-insensitively', async () => {
  const tag = await (await jsonRequest('POST', '/tags', { name: 'Urgent' })).json();
  const tagged = await (await jsonRequest('POST', '/notes', {
    title: 'Do this now',
    tagIds: [tag.id],
  })).json();
  await jsonRequest('POST', '/notes', { title: 'Do this later' });

  const res = await jsonRequest('GET', '/search?tag=urgent');
  assert.equal(res.status, 200);
  const results = await res.json();
  assert.equal(results.length, 1);
  assert.equal(results[0].id, tagged.id);
});

test('GET /search?tag= returns an empty array for a tag name that does not exist', async () => {
  await jsonRequest('POST', '/notes', { title: 'Anything' });

  const res = await jsonRequest('GET', '/search?tag=doesnotexist');
  assert.deepEqual(await res.json(), []);
});

test('GET /search?q=&tag= combines both filters with AND semantics', async () => {
  const tag = await (await jsonRequest('POST', '/tags', { name: 'Work' })).json();

  const both = await (await jsonRequest('POST', '/notes', {
    title: 'Quarterly report',
    tagIds: [tag.id],
  })).json();
  // Matches the keyword but not the tag.
  await jsonRequest('POST', '/notes', { title: 'Quarterly taxes' });
  // Matches the tag but not the keyword.
  await jsonRequest('POST', '/notes', { title: 'Team lunch', tagIds: [tag.id] });

  const res = await jsonRequest('GET', '/search?q=quarterly&tag=work');
  const results = await res.json();
  assert.equal(results.length, 1);
  assert.equal(results[0].id, both.id);
});

test('GET /search?q=&tag= returns empty when the keyword matches but the tag does not', async () => {
  const tag = await (await jsonRequest('POST', '/tags', { name: 'Work' })).json();
  await jsonRequest('POST', '/notes', { title: 'Quarterly report', tagIds: [tag.id] });

  const res = await jsonRequest('GET', '/search?q=quarterly&tag=personal');
  assert.deepEqual(await res.json(), []);
});
