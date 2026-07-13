const notes = [];
const tags = [];

let noteIdCounter = 1;
let tagIdCounter = 1;

module.exports = {
  notes,
  tags,
  nextNoteId: () => noteIdCounter++,
  nextTagId: () => tagIdCounter++,
};
