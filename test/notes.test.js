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

// The store is an in-memory singleton shared by every router, so each test
// gets a clean slate. Note: the id counters live inside store.js and are
// intentionally NOT reset here, so tests must assert on ids returned by the
// API rather than assuming they start at 1.
test.beforeEach(() => {
  store.notes.length = 0;
  store.tags.length = 0;
});

test('POST /notes creates a note with defaults for body and tagIds', async () => {
  const res = await jsonRequest('POST', '/notes', { title: 'Groceries' });
  assert.equal(res.status, 201);
  assert.equal(res.headers.get('content-type').includes('application/json'), true);

  const note = await res.json();
  assert.equal(typeof note.id, 'number');
  assert.equal(note.title, 'Groceries');
  assert.equal(note.body, '');
  assert.deepEqual(note.tagIds, []);
});

test('POST /notes creates a note with explicit body and tagIds', async () => {
  const res = await jsonRequest('POST', '/notes', {
    title: 'Trip planning',
    body: 'Book flights',
    tagIds: [1, 2],
  });
  assert.equal(res.status, 201);

  const note = await res.json();
  assert.equal(note.title, 'Trip planning');
  assert.equal(note.body, 'Book flights');
  assert.deepEqual(note.tagIds, [1, 2]);
});

test('POST /notes assigns increasing unique ids across multiple creates', async () => {
  const first = await (await jsonRequest('POST', '/notes', { title: 'One' })).json();
  const second = await (await jsonRequest('POST', '/notes', { title: 'Two' })).json();
  assert.notEqual(first.id, second.id);
});

test('POST /notes rejects a missing title', async () => {
  const res = await jsonRequest('POST', '/notes', { body: 'no title here' });
  assert.equal(res.status, 400);
  const payload = await res.json();
  assert.equal(payload.error, 'title is required and must be a non-empty string');
});

test('POST /notes rejects a whitespace-only title', async () => {
  const res = await jsonRequest('POST', '/notes', { title: '   ' });
  assert.equal(res.status, 400);
});

test('POST /notes rejects a non-string title', async () => {
  const res = await jsonRequest('POST', '/notes', { title: 42 });
  assert.equal(res.status, 400);
});

test('POST /notes rejects a request with no body at all', async () => {
  const res = await fetch(`${baseUrl}/notes`, { method: 'POST' });
  assert.equal(res.status, 400);
});

test('POST /notes rejects malformed JSON with a 400 instead of crashing', async () => {
  const res = await fetch(`${baseUrl}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ this is not valid json',
  });
  assert.equal(res.status, 400);
  // Confirm the server is still alive and serving normally afterwards.
  const followUp = await jsonRequest('GET', '/notes');
  assert.equal(followUp.status, 200);
});

test('GET /notes returns an empty list when no notes exist', async () => {
  const res = await jsonRequest('GET', '/notes');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), []);
});

test('GET /notes lists all created notes', async () => {
  await jsonRequest('POST', '/notes', { title: 'A' });
  await jsonRequest('POST', '/notes', { title: 'B' });

  const res = await jsonRequest('GET', '/notes');
  const notes = await res.json();
  assert.equal(notes.length, 2);
  assert.deepEqual(notes.map((n) => n.title).sort(), ['A', 'B']);
});

test('GET /notes?tagId= filters to notes containing that tag id', async () => {
  const noteWithTag = await (await jsonRequest('POST', '/notes', {
    title: 'Tagged',
    tagIds: [5],
  })).json();
  await jsonRequest('POST', '/notes', { title: 'Untagged' });

  const res = await jsonRequest('GET', '/notes?tagId=5');
  const notes = await res.json();
  assert.equal(notes.length, 1);
  assert.equal(notes[0].id, noteWithTag.id);
});

test('GET /notes?tagId= returns an empty array when nothing matches', async () => {
  await jsonRequest('POST', '/notes', { title: 'Tagged', tagIds: [1] });

  const res = await jsonRequest('GET', '/notes?tagId=999');
  assert.deepEqual(await res.json(), []);
});

test('GET /notes?tagId= coerces string tag ids stored on the note', async () => {
  // tagIds stored as strings should still match a numeric query, since the
  // route compares via Number() on both sides.
  await jsonRequest('POST', '/notes', { title: 'String tag', tagIds: ['7'] });

  const res = await jsonRequest('GET', '/notes?tagId=7');
  const notes = await res.json();
  assert.equal(notes.length, 1);
  assert.equal(notes[0].title, 'String tag');
});

test('GET /notes/:id returns the matching note', async () => {
  const created = await (await jsonRequest('POST', '/notes', { title: 'Findme' })).json();

  const res = await jsonRequest('GET', `/notes/${created.id}`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), created);
});

test('GET /notes/:id returns 404 for an id that does not exist', async () => {
  const res = await jsonRequest('GET', '/notes/999999');
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Note not found' });
});

test('GET /notes/:id returns 404 (not 500) for a non-numeric id', async () => {
  const res = await jsonRequest('GET', '/notes/not-a-number');
  assert.equal(res.status, 404);
});

test('PUT /notes/:id partially updates only the provided fields', async () => {
  const created = await (await jsonRequest('POST', '/notes', {
    title: 'Original',
    body: 'Original body',
    tagIds: [1],
  })).json();

  const res = await jsonRequest('PUT', `/notes/${created.id}`, { title: 'Updated' });
  assert.equal(res.status, 200);

  const updated = await res.json();
  assert.equal(updated.title, 'Updated');
  assert.equal(updated.body, 'Original body');
  assert.deepEqual(updated.tagIds, [1]);
});

test('PUT /notes/:id with an empty object leaves the note unchanged', async () => {
  const created = await (await jsonRequest('POST', '/notes', { title: 'Stable' })).json();

  const res = await jsonRequest('PUT', `/notes/${created.id}`, {});
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), created);
});

test('PUT /notes/:id returns 404 for an id that does not exist', async () => {
  const res = await jsonRequest('PUT', '/notes/999999', { title: 'Nope' });
  assert.equal(res.status, 404);
});

test('DELETE /notes/:id removes the note and returns 204 with no body', async () => {
  const created = await (await jsonRequest('POST', '/notes', { title: 'Doomed' })).json();

  const res = await jsonRequest('DELETE', `/notes/${created.id}`);
  assert.equal(res.status, 204);
  assert.equal(await res.text(), '');

  const followUp = await jsonRequest('GET', `/notes/${created.id}`);
  assert.equal(followUp.status, 404);
});

test('DELETE /notes/:id returns 404 for an id that does not exist', async () => {
  const res = await jsonRequest('DELETE', '/notes/999999');
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Note not found' });
});

test('DELETE /notes/:id does not affect other notes', async () => {
  const keep = await (await jsonRequest('POST', '/notes', { title: 'Keep' })).json();
  const remove = await (await jsonRequest('POST', '/notes', { title: 'Remove' })).json();

  await jsonRequest('DELETE', `/notes/${remove.id}`);

  const res = await jsonRequest('GET', '/notes');
  const notes = await res.json();
  assert.equal(notes.length, 1);
  assert.equal(notes[0].id, keep.id);
});
