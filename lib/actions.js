// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Gianluca Squarcia

import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class Actions {
    constructor() {
        this._hidden = [];
    }

    destroy() {
        this._hidden = [];
    }

    run(action, command) {
        switch (action) {
        case 'show-desktop': this._toggleDesktop(); break;
        case 'workspace-left': this._switchWorkspace(Meta.MotionDirection.LEFT); break;
        case 'workspace-right': this._switchWorkspace(Meta.MotionDirection.RIGHT); break;
        case 'overview': Main.overview.toggle(); break;
        case 'app-grid':
            if (Main.overview.visible)
                Main.overview.hide();
            else
                Main.overview.showApps();
            break;
        case 'command':
            if (command) {
                try {
                    GLib.spawn_command_line_async(command);
                } catch (e) {
                    console.error(`gesturify: ${e.message}`);
                }
            }
            break;
        }
    }

    _switchWorkspace(direction) {
        const target = global.workspace_manager.get_active_workspace().get_neighbor(direction);
        target?.activate(global.get_current_time());
    }

    // Minimizes everything; a second trigger restores what was minimized.
    _toggleDesktop() {
        const ws = global.workspace_manager.get_active_workspace();
        const windows = ws.list_windows().filter(w =>
            !w.skip_taskbar && !w.minimized &&
            w.get_window_type() === Meta.WindowType.NORMAL);

        if (windows.length > 0) {
            this._hidden = windows;
            windows.forEach(w => w.minimize());
            return;
        }
        const toRestore = this._hidden.filter(w => w.get_workspace() === ws && w.minimized);
        this._hidden = [];
        toRestore.forEach(w => w.unminimize());
    }
}
