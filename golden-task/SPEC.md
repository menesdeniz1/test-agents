# Golden task spec — `slugify`

> Give this file to the pipeline **verbatim**. Do not paraphrase it, do not
> add hints, do not answer questions it leaves open. Its wording is the
> control variable — changing it invalidates comparison with earlier runs.

Implement a single exported function `slugify(input)` that converts a title
string into a URL slug.

## Requirements

1. Export a function `slugify(input: string): string` from `src/slugify.js`.
2. Lowercase the result.
3. Replace any run of whitespace with a single hyphen.
4. Remove characters that are not letters, digits, or hyphens.
5. Collapse any run of consecutive hyphens into a single hyphen.
6. The result must never begin or end with a hyphen.
7. The result must never exceed 40 characters.
8. `slugify("")` returns `""`.
9. Throw a `TypeError` if `input` is not a string.

## Out of scope

- No CLI, no config object, no options parameter.
- No dependencies — standard library only.
- No caching, no async.
