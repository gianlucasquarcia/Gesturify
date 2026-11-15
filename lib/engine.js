// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Gianluca Squarcia

import {DIRECTIONS, FINGER_COUNTS} from './constants.js';

export const PHASE = {BEGIN: 0, UPDATE: 1, END: 2, CANCEL: 3};

// Pure gesture state machine. `settings` needs get_string/get_int;
// `run(action, command)` is invoked once per completed gesture.
export class GestureEngine {
    constructor(settings, run) {
        this._settings = settings;
        this._run = run;
        this._reset();
    }

    _reset() {
        this._fingers = 0;
        this._dx = 0;
        this._dy = 0;
        this._handled = false;
        this._claim = false;
    }

    _binding(fingers, dir) {
        return this._settings.get_string(`swipe-${fingers}-${dir}`);
    }

    _direction() {
        const t = this._settings.get_int('threshold');
        const ax = Math.abs(this._dx), ay = Math.abs(this._dy);
        if (Math.max(ax, ay) < t)
            return null;
        if (ay >= ax)
            return this._dy > 0 ? 'down' : 'up';
        return this._dx > 0 ? 'right' : 'left';
    }

    // Returns true if the event is consumed.
    handle(phase, fingers, dx = 0, dy = 0) {
        if (!FINGER_COUNTS.includes(fingers))
            return false;

        if (phase === PHASE.BEGIN) {
            this._reset();
            this._fingers = fingers;
            this._claim = DIRECTIONS.some(d => this._binding(fingers, d) !== 'none');
            return this._claim;
        }
        if (!this._claim || fingers !== this._fingers)
            return false;

        if (phase === PHASE.UPDATE) {
            this._dx += dx;
            this._dy += dy;
        } else if (phase === PHASE.CANCEL) {
            this._reset();
        } else if (phase === PHASE.END && !this._handled) {
            const dir = this._direction();
            if (dir) {
                const action = this._binding(fingers, dir);
                if (action !== 'none') {
                    this._handled = true;
                    this._run(action, this._settings.get_string(`command-${fingers}-${dir}`));
                }
            }
        }
        return true;
    }
}
