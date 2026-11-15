export function fakeSettings(values = {}) {
    const bound = [];
    return {
        values,
        bound,
        get_string: k => values[k] ?? (k.startsWith('swipe-') ? 'none' : ''),
        get_int: k => values[k] ?? 60,
        set_string(k, v) { values[k] = v; },
        bind(key, obj, prop) { bound.push([key, obj, prop]); },
    };
}

export function fakeWindow(opts = {}) {
    const w = {
        minimized: false,
        skip_taskbar: false,
        type: 0,
        ws: null,
        ...opts,
        get_window_type() { return this.type; },
        get_workspace() { return this.ws; },
        minimize() { this.minimized = true; },
        unminimize() { this.minimized = false; },
    };
    return w;
}

export function setupShell(windows = []) {
    const activated = [];
    const ws = {
        list_windows: () => windows,
        get_neighbor: dir => (dir === 'NONE' ? null : {activate: t => activated.push([dir, t])}),
    };
    windows.forEach(w => { if (!w.ws) w.ws = ws; });
    globalThis.global = {
        workspace_manager: {get_active_workspace: () => ws},
        get_current_time: () => 42,
    };
    return {ws, activated};
}
