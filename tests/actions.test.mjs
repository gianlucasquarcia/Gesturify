import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Actions} from '../lib/actions.js';
import {ACTIONS} from '../lib/constants.js';
import {fakeWindow, setupShell} from './helpers.mjs';

beforeEach(() => {
    GLib.calls.length = 0;
    GLib.fail = false;
    Main.overview.log.length = 0;
    Main.overview.visible = false;
});

test('every action in the UI list is handled without throwing', () => {
    setupShell();
    const a = new Actions();
    for (const [id] of ACTIONS)
        assert.doesNotThrow(() => a.run(id, 'true'), id);
});

test('none does nothing', () => {
    setupShell();
    new Actions().run('none');
    assert.deepEqual(Main.overview.log, []);
    assert.deepEqual(GLib.calls, []);
});

test('show-desktop minimizes normal windows then restores them', () => {
    const w1 = fakeWindow(), w2 = fakeWindow();
    const skip = fakeWindow({skip_taskbar: true});
    const dialog = fakeWindow({type: 3});
    const already = fakeWindow({minimized: true});
    setupShell([w1, w2, skip, dialog, already]);
    const a = new Actions();
    a.run('show-desktop');
    assert.ok(w1.minimized && w2.minimized);
    assert.ok(!skip.minimized && !dialog.minimized);
    a.run('show-desktop');
    assert.ok(!w1.minimized && !w2.minimized);
    assert.ok(already.minimized, 'windows minimized by the user stay minimized');
});

test('show-desktop with no windows is a no-op', () => {
    setupShell([]);
    assert.doesNotThrow(() => new Actions().run('show-desktop'));
});

test('show-desktop does not restore windows closed/changed since', () => {
    const w = fakeWindow();
    setupShell([w]);
    const a = new Actions();
    a.run('show-desktop');
    w.ws = {};
    a.run('show-desktop');
    assert.ok(w.minimized);
});

test('workspace-left / right activate the neighbor', () => {
    const {activated} = setupShell();
    const a = new Actions();
    a.run('workspace-left');
    a.run('workspace-right');
    assert.deepEqual(activated, [['LEFT', 42], ['RIGHT', 42]]);
});

test('overview toggles', () => {
    setupShell();
    new Actions().run('overview');
    assert.deepEqual(Main.overview.log, ['toggle']);
});

test('app-grid shows apps, or hides when overview is visible', () => {
    setupShell();
    const a = new Actions();
    a.run('app-grid');
    Main.overview.visible = true;
    a.run('app-grid');
    assert.deepEqual(Main.overview.log, ['showApps', 'hide']);
});

test('command spawns the configured command; empty is ignored', () => {
    setupShell();
    const a = new Actions();
    a.run('command', 'notify-send hi');
    a.run('command', '');
    assert.deepEqual(GLib.calls, ['notify-send hi']);
});

test('command failure is caught', () => {
    setupShell();
    GLib.fail = true;
    const orig = console.error;
    console.error = () => {};
    try {
        assert.doesNotThrow(() => new Actions().run('command', 'x'));
    } finally {
        console.error = orig;
    }
});
