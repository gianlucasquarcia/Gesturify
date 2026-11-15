// Runs the real extension inside a headless nested GNOME Shell with real Wayland windows.
// Requires: gnome-shell, dbus-daemon, gdbus, gsettings, glib-compile-schemas, gnome-text-editor.
import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn, execFileSync, spawnSync} from 'node:child_process';
import {cpSync, mkdirSync, mkdtempSync, rmSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const root = new URL('../..', import.meta.url).pathname;
const UUID = 'gesturify@gianlucasquarcia.github.io';
const SCHEMA = 'org.gnome.shell.extensions.gesturify';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const required = ['gnome-shell', 'dbus-daemon', 'gdbus', 'gsettings', 'glib-compile-schemas', 'gnome-text-editor'];
const missing = required.filter(c => spawnSync('which', [c]).status !== 0);

let tmp, env, bus, shell, clients = [], shellLog = '';

function gs(schema, key, value) {
    execFileSync('gsettings', ['set', schema, key, value], {env});
}
const setBinding = (key, value) => gs(SCHEMA, key, value);

function harness(method, ...args) {
    const out = execFileSync('gdbus', [
        'call', '--session', '--dest', 'org.gnome.Shell', '--object-path', '/test/Harness',
        '--method', `test.Harness.${method}`, ...args.map(String),
    ], {env, timeout: 20000}).toString().trim();
    // Output looks like: ('json',)
    const m = out.match(/^\('(.*)',?\)$/s);
    return m ? JSON.parse(m[1].replace(/\\'/g, "'")) : out;
}
const state = () => harness('State');
const swipe = (fingers, dir, dist = 100) => harness('Swipe', fingers, dir, dist);
const minimizedCount = s => s.windows.filter(w => w.minimized).length;

async function waitFor(fn, what, timeout = 20000) {
    const end = Date.now() + timeout;
    let last;
    while (Date.now() < end) {
        try {
            last = fn();
            if (last) return last;
        } catch (e) {
            last = e;
        }
        await sleep(300);
    }
    throw new Error(`Timed out waiting for ${what}: ${last}`);
}

async function resetBindings() {
    for (const f of [3, 4])
        for (const d of ['up', 'down', 'left', 'right'])
            setBinding(`swipe-${f}-${d}`, d === 'down' && f === 4 ? 'show-desktop' : 'none');
    setBinding('threshold', '60');
    await sleep(500);
}

before(async () => {
    if (missing.length)
        return;
    tmp = mkdtempSync(join(tmpdir(), 'sdg-int-'));
    const extDir = join(tmp, 'data', 'gnome-shell', 'extensions');
    mkdirSync(join(extDir, UUID), {recursive: true});
    for (const f of ['metadata.json', 'extension.js', 'prefs.js', 'lib', 'schemas'])
        cpSync(join(root, f), join(extDir, UUID, f), {recursive: true});
    execFileSync('glib-compile-schemas', [join(extDir, UUID, 'schemas')]);
    cpSync(join(root, 'tests/integration/harness@test'), join(extDir, 'harness@test'), {recursive: true});

    env = {
        ...process.env,
        XDG_DATA_HOME: join(tmp, 'data'),
        XDG_CONFIG_HOME: join(tmp, 'config'),
        XDG_CACHE_HOME: join(tmp, 'cache'),
        GSETTINGS_BACKEND: 'keyfile',
        GSETTINGS_SCHEMA_DIR: join(extDir, UUID, 'schemas'),
        WAYLAND_DISPLAY: 'sdg-test',
        GDK_BACKEND: 'wayland',
        NO_AT_BRIDGE: '1',
    };
    // Services activated by this bus (e.g. the extension prefs app) inherit this environment.
    bus = spawn('dbus-daemon', ['--session', '--nofork', '--print-address=1'], {env, stdio: ['ignore', 'pipe', 'pipe']});
    bus.stderr.on('data', d => { shellLog += d; });
    env.DBUS_SESSION_BUS_ADDRESS = await new Promise(res => bus.stdout.once('data', d => res(d.toString().trim())));

    mkdirSync(join(tmp, 'config'));

    gs('org.gnome.shell', 'enabled-extensions', `['${UUID}', 'harness@test']`);
    gs('org.gnome.mutter', 'dynamic-workspaces', 'false');
    gs('org.gnome.desktop.wm.preferences', 'num-workspaces', '3');

    shell = spawn('gnome-shell', ['--headless', '--wayland', '--no-x11',
        '--wayland-display=sdg-test', '--virtual-monitor', '1024x768'], {env, stdio: ['ignore', 'ignore', 'pipe']});
    shell.stderr.on('data', d => { shellLog += d; });
    await waitFor(() => harness('Probe'), 'shell + harness extension', 40000);

    // Two independent instances so each gets its own normal (non-dialog) window.
    for (let i = 0; i < 2; i++)
        clients.push(spawn('gnome-text-editor', ['--standalone'], {env, stdio: 'ignore'}));
    await waitFor(() => state().windows.length === 2, 'two client windows', 40000);
    await sleep(1000);
});

after(() => {
    for (const p of [...clients, shell, bus])
        p?.kill('SIGKILL');
    if (tmp)
        rmSync(tmp, {recursive: true, force: true});
});

const opts = {skip: missing.length ? `missing tools: ${missing.join(', ')}` : false, timeout: 60000};

test('shell has two normal windows, none minimized', opts, () => {
    const s = state();
    assert.equal(s.windows.length, 2);
    assert.equal(minimizedCount(s), 0);
    assert.equal(s.workspace, 0);
});

test('4-finger swipe down (default) minimizes all windows, again restores them', opts, async () => {
    await resetBindings();
    const consumed = swipe(4, 'down');
    assert.ok(consumed.every(Boolean));
    assert.equal(minimizedCount(state()), 2);
    swipe(4, 'down');
    assert.equal(minimizedCount(state()), 0);
});

test('unbound finger count does not touch the desktop and is not consumed', opts, async () => {
    await resetBindings();
    const consumed = swipe(3, 'down');
    assert.ok(consumed.every(c => c === false));
    const s = state();
    assert.equal(minimizedCount(s), 0);
    assert.equal(s.overview, false);
});

test('swipe below threshold does nothing; threshold setting is honored', opts, async () => {
    await resetBindings();
    swipe(4, 'down', 30);
    assert.equal(minimizedCount(state()), 0);
    setBinding('threshold', '10');
    await sleep(500);
    swipe(4, 'down', 30);
    assert.equal(minimizedCount(state()), 2);
    swipe(4, 'down', 30);
    assert.equal(minimizedCount(state()), 0);
});

test('3-finger swipe left/right switches workspaces', opts, async () => {
    await resetBindings();
    setBinding('swipe-3-right', 'workspace-right');
    setBinding('swipe-3-left', 'workspace-left');
    await sleep(500);
    swipe(3, 'right');
    assert.equal(state().workspace, 1);
    swipe(3, 'right');
    assert.equal(state().workspace, 2);
    swipe(3, 'left');
    swipe(3, 'left');
    assert.equal(state().workspace, 0);
});

test('3-finger swipe up toggles the overview', opts, async () => {
    await resetBindings();
    setBinding('swipe-3-up', 'overview');
    await sleep(500);
    swipe(3, 'up');
    assert.equal(state().overview, true);
    swipe(3, 'up');
    assert.equal(state().overview, false);
});

test('3-finger swipe down shows the app grid, again closes it', opts, async () => {
    await resetBindings();
    setBinding('swipe-3-down', 'app-grid');
    await sleep(500);
    swipe(3, 'down');
    const s = state();
    assert.equal(s.overview, true);
    assert.equal(s.apps, true);
    swipe(3, 'down');
    assert.equal(state().overview, false);
});

test('4-finger swipe up runs the custom command', opts, async () => {
    await resetBindings();
    const marker = join(tmp, 'command-ran');
    setBinding('swipe-4-up', 'command');
    setBinding('command-4-up', `touch ${marker}`);
    await sleep(500);
    assert.ok(!existsSync(marker));
    swipe(4, 'up');
    await waitFor(() => existsSync(marker), 'custom command to run', 5000);
});

test('rebinding at runtime takes effect immediately', opts, async () => {
    await resetBindings();
    setBinding('swipe-4-down', 'none');
    setBinding('swipe-4-left', 'show-desktop');
    await sleep(500);
    swipe(4, 'down');
    assert.equal(minimizedCount(state()), 0);
    swipe(4, 'left');
    assert.equal(minimizedCount(state()), 2);
    swipe(4, 'left');
    assert.equal(minimizedCount(state()), 0);
});

test('preferences window (gestures + details pages) opens without errors', opts, async () => {
    const before = shellLog.length;
    clients.push(spawn('gnome-extensions', ['prefs', UUID], {env, stdio: 'ignore'}));
    await waitFor(() => state().all.some(w => /Gesturify/.test(w.title ?? '')), 'preferences window', 45000);
    await sleep(1500);
    // The prefs app is bus-activated, so its stderr ends up in the bus log.
    const log = shellLog.slice(before);
    assert.doesNotMatch(log, /JS ERROR|CRITICAL|TypeError|ReferenceError|SyntaxError/);
});
