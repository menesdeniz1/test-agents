const router = require('express').Router();
const store = require('./store');

// Returns true if the note's title or body contains the keyword (case-insensitive).
function matchesKeyword(note, keyword) {
  const lower = keyword.toLowerCase();
  return (
    (note.title || '').toLowerCase().includes(lower) ||
    (note.body || '').toLowerCase().includes(lower)
  );
}

// GET /?q=<keyword>&tag=<tagName> - search notes by keyword and/or tag name.
// Providing both combines them with AND semantics.
router.get('/', (req, res) => {
  const { q, tag } = req.query;

  if (q === undefined && tag === undefined) {
    return res.status(400).json({ error: 'Query parameter "q" or "tag" is required' });
  }

  let results = store.notes;

  if (q !== undefined) {
    results = results.filter((note) => matchesKeyword(note, q));
  }

  if (tag !== undefined) {
    const tagLower = tag.toLowerCase();
    const matchingTagIds = store.tags
      .filter((t) => t.name.toLowerCase() === tagLower)
      .map((t) => t.id);

    results = results.filter((note) =>
      (note.tagIds || []).some((id) => matchingTagIds.some((tagId) => Number(id) === tagId))
    );
  }

  res.json(results);
});

module.exports = router;
