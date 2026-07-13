const router = require('express').Router();
const store = require('./store');

// Resolves an array of tag ids to their tag names, cross-referencing
// store.tags. Ids that no longer match any existing tag are omitted.
function resolveTagNames(tagIds) {
  return (tagIds || [])
    .map((tagId) => store.tags.find((t) => t.id === Number(tagId)))
    .filter((tag) => tag !== undefined)
    .map((tag) => tag.name);
}

// GET / - export all notes as JSON, with tagIds resolved to tag names
router.get('/', (req, res) => {
  const exported = store.notes.map((note) => ({
    id: note.id,
    title: note.title,
    body: note.body,
    tags: resolveTagNames(note.tagIds),
  }));

  res.json(exported);
});

module.exports = router;
