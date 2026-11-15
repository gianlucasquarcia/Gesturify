// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Gianluca Squarcia

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {ACTIONS, FINGER_COUNTS} from './lib/constants.js';

const DIRS = [['up', 'Swipe up'], ['down', 'Swipe down'], ['left', 'Swipe left'], ['right', 'Swipe right']];

export default class Prefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: 'Gestures', icon_name: 'input-touchpad-symbolic'});
        window.add(page);

        for (const fingers of FINGER_COUNTS) {
            const group = new Adw.PreferencesGroup({title: `${fingers}-finger gestures`});
            page.add(group);

            for (const [dir, label] of DIRS) {
                const key = `swipe-${fingers}-${dir}`;
                const combo = new Adw.ComboRow({
                    title: label,
                    model: Gtk.StringList.new(ACTIONS.map(a => a[1])),
                });
                const sync = () => {
                    const i = ACTIONS.findIndex(a => a[0] === settings.get_string(key));
                    combo.selected = i < 0 ? 0 : i;
                };
                sync();
                group.add(combo);

                const entry = new Adw.EntryRow({title: 'Command (runs as your user)'});
                settings.bind(`command-${fingers}-${dir}`, entry, 'text', 0);
                const updateVisibility = () => {
                    entry.visible = settings.get_string(key) === 'command';
                };
                updateVisibility();
                group.add(entry);

                combo.connect('notify::selected', () => {
                    settings.set_string(key, ACTIONS[combo.selected][0]);
                    updateVisibility();
                });
            }
        }

        const general = new Adw.PreferencesGroup({
            title: 'General',
            description: 'Finger counts with at least one action are captured by the extension; ' +
                'their native GNOME gestures are overridden. Counts with all "Do nothing" stay native.',
        });
        page.add(general);
        const spin = new Adw.SpinRow({
            title: 'Swipe threshold',
            subtitle: 'Distance required to trigger',
            adjustment: new Gtk.Adjustment({lower: 10, upper: 500, step_increment: 5, value: settings.get_int('threshold')}),
        });
        settings.bind('threshold', spin, 'value', 0);
        general.add(spin);

        window.add(this._buildDetailsPage());
    }

    _buildDetailsPage() {
        const page = new Adw.PreferencesPage({title: 'Details', icon_name: 'help-about-symbolic'});
        const md = this.metadata;

        const about = new Adw.PreferencesGroup({title: md.name, description: md.description});
        page.add(about);
        for (const [title, value] of [
            ['Version', String(md['version-name'] ?? md.version ?? '')],
            ['Extension ID', md.uuid],
            ['Supported GNOME Shell', (md['shell-version'] ?? []).join(', ')],
        ])
            about.add(new Adw.ActionRow({title, subtitle: value, subtitle_selectable: true}));

        const how = new Adw.PreferencesGroup({title: 'How it works'});
        page.add(how);
        for (const [title, subtitle] of [
            ['Gestures', 'Swipe up, down, left or right with 3 or 4 fingers on the touchpad (Wayland only).'],
            ['Native gestures', 'A finger count with at least one action is handled by this extension; counts left on "Do nothing" keep their native GNOME behavior.'],
            ['Show desktop', 'Minimizes all windows on the current workspace; swiping again restores them.'],
            ['Threshold', 'The swipe must travel at least this distance, otherwise it is ignored.'],
        ])
            how.add(new Adw.ActionRow({title, subtitle}));

        const actions = new Adw.PreferencesGroup({title: 'Available actions'});
        page.add(actions);
        for (const [, label] of ACTIONS.filter(a => a[0] !== 'none'))
            actions.add(new Adw.ActionRow({title: label}));
        return page;
    }
}
