# Notes API Demo

A small demo REST API, built with Express, for managing notes and tags. It's an
example project — all data lives in memory (`src/store.js`) and is lost every
time the server restarts.

## Requirements

- Node.js and npm

## Install

```bash
npm install
```

## Run

```bash
npm start
```

This runs `node src/app.js` and starts the server on **port 3000** by default.
Override with the `PORT` environment variable:

```bash
PORT=4000 npm start
```

## Project layout

| File | Responsibility |
|---|---|
| `src/app.js` | Creates the Express app and mounts each router |
| `src/store.js` | Shared in-memory arrays (`notes`, `tags`) and id counters |
| `src/notes.js` | Notes CRUD — mounted at `/notes` |
| `src/tags.js` | Tags CRUD — mounted at `/tags` |
| `src/search.js` | Note search — mounted at `/search` |
| `src/export.js` | Note export — mounted at `/export` |

## Data model

- **Note**: `{ id, title, body, tagIds }`
  - `title` — required, non-empty string
  - `body` — string, defaults to `""` if omitted
  - `tagIds` — array of tag ids, defaults to `[]` if omitted
- **Tag**: `{ id, name }`
  - `name` — required, non-empty string; must be unique, case-insensitively

IDs are numbers, auto-incremented per resource type starting at 1. Requests
with a JSON body must set `Content-Type: application/json`.

Every error response has the shape:

```json
{ "error": "<message>" }
```

---

## Notes — `/notes`

| Method | Path | Description |
|---|---|---|
| POST | `/notes` | Create a note |
| GET | `/notes` | List notes, optionally filtered by `?tagId=` |
| GET | `/notes/:id` | Get a single note |
| PUT | `/notes/:id` | Partially update a note |
| DELETE | `/notes/:id` | Delete a note |

**POST /notes** — body `{ "title": string, "body"?: string, "tagIds"?: number[] }`.
`title` is required and must be a non-empty string, otherwise `400`. Returns
`201` with the created note.

**GET /notes** — returns all notes. Add `?tagId=<id>` to return only notes
whose `tagIds` include that id.

**GET /notes/:id** — returns the note, or `404 { "error": "Note not found" }`.

**PUT /notes/:id** — body is any subset of `{ "title"?, "body"?, "tagIds"? }`;
only the fields present in the request are changed. Returns the updated note,
or `404` if the note doesn't exist.

**DELETE /notes/:id** — returns `204 No Content` on success, or `404` if the
note doesn't exist.

```bash
curl -X POST http://localhost:3000/notes \
  -H 'Content-Type: application/json' \
  -d '{"title":"Buy milk","body":"2% milk from the store","tagIds":[1]}'
# -> 201 {"id":1,"title":"Buy milk","body":"2% milk from the store","tagIds":[1]}
```

## Tags — `/tags`

| Method | Path | Description |
|---|---|---|
| POST | `/tags` | Create a tag |
| GET | `/tags` | List tags |
| GET | `/tags/:id` | Get a single tag |
| DELETE | `/tags/:id` | Delete a tag |

**POST /tags** — body `{ "name": string }`. `name` is required and must be a
non-empty string, otherwise `400`. A case-insensitive duplicate name returns
`409 { "error": "A tag with this name already exists" }`. Returns `201` with
the created tag.

**GET /tags** — returns all tags.

**GET /tags/:id** — returns the tag, or `404 { "error": "Tag not found" }`.

**DELETE /tags/:id** — returns `204 No Content` on success, or `404` if the
tag doesn't exist. Note: deleting a tag does **not** remove it from the
`tagIds` of any notes that still reference it — `/export` silently drops
ids that no longer resolve to a tag.

```bash
curl -X POST http://localhost:3000/tags \
  -H 'Content-Type: application/json' \
  -d '{"name":"work"}'
# -> 201 {"id":1,"name":"work"}
```

## Search — `/search`

| Method | Path | Description |
|---|---|---|
| GET | `/search?q=&tag=` | Search notes by keyword and/or tag name |

- `q` — keyword matched case-insensitively as a substring of the note's
  `title` or `body`.
- `tag` — a tag **name** (not id), matched case-insensitively, exact match.
- At least one of `q` or `tag` is required; omitting both returns
  `400 { "error": "Query parameter \"q\" or \"tag\" is required" }`.
- If both are given, they combine with **AND** semantics (a note must match
  both).

```bash
curl "http://localhost:3000/search?q=milk&tag=work"
# -> 200 [{"id":1,"title":"Buy milk","body":"2% milk from the store","tagIds":[1]}]
```

## Export — `/export`

| Method | Path | Description |
|---|---|---|
| GET | `/export` | Export all notes with tag ids resolved to tag names |

Returns an array of `{ id, title, body, tags }`, where `tags` is the list of
tag *names* corresponding to the note's `tagIds` (any id that no longer
matches an existing tag is omitted from the list).

```bash
curl http://localhost:3000/export
# -> 200 [{"id":1,"title":"Buy milk","body":"2% milk from the store","tags":["work"]}]
```
