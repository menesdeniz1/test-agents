const router = require('express').Router();
const store = require('./store');

// POST / - create a note
router.post('/', (req, res) => {
  const { title, body, tagIds } = req.body || {};

  if (typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: 'title is required and must be a non-empty string' });
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
