export class ExtensionPreferences {
    constructor() {
        this.settings = ExtensionPreferences.settings;
        this.metadata = ExtensionPreferences.metadata;
    }
    getSettings() { return this.settings; }
}
