const router = require('express').Router();
const store = require('./store');

// A tag id is valid if it is (or coerces to) a finite number, mirroring how
// the readers in notes/search/export compare ids via Number().
function isNumericId(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.trim() !== '' && Number.isFinite(Number(value));
  return false;
}

// Validates the writable fields against the shape the other routers depend on
// (title/body are strings, tagIds is an array of numeric ids). Returns an error
// message, or null when valid. When requireTitle is false (PUT), each field is
// only checked when the client actually provided it.
function validateNoteInput({ title, body, tagIds }, requireTitle) {
  if (requireTitle || title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      return 'title is required and must be a non-empty string';
    }
  }
  if (body !== undefined && typeof body !== 'string') {
    return 'body must be a string';
  }
  if (tagIds !== undefined && (!Array.isArray(tagIds) || !tagIds.every(isNumericId))) {
    return 'tagIds must be an array of numbers';
  }
  return null;
}

// POST / - create a note
router.post('/', (req, res) => {
  const { title, body, tagIds } = req.body || {};

  const error = validateNoteInput({ title, body, tagIds }, true);
  if (error) {
    return res.status(400).json({ error });
  }

  const note = {
    id: store.nextNoteId(),
    title,
    body: body === undefined ? '' : body,
    tagIds: tagIds === undefined ? [] : tagIds,
  };

  store.notes.push(note);
  res.status(201).json(note);
});

// GET / - list notes, optionally filtered by ?tagId=
router.get('/', (req, res) => {
  const { tagId } = req.query;

  if (tagId === undefined) {
    return res.json(store.notes);
  }

  const tagIdNum = Number(tagId);
  const filtered = store.notes.filter((note) =>
    (note.tagIds || []).some((t) => Number(t) === tagIdNum)
  );
  res.json(filtered);
});

// GET /:id - fetch a single note
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const note = store.notes.find((n) => n.id === id);

  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }

  res.json(note);
});

// PUT /:id - partially update a note
router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  const note = store.notes.find((n) => n.id === id);

  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }

  const { title, body, tagIds } = req.body || {};

  const error = validateNoteInput({ title, body, tagIds }, false);
  if (error) {
    return res.status(400).json({ error });
  }

  if (title !== undefined) note.title = title;
  if (body !== undefined) note.body = body;
  if (tagIds !== undefined) note.tagIds = tagIds;

  res.json(note);
});

// DELETE /:id - remove a note
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = store.notes.findIndex((n) => n.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Note not found' });
  }

  store.notes.splice(index, 1);
  res.status(204).end();
});

module.exports = router;
