# Gestify

Ubuntu extension to customize touchpad gestures. GNOME Shell extension (shell 50, 51) to bind 3/4-finger touchpad swipes to actions:
show desktop (default: 4-finger swipe down), prev/next workspace, overview, app grid, custom command.

Install: `make install`, then log out/in (Wayland) and `gnome-extensions enable gestify@local`.
Configure: `gnome-extensions prefs gestify@local` (a Details page there explains version, how it works and available actions).

Notes: a finger count with any bound action is captured entirely (native gesture of that count is overridden);
counts with all actions "Do nothing" stay native. Requires Wayland (touchpad swipe events).

## Tests

- `npm test` – unit tests (Node >= 20, no dependencies). GJS/Shell modules are mocked via `tests/loader.mjs`
  and `tests/mocks/`; covers gesture engine, actions, `extension.js`, `prefs.js` (gestures + details pages) and the GSettings schema
  (the schema test needs `gjs` and `glib-compile-schemas`).
- `npm run test:integration` – runs the real extension in an isolated headless GNOME Shell with real
  Wayland windows (needs `gnome-shell`, `dbus-daemon`, `gnome-text-editor`). Touchpad events are synthesized
  by a test-only helper extension (`tests/integration/harness@test`); everything else (window minimizing,
  workspaces, overview, app grid, commands) is the real shell. Uses temp dirs; your settings are untouched.
