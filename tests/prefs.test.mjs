import test from 'node:test';
import assert from 'node:assert/strict';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import Prefs from '../prefs.js';
import {ACTIONS, DIRECTIONS, FINGER_COUNTS} from '../lib/constants.js';
import {readFileSync} from 'node:fs';
import {fakeSettings} from './helpers.mjs';

const meta = JSON.parse(readFileSync(new URL('../metadata.json', import.meta.url), 'utf8'));

function build(values = {}) {
    ExtensionPreferences.settings = fakeSettings(values);
    ExtensionPreferences.metadata = meta;
    const window = {pages: [], add(p) { this.pages.push(p); }};
    const prefs = new Prefs();
    prefs.fillPreferencesWindow(window);
    return {settings: prefs.settings, page: window.pages[0], window};
}

// Group children alternate [combo, entry] per direction, keyed by the combo title.
const rowsFor = group => {
    const out = {};
    for (let i = 0; i < group.children.length; i += 2)
        out[group.children[i].title] = [group.children[i], group.children[i + 1]];
    return out;
};

test('one page with a group per finger count plus general', () => {
    const {page} = build();
    assert.equal(page.children.length, FINGER_COUNTS.length + 1);
});

test('each finger group has a combo per direction offering every action', () => {
    const {page} = build();
    FINGER_COUNTS.forEach((f, i) => {
        const group = page.children[i];
        assert.match(group.title, new RegExp(`^${f}-finger`));
        assert.equal(group.children.length, DIRECTIONS.length * 2);
        for (const [combo] of Object.values(rowsFor(group)))
            assert.deepEqual(combo.model.items, ACTIONS.map(a => a[1]));
    });
});

test('combos reflect stored settings; command entry only visible for custom command', () => {
    const {page} = build({'swipe-4-down': 'show-desktop', 'swipe-3-up': 'command'});
    const four = rowsFor(page.children[1]);
    assert.equal(four['Swipe down'][0].selected, ACTIONS.findIndex(a => a[0] === 'show-desktop'));
    assert.equal(four['Swipe down'][1].visible, false);
    assert.equal(four['Swipe up'][0].selected, 0);
    assert.equal(rowsFor(page.children[0])['Swipe up'][1].visible, true);
});

test('changing a combo writes the setting and toggles the command entry', () => {
    const {page, settings} = build();
    const [combo, entry] = rowsFor(page.children[0])['Swipe left'];
    ACTIONS.forEach(([id], i) => {
        combo.select(i);
        assert.equal(settings.values['swipe-3-left'], id);
        assert.equal(entry.visible, id === 'command');
    });
});

test('command entries and threshold are bound to GSettings', () => {
    const {page, settings} = build();
    const keys = settings.bound.map(b => b[0]);
    for (const f of FINGER_COUNTS)
        for (const d of DIRECTIONS)
            assert.ok(keys.includes(`command-${f}-${d}`));
    const spin = page.children[2].children[0];
    assert.ok(keys.includes('threshold'));
    assert.deepEqual([spin.adjustment.lower, spin.adjustment.upper], [10, 500]);
});

test('details page shows metadata, how it works and every available action', () => {
    const {window} = build();
    assert.equal(window.pages.length, 2);
    const [about, how, actions] = window.pages[1].children;
    assert.equal(about.title, meta.name);
    assert.equal(about.description, meta.description);
    const subtitles = about.children.map(r => r.subtitle);
    assert.deepEqual(subtitles, [meta['version-name'], meta.uuid, meta['shell-version'].join(', ')]);
    assert.ok(how.children.length > 0);
    assert.deepEqual(actions.children.map(r => r.title),
        ACTIONS.filter(a => a[0] !== 'none').map(a => a[1]));
});
