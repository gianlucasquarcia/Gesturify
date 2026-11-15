// Regenerates docs/screenshots/*.png from the real preferences window,
// rendered in an isolated headless GNOME Shell (same setup as the integration tests).
import {spawn, execFileSync} from 'node:child_process';
import {cpSync, mkdirSync, mkdtempSync, rmSync, copyFileSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const UUID = 'gesturify@gianlucasquarcia.github.io';
const SCHEMA = 'org.gnome.shell.extensions.gesturify';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const KEY = {Page_Down: 0xff56, Tab: 0xff09, Control_L: 0xffe3};

const tmp = mkdtempSync(join(tmpdir(), 'gesturify-shots-'));
const extDir = join(tmp, 'data', 'gnome-shell', 'extensions');
mkdirSync(join(extDir, UUID), {recursive: true});
for (const f of ['metadata.json', 'extension.js', 'prefs.js', 'lib', 'schemas'])
    cpSync(join(root, f), join(extDir, UUID, f), {recursive: true});
// Details is shown by patching the temp copy only (synthetic keys don't reach the prefs window).
const SHOT = process.env.SHOT ?? 'preferences';
if (SHOT === 'details') {
    const pf = join(extDir, UUID, 'prefs.js');
    writeFileSync(pf, readFileSync(pf, 'utf8').replace('window.add(this._buildDetailsPage());',
        'const d = this._buildDetailsPage(); window.add(d); window.set_visible_page(d);'));
}
execFileSync('glib-compile-schemas', [join(extDir, UUID, 'schemas')]);
cpSync(join(root, 'tests/integration/harness@test'), join(extDir, 'harness@test'), {recursive: true});
mkdirSync(join(tmp, 'config'));

const env = {
    ...process.env,
    XDG_DATA_HOME: join(tmp, 'data'),
    XDG_CONFIG_HOME: join(tmp, 'config'),
    XDG_CACHE_HOME: join(tmp, 'cache'),
    GSETTINGS_BACKEND: 'keyfile',
    GSETTINGS_SCHEMA_DIR: join(extDir, UUID, 'schemas'),
    WAYLAND_DISPLAY: 'gesturify-shots',
    GDK_BACKEND: 'wayland',
    NO_AT_BRIDGE: '1',
};
const procs = [];
const gs = (schema, key, value) => execFileSync('gsettings', ['set', schema, key, value], {env});
const call = (method, ...args) => execFileSync('gdbus', ['call', '--session', '--dest', 'org.gnome.Shell',
    '--object-path', '/test/Harness', '--method', `test.Harness.${method}`, ...args.map(String)],
{env, timeout: 30000}).toString();

async function waitFor(fn, what, timeout = 40000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
        try {
            if (fn()) return;
        } catch { /* retry */ }
        await sleep(300);
    }
    throw new Error(`Timed out waiting for ${what}`);
}

try {
    const bus = spawn('dbus-daemon', ['--session', '--nofork', '--print-address=1'], {env, stdio: ['ignore', 'pipe', 'ignore']});
    procs.push(bus);
    env.DBUS_SESSION_BUS_ADDRESS = await new Promise(res => bus.stdout.once('data', d => res(d.toString().trim())));

    gs('org.gnome.shell', 'enabled-extensions', `['${UUID}', 'harness@test']`);
    gs('org.gnome.desktop.interface', 'color-scheme', 'prefer-dark');
    // Show a representative setup rather than the defaults.
    for (const [k, v] of [['swipe-3-left', 'workspace-left'], ['swipe-3-right', 'workspace-right'],
        ['swipe-3-up', 'overview'], ['swipe-3-down', 'app-grid'], ['swipe-4-up', 'command'],
        ['command-4-up', 'gnome-terminal'], ['swipe-4-left', 'workspace-left'], ['swipe-4-right', 'workspace-right']])
        gs(SCHEMA, k, v);

    procs.push(spawn('gnome-shell', ['--headless', '--wayland', '--no-x11', '--wayland-display=gesturify-shots',
        '--virtual-monitor', '1280x1300'], {env, stdio: 'ignore'}));
    await waitFor(() => call('Probe'), 'shell');

    procs.push(spawn('gnome-extensions', ['prefs', UUID], {env, stdio: 'ignore'}));
    await waitFor(() => /Gesturify/.test(call('State')), 'prefs window');
    await sleep(2500);
    mkdirSync(join(root, 'docs/screenshots'), {recursive: true});
    call('Shot', join(root, `docs/screenshots/${SHOT}.png`));
    console.log(`Wrote docs/screenshots/${SHOT}.png`);
} finally {
    for (const p of procs.reverse())
        p.kill('SIGKILL');
    rmSync(tmp, {recursive: true, force: true});
}
