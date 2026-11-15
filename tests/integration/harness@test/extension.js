import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
import GLib from 'gi://GLib';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const XML = `<node><interface name="test.Harness">
  <method name="Swipe"><arg type="i" direction="in"/><arg type="s" direction="in"/><arg type="d" direction="in"/><arg type="s" direction="out"/></method>
  <method name="State"><arg type="s" direction="out"/></method>
  <method name="AddWorkspace"><arg type="s" direction="out"/></method>
  <method name="Key"><arg type="u" direction="in"/><arg type="u" direction="in"/><arg type="s" direction="out"/></method>
  <method name="Shot"><arg type="s" direction="in"/><arg type="s" direction="out"/></method>
  <method name="Probe"><arg type="s" direction="out"/></method>
</interface></node>`;

const PHASES = Clutter.TouchpadGesturePhase;

export default class Harness extends Extension {
    enable() {
        this._dbus = Gio.DBusExportedObject.wrapJSObject(XML, this);
        this._dbus.export(Gio.DBus.session, '/test/Harness');
    }

    disable() {
        this._dbus?.unexport();
        this._dbus = null;
    }

    _target() {
        return Main.extensionManager.lookup('gesturify@local').stateObj;
    }

    // Feeds a full BEGIN/UPDATE.../END sequence to the real extension and returns consumed flags.
    SwipeAsync(params, invocation) {
        const [fingers, dir, dist] = params;
        const [dx, dy] = {up: [0, -dist], down: [0, dist], left: [-dist, 0], right: [dist, 0]}[dir];
        const target = this._target();
        const consumed = [];
        const send = (phase, ddx = 0, ddy = 0) => {
            const e = {
                type: () => Clutter.EventType.TOUCHPAD_SWIPE,
                get_gesture_phase: () => phase,
                get_touchpad_gesture_finger_count: () => fingers,
                get_gesture_motion_delta: () => [ddx, ddy],
            };
            consumed.push(target._onEvent(e));
        };
        send(PHASES.BEGIN);
        for (let i = 0; i < 5; i++)
            send(PHASES.UPDATE, dx / 5, dy / 5);
        send(PHASES.END);
        // Let minimize/unminimize animations and workspace switches settle.
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
            invocation.return_value(new GLib.Variant('(s)', [JSON.stringify(consumed)]));
            return GLib.SOURCE_REMOVE;
        });
    }

    State() {
        const wm = global.workspace_manager;
        const windows = global.get_window_actors()
            .map(a => a.meta_window)
            .filter(w => w.get_window_type() === 0)
            .map(w => ({title: w.get_title(), minimized: w.minimized, workspace: w.get_workspace()?.index()}));
        const all = global.get_window_actors().map(a => ({title: a.meta_window.get_title(), type: a.meta_window.get_window_type()}));
        return JSON.stringify({
            windows,
            all,
            workspace: wm.get_active_workspace_index(),
            workspaces: wm.get_n_workspaces(),
            overview: Main.overview.visible,
            apps: Main.overview.dash?.showAppsButton?.checked ?? null,
        });
    }

    AddWorkspace() {
        global.workspace_manager.append_new_workspace(false, global.get_current_time());
        return String(global.workspace_manager.get_n_workspaces());
    }

    // Presses keyval once, with an optional modifier keyval held (0 = none).
    Key(keyval, modifier) {
        this._keyboard ??= Clutter.get_default_backend().get_default_seat()
            .create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
        const t = GLib.get_monotonic_time();
        if (modifier)
            this._keyboard.notify_keyval(t, modifier, Clutter.KeyState.PRESSED);
        this._keyboard.notify_keyval(t + 1000, keyval, Clutter.KeyState.PRESSED);
        this._keyboard.notify_keyval(t + 2000, keyval, Clutter.KeyState.RELEASED);
        if (modifier)
            this._keyboard.notify_keyval(t + 3000, modifier, Clutter.KeyState.RELEASED);
        return 'ok';
    }

    // Saves a PNG of the focused window.
    ShotAsync(params, invocation) {
        const [path] = params;
        const stream = Gio.File.new_for_path(path).replace(null, false, Gio.FileCreateFlags.NONE, null);
        new Shell.Screenshot().screenshot_window(true, false, stream)
            .then(() => {
                stream.close(null);
                invocation.return_value(new GLib.Variant('(s)', [path]));
            })
            .catch(e => invocation.return_dbus_error('test.Harness.Error', String(e)));
    }

    Probe() {
        return JSON.stringify({realSwipeEvent: typeof Clutter.Event.touchpad_swipe_new});
    }
}
