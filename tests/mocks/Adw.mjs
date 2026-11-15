class Widget {
    constructor(props = {}) {
        Object.assign(this, props);
        this.children = [];
        this.handlers = {};
    }
    add(c) { this.children.push(c); }
    connect(sig, fn) { (this.handlers[sig] ??= []).push(fn); }
    emit(sig) { (this.handlers[sig] ?? []).forEach(f => f()); }
}
class ComboRow extends Widget {
    constructor(p) { super({selected: 0, ...p}); }
    select(i) { this.selected = i; this.emit('notify::selected'); }
}
export default {
    PreferencesPage: Widget,
    PreferencesGroup: Widget,
    ComboRow,
    EntryRow: class extends Widget { constructor(p) { super({text: '', visible: true, ...p}); } },
    SpinRow: Widget,
    ActionRow: Widget,
};
