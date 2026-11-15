// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Gianluca Squarcia

import Clutter from 'gi://Clutter';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {Actions} from './lib/actions.js';
import {GestureEngine, PHASE} from './lib/engine.js';

export default class Gesturify extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._actions = new Actions();
        this._engine = new GestureEngine(this._settings, (a, c) => this._actions.run(a, c));
        this._id = global.stage.connect('captured-event', (_s, event) =>
            this._onEvent(event));
    }

    disable() {
        if (this._id)
            global.stage.disconnect(this._id);
        this._id = null;
        this._actions?.destroy();
        this._actions = null;
        this._engine = null;
        this._settings = null;
    }

    _onEvent(event) {
        if (event.type() !== Clutter.EventType.TOUCHPAD_SWIPE)
            return Clutter.EVENT_PROPAGATE;
        const phase = event.get_gesture_phase();
        const [dx, dy] = phase === Clutter.TouchpadGesturePhase.UPDATE
            ? event.get_gesture_motion_delta() : [0, 0];
        const map = {
            [Clutter.TouchpadGesturePhase.BEGIN]: PHASE.BEGIN,
            [Clutter.TouchpadGesturePhase.UPDATE]: PHASE.UPDATE,
            [Clutter.TouchpadGesturePhase.END]: PHASE.END,
            [Clutter.TouchpadGesturePhase.CANCEL]: PHASE.CANCEL,
        };
        const consumed = this._engine.handle(map[phase],
            event.get_touchpad_gesture_finger_count(), dx, dy);
        return consumed ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE;
    }
}
