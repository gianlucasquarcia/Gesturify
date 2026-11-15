export const overview = {
    visible: false,
    log: [],
    toggle() { this.log.push('toggle'); },
    hide() { this.log.push('hide'); },
    showApps() { this.log.push('showApps'); },
};
