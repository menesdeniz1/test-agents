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

test('GET /export returns an empty array when there are no notes', async () => {
  const res = await jsonRequest('GET', '/export');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), []);
});

test('GET /export includes notes with no tags as an empty tags array', async () => {
  const note = await (await jsonRequest('POST', '/notes', {
    title: 'Plain note',
    body: 'no tags here',
  })).json();

  const res = await jsonRequest('GET', '/export');
  const exported = await res.json();
  assert.equal(exported.length, 1);
  assert.deepEqual(exported[0], {
    id: note.id,
    title: 'Plain note',
    body: 'no tags here',
    tags: [],
  });
});

test('GET /export resolves tagIds to tag names', async () => {
  const work = await (await jsonRequest('POST', '/tags', { name: 'Work' })).json();
  const urgent = await (await jsonRequest('POST', '/tags', { name: 'Urgent' })).json();
  await jsonRequest('POST', '/notes', {
    title: 'Ship the feature',
    body: 'before Friday',
    tagIds: [work.id, urgent.id],
  });

  const res = await jsonRequest('GET', '/export');
  const exported = await res.json();
  assert.equal(exported.length, 1);
  assert.deepEqual(exported[0].tags, ['Work', 'Urgent']);
  // The raw tagIds field should not leak into the exported shape.
  assert.equal(exported[0].tagIds, undefined);
});

test('GET /export coerces string tag ids stored on the note when resolving names', async () => {
  const tag = await (await jsonRequest('POST', '/tags', { name: 'Home' })).json();
  await jsonRequest('POST', '/notes', {
    title: 'Fix the sink',
    tagIds: [String(tag.id)],
  });

  const res = await jsonRequest('GET', '/export');
  const exported = await res.json();
  assert.deepEqual(exported[0].tags, ['Home']);
});

test('cross-reference: GET /export omits names for tagIds whose tag was deleted', async () => {
  const keep = await (await jsonRequest('POST', '/tags', { name: 'Keep' })).json();
  const gone = await (await jsonRequest('POST', '/tags', { name: 'Gone' })).json();
  await jsonRequest('POST', '/notes', {
    title: 'Mixed references',
    tagIds: [keep.id, gone.id],
  });

  await jsonRequest('DELETE', `/tags/${gone.id}`);

  const res = await jsonRequest('GET', '/export');
  const exported = await res.json();
  // Only the still-existing tag's name should be present; the dangling
  // reference to the deleted tag is silently dropped, not an error.
  assert.deepEqual(exported[0].tags, ['Keep']);
});

test('cross-reference: GET /export returns an empty tags array when every referenced tag was deleted', async () => {
  const tag = await (await jsonRequest('POST', '/tags', { name: 'Temporary' })).json();
  await jsonRequest('POST', '/notes', { title: 'Solo tag', tagIds: [tag.id] });
  await jsonRequest('DELETE', `/tags/${tag.id}`);

  const res = await jsonRequest('GET', '/export');
  const exported = await res.json();
  assert.deepEqual(exported[0].tags, []);
});

test('GET /export preserves note creation order and maps each note independently', async () => {
  const first = await (await jsonRequest('POST', '/notes', { title: 'First' })).json();
  const second = await (await jsonRequest('POST', '/notes', { title: 'Second' })).json();
  const third = await (await jsonRequest('POST', '/notes', { title: 'Third' })).json();

  const res = await jsonRequest('GET', '/export');
  const exported = await res.json();
  assert.deepEqual(exported.map((n) => n.id), [first.id, second.id, third.id]);
  assert.deepEqual(exported.map((n) => n.title), ['First', 'Second', 'Third']);
});
