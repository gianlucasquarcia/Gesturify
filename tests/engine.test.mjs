import test from 'node:test';
import assert from 'node:assert/strict';
import {GestureEngine, PHASE} from '../lib/engine.js';
import {DIRECTIONS, FINGER_COUNTS} from '../lib/constants.js';
import {fakeSettings} from './helpers.mjs';

function swipe(engine, fingers, dx, dy, {steps = 5} = {}) {
    const results = [engine.handle(PHASE.BEGIN, fingers)];
    for (let i = 0; i < steps; i++)
        results.push(engine.handle(PHASE.UPDATE, fingers, dx / steps, dy / steps));
    results.push(engine.handle(PHASE.END, fingers));
    return results;
}

const vectors = {up: [0, -100], down: [0, 100], left: [-100, 0], right: [100, 0]};

for (const fingers of FINGER_COUNTS) {
    for (const dir of DIRECTIONS) {
        test(`${fingers}-finger swipe ${dir} runs its bound action`, () => {
            const calls = [];
            const s = fakeSettings({[`swipe-${fingers}-${dir}`]: 'command', [`command-${fingers}-${dir}`]: 'echo hi'});
            const e = new GestureEngine(s, (a, c) => calls.push([a, c]));
            const res = swipe(e, fingers, ...vectors[dir]);
            assert.deepEqual(calls, [['command', 'echo hi']]);
            assert.ok(res.every(Boolean), 'all events consumed');
        });
    }
}

test('default 4-finger down shows desktop', () => {
    const calls = [];
    const e = new GestureEngine(fakeSettings({'swipe-4-down': 'show-desktop'}), a => calls.push(a));
    swipe(e, 4, 0, 100);
    assert.deepEqual(calls, ['show-desktop']);
});

test('unbound finger count is not consumed (native gestures coexist)', () => {
    const calls = [];
    const e = new GestureEngine(fakeSettings({'swipe-4-down': 'show-desktop'}), a => calls.push(a));
    const res = swipe(e, 3, 0, 100);
    assert.ok(res.every(r => r === false));
    assert.deepEqual(calls, []);
});

test('unsupported finger counts are ignored', () => {
    const e = new GestureEngine(fakeSettings({'swipe-4-down': 'show-desktop'}), () => assert.fail());
    for (const f of [1, 2, 5])
        assert.deepEqual(swipe(e, f, 0, 100), Array(7).fill(false));
});

test('swipe below threshold does nothing but is still consumed', () => {
    const calls = [];
    const e = new GestureEngine(fakeSettings({'swipe-4-down': 'show-desktop', threshold: 60}), a => calls.push(a));
    const res = swipe(e, 4, 0, 30);
    assert.deepEqual(calls, []);
    assert.ok(res.every(Boolean));
});

test('threshold setting is respected', () => {
    const calls = [];
    const e = new GestureEngine(fakeSettings({'swipe-4-down': 'show-desktop', threshold: 10}), a => calls.push(a));
    swipe(e, 4, 0, 20);
    assert.equal(calls.length, 1);
});

test('direction without binding does nothing on a claimed finger count', () => {
    const calls = [];
    const e = new GestureEngine(fakeSettings({'swipe-4-down': 'show-desktop'}), a => calls.push(a));
    swipe(e, 4, 100, 0);
    assert.deepEqual(calls, []);
});

test('dominant axis wins on diagonal swipes; ties go vertical', () => {
    const calls = [];
    const s = fakeSettings({'swipe-3-down': 'overview', 'swipe-3-right': 'app-grid'});
    const e = new GestureEngine(s, a => calls.push(a));
    swipe(e, 3, 100, 60);
    swipe(e, 3, 60, 100);
    swipe(e, 3, 80, 80);
    assert.deepEqual(calls, ['app-grid', 'overview', 'overview']);
});

test('cancel aborts the gesture', () => {
    const calls = [];
    const e = new GestureEngine(fakeSettings({'swipe-4-down': 'show-desktop'}), a => calls.push(a));
    e.handle(PHASE.BEGIN, 4);
    e.handle(PHASE.UPDATE, 4, 0, 200);
    e.handle(PHASE.CANCEL, 4);
    e.handle(PHASE.END, 4);
    assert.deepEqual(calls, []);
});

test('a second END does not fire twice', () => {
    const calls = [];
    const e = new GestureEngine(fakeSettings({'swipe-4-down': 'show-desktop'}), a => calls.push(a));
    swipe(e, 4, 0, 100);
    e.handle(PHASE.END, 4);
    assert.equal(calls.length, 1);
});

test('state resets between gestures', () => {
    const calls = [];
    const e = new GestureEngine(fakeSettings({'swipe-4-down': 'show-desktop', 'swipe-4-up': 'overview'}), a => calls.push(a));
    swipe(e, 4, 0, 100);
    swipe(e, 4, 0, -100);
    assert.deepEqual(calls, ['show-desktop', 'overview']);
});

test('finger count change mid-gesture is ignored', () => {
    const calls = [];
    const e = new GestureEngine(fakeSettings({'swipe-4-down': 'show-desktop'}), a => calls.push(a));
    e.handle(PHASE.BEGIN, 4);
    e.handle(PHASE.UPDATE, 3, 0, 200);
    e.handle(PHASE.END, 4);
    assert.deepEqual(calls, []);
});

test('bindings changes apply to the next gesture', () => {
    const vals = {'swipe-4-down': 'show-desktop'};
    const calls = [];
    const e = new GestureEngine(fakeSettings(vals), a => calls.push(a));
    swipe(e, 4, 0, 100);
    vals['swipe-4-down'] = 'overview';
    swipe(e, 4, 0, 100);
    assert.deepEqual(calls, ['show-desktop', 'overview']);
});
