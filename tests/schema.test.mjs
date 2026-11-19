import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, existsSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ACTIONS, DIRECTIONS, FINGER_COUNTS} from '../lib/constants.js';

const root = new URL('..', import.meta.url).pathname;
const meta = JSON.parse(readFileSync(join(root, 'metadata.json'), 'utf8'));
const xml = readFileSync(join(root, 'schemas', `${meta['settings-schema']}.gschema.xml`), 'utf8');

function defaultOf(key) {
    const m = xml.match(new RegExp(`<key name="${key}"[^>]*>\\s*<default>(.*?)</default>`, 's'));
    return m && m[1];
}

test('metadata declares a published shell version', () => {
    assert.ok(meta.uuid.includes('@'));
    assert.ok(meta['shell-version'].includes('50'));
    assert.ok(meta['shell-version'].includes('51'));
    assert.match(xml, new RegExp(`id="${meta['settings-schema']}"`));
});

test('schema has a swipe and command key for every finger/direction', () => {
    for (const f of FINGER_COUNTS)
        for (const d of DIRECTIONS) {
            assert.ok(defaultOf(`swipe-${f}-${d}`) !== null, `swipe-${f}-${d}`);
            assert.ok(defaultOf(`command-${f}-${d}`) !== null, `command-${f}-${d}`);
        }
});

test('defaults: only 4-finger down is bound, to show-desktop', () => {
    for (const f of FINGER_COUNTS)
        for (const d of DIRECTIONS)
            assert.equal(defaultOf(`swipe-${f}-${d}`), f === 4 && d === 'down' ? "'show-desktop'" : "'none'");
    assert.equal(defaultOf('threshold'), '60');
});

test('default actions are known action ids', () => {
    const ids = ACTIONS.map(a => a[0]);
    assert.equal(new Set(ids).size, ids.length);
    for (const m of xml.matchAll(/name="swipe-[34]-\w+"[^>]*>\s*<default>'(.*?)'/g))
        assert.ok(ids.includes(m[1]));
});

test('schema compiles and gsettings round-trips every action', t => {
    try {
        execFileSync('glib-compile-schemas', ['--version']);
    } catch {
        return t.skip('glib-compile-schemas missing');
    }
    const dir = mkdtempSync(join(tmpdir(), 'sdg-'));
    execFileSync('glib-compile-schemas', ['--strict', '--targetdir', dir, join(root, 'schemas')]);
    assert.ok(existsSync(join(dir, 'gschemas.compiled')));
        const env = {...process.env, GSETTINGS_BACKEND: 'memory'};
    // The memory backend does not persist across processes, so round-trip inside one gjs run.
    const id = meta['settings-schema'];
    const script = `
        import Gio from 'gi://Gio';
        const src = Gio.SettingsSchemaSource.new_from_directory(${JSON.stringify(dir)}, null, false);
        const s = new Gio.Settings({settings_schema: src.lookup(${JSON.stringify(id)}, false)});
        const out = {def: s.get_string('swipe-4-down'), set: []};
        for (const a of ${JSON.stringify(ACTIONS.map(a => a[0]))}) {
            s.set_string('swipe-3-left', a);
            out.set.push(s.get_string('swipe-3-left'));
        }
        out.low = s.set_int('threshold', 5) && s.get_int('threshold');
        out.high = s.set_int('threshold', 501) && s.get_int('threshold');
        out.ok = s.set_int('threshold', 500) && s.get_int('threshold');
        print(JSON.stringify(out));`;
    const file = join(dir, 't.mjs');
    writeFileSync(file, script);
    const out = JSON.parse(execFileSync('gjs', ['-m', file], {env}).toString());
    assert.equal(out.def, 'show-desktop');
    assert.deepEqual(out.set, ACTIONS.map(a => a[0]));
    assert.equal(out.ok, 500);
    assert.notEqual(out.low, 5, 'below range rejected');
    assert.notEqual(out.high, 501, 'above range rejected');
});
