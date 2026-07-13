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

test('POST /tags creates a tag', async () => {
  const res = await jsonRequest('POST', '/tags', { name: 'Work' });
  assert.equal(res.status, 201);

  const tag = await res.json();
  assert.equal(typeof tag.id, 'number');
  assert.equal(tag.name, 'Work');
});

test('POST /tags assigns increasing unique ids across multiple creates', async () => {
  const first = await (await jsonRequest('POST', '/tags', { name: 'Work' })).json();
  const second = await (await jsonRequest('POST', '/tags', { name: 'Home' })).json();
  assert.notEqual(first.id, second.id);
});

test('POST /tags rejects a missing name', async () => {
  const res = await jsonRequest('POST', '/tags', {});
  assert.equal(res.status, 400);
  const payload = await res.json();
  assert.equal(payload.error, 'name is required and must be a non-empty string');
});

test('POST /tags rejects a whitespace-only name', async () => {
  const res = await jsonRequest('POST', '/tags', { name: '   ' });
  assert.equal(res.status, 400);
});

test('POST /tags rejects a non-string name', async () => {
  const res = await jsonRequest('POST', '/tags', { name: ['Work'] });
  assert.equal(res.status, 400);
});

test('POST /tags rejects an exact-case duplicate name', async () => {
  await jsonRequest('POST', '/tags', { name: 'Work' });
  const res = await jsonRequest('POST', '/tags', { name: 'Work' });
  assert.equal(res.status, 409);
  const payload = await res.json();
  assert.equal(payload.error, 'A tag with this name already exists');
});

test('POST /tags rejects a case-insensitive duplicate name', async () => {
  await jsonRequest('POST', '/tags', { name: 'Work' });
  const res = await jsonRequest('POST', '/tags', { name: 'wORK' });
  assert.equal(res.status, 409);
});

test('POST /tags allows a different name to coexist', async () => {
  await jsonRequest('POST', '/tags', { name: 'Work' });
  const res = await jsonRequest('POST', '/tags', { name: 'Home' });
  assert.equal(res.status, 201);
});

test('GET /tags returns an empty list when no tags exist', async () => {
  const res = await jsonRequest('GET', '/tags');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), []);
});

test('GET /tags lists all created tags', async () => {
  await jsonRequest('POST', '/tags', { name: 'Work' });
  await jsonRequest('POST', '/tags', { name: 'Home' });

  const res = await jsonRequest('GET', '/tags');
  const tags = await res.json();
  assert.equal(tags.length, 2);
  assert.deepEqual(tags.map((t) => t.name).sort(), ['Home', 'Work']);
});

test('GET /tags/:id returns the matching tag', async () => {
  const created = await (await jsonRequest('POST', '/tags', { name: 'Work' })).json();

  const res = await jsonRequest('GET', `/tags/${created.id}`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), created);
});

test('GET /tags/:id returns 404 for an id that does not exist', async () => {
  const res = await jsonRequest('GET', '/tags/999999');
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Tag not found' });
});

test('GET /tags/:id returns 404 (not 500) for a non-numeric id', async () => {
  const res = await jsonRequest('GET', '/tags/not-a-number');
  assert.equal(res.status, 404);
});

test('DELETE /tags/:id removes the tag and returns 204 with no body', async () => {
  const created = await (await jsonRequest('POST', '/tags', { name: 'Doomed' })).json();

  const res = await jsonRequest('DELETE', `/tags/${created.id}`);
  assert.equal(res.status, 204);
  assert.equal(await res.text(), '');

  const followUp = await jsonRequest('GET', `/tags/${created.id}`);
  assert.equal(followUp.status, 404);
});

test('DELETE /tags/:id returns 404 for an id that does not exist', async () => {
  const res = await jsonRequest('DELETE', '/tags/999999');
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Tag not found' });
});

test('DELETE /tags/:id frees the name up for reuse', async () => {
  const created = await (await jsonRequest('POST', '/tags', { name: 'Reusable' })).json();
  await jsonRequest('DELETE', `/tags/${created.id}`);

  const res = await jsonRequest('POST', '/tags', { name: 'Reusable' });
  assert.equal(res.status, 201);
});

test('cross-reference: deleting a tag does not cascade-remove it from notes that reference it', async () => {
  const tag = await (await jsonRequest('POST', '/tags', { name: 'Orphanable' })).json();
  const note = await (await jsonRequest('POST', '/notes', {
    title: 'References a tag',
    tagIds: [tag.id],
  })).json();

  await jsonRequest('DELETE', `/tags/${tag.id}`);

  const res = await jsonRequest('GET', `/notes/${note.id}`);
  const refreshedNote = await res.json();
  // The router does not clean up dangling references, so the stale id
  // remains on the note even though the tag itself is gone.
  assert.deepEqual(refreshedNote.tagIds, [tag.id]);
});
