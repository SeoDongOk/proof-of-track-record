# Diagrams

`architecture.html` is a self-contained interactive diagram — no external
resources, no network calls. Open it in a browser.

It is generated from `architecture.json` with
[archify](https://github.com/tt-a1i/archify) (MIT):

```bash
npx skills add tt-a1i/archify -g

node ~/.agents/skills/archify/bin/archify.mjs \
  validate architecture diagrams/architecture.json --quality showcase --repo-root .

node ~/.agents/skills/archify/bin/archify.mjs \
  deliver architecture diagrams/architecture.json diagrams/architecture.html \
  --quality showcase --repo-root .
```

`--repo-root .` matters: components carry `sources` entries pointing at real
files and line numbers, pinned to the revision in `meta.repository`. The
validator checks those paths exist, so the diagram cannot drift from the code
without failing.

`visual-check` renders the artifact in headless Chrome at four viewports and
fails on overflow or unreadable text:

```bash
node ~/.agents/skills/archify/bin/archify.mjs visual-check diagrams/architecture.html --json
```

Its PNG contact sheets are gitignored — regenerate them when you need them.
