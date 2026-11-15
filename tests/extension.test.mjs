import test, {beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import GLib from 'gi://GLib';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Gestify from '../extension.js';
import {fakeSettings, fakeWindow, setupShell} from './helpers.mjs';

function ev(phase, fingers, dx = 0, dy = 0, type = 'swipe') {
    return {
        type: () => type,
        get_gesture_phase: () => phase,
        get_touchpad_gesture_finger_count: () => fingers,
        get_gesture_motion_delta: () => [dx, dy],
    };
}

function setup(values, windows = []) {
    const shell = setupShell(windows);
    const stage = {
        handlers: new Map(),
        n: 0,
        connect(sig, fn) { this.handlers.set(++this.n, [sig, fn]); return this.n; },
        disconnect(id) { this.handlers.delete(id); },
        emit(e) { return [...this.handlers.values()].map(([, fn]) => fn(null, e)); },
    };
    globalThis.global.stage = stage;
    Extension.settings = fakeSettings(values);
    return {ext: new Gestify(), stage, ...shell};
}

function swipe(stage, fingers, dx, dy) {
    const out = [stage.emit(ev(0, fingers))];
    for (let i = 0; i < 4; i++)
        out.push(stage.emit(ev(1, fingers, dx / 4, dy / 4)));
    out.push(stage.emit(ev(2, fingers)));
    return out.flat();
}

beforeEach(() => {
    GLib.calls.length = 0;
    Main.overview.log.length = 0;
});

test('enable connects to the stage, disable disconnects', () => {
    const {ext, stage} = setup({});
    ext.enable();
    assert.equal(stage.handlers.size, 1);
    assert.equal([...stage.handlers.values()][0][0], 'captured-event');
    ext.disable();
    assert.equal(stage.handlers.size, 0);
    assert.doesNotThrow(() => ext.disable());
});

test('4-finger swipe down minimizes windows, a second one restores them', () => {
    const w = fakeWindow();
    const {ext, stage} = setup({'swipe-4-down': 'show-desktop'}, [w]);
    ext.enable();
    const res = swipe(stage, 4, 0, 100);
    assert.ok(w.minimized);
    assert.ok(res.every(Boolean), 'events consumed');
    swipe(stage, 4, 0, 100);
    assert.ok(!w.minimized);
});

test('3-finger swipes switch workspace', () => {
    const {ext, stage, activated} = setup({'swipe-3-left': 'workspace-left', 'swipe-3-right': 'workspace-right'});
    ext.enable();
    swipe(stage, 3, -100, 0);
    swipe(stage, 3, 100, 0);
    assert.deepEqual(activated.map(a => a[0]), ['LEFT', 'RIGHT']);
});

test('overview, app grid and command gestures reach their actions', () => {
    const {ext, stage} = setup({
        'swipe-3-up': 'overview', 'swipe-3-down': 'app-grid',
        'swipe-4-up': 'command', 'command-4-up': 'xdg-open .',
    });
    ext.enable();
    swipe(stage, 3, 0, -100);
    swipe(stage, 3, 0, 100);
    swipe(stage, 4, 0, -100);
    assert.deepEqual(Main.overview.log, ['toggle', 'showApps']);
    assert.deepEqual(GLib.calls, ['xdg-open .']);
});

test('non-swipe events and unbound finger counts propagate', () => {
    const {ext, stage} = setup({'swipe-4-down': 'show-desktop'});
    ext.enable();
    assert.deepEqual(stage.emit(ev(0, 4, 0, 0, 'motion')), [false]);
    assert.ok(swipe(stage, 3, 0, 100).every(r => r === false));
});

test('no actions run after disable', () => {
    const w = fakeWindow();
    const {ext, stage} = setup({'swipe-4-down': 'show-desktop'}, [w]);
    ext.enable();
    ext.disable();
    swipe(stage, 4, 0, 100);
    assert.ok(!w.minimized);
});
