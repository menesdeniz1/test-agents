const router = require('express').Router();
const store = require('./store');

// POST / - create a tag
router.post('/', (req, res) => {
  const { name } = req.body || {};

  if (typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name is required and must be a non-empty string' });
  }

  const duplicate = store.tags.some((t) => t.name.toLowerCase() === name.toLowerCase());

  if (duplicate) {
    return res.status(409).json({ error: 'A tag with this name already exists' });
  }

  const tag = {
    id: store.nextTagId(),
    name,
  };

  store.tags.push(tag);
  res.status(201).json(tag);
});

// GET / - list tags
router.get('/', (req, res) => {
  res.json(store.tags);
});

// GET /:id - fetch a single tag
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const tag = store.tags.find((t) => t.id === id);

  if (!tag) {
    return res.status(404).json({ error: 'Tag not found' });
  }

  res.json(tag);
});

// DELETE /:id - remove a tag
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = store.tags.findIndex((t) => t.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Tag not found' });
  }

  store.tags.splice(index, 1);
  res.status(204).end();
});

module.exports = router;
