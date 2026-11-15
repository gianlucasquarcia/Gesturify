export default {
    calls: [],
    fail: false,
    spawn_command_line_async(cmd) {
        if (this.fail)
            throw new Error('boom');
        this.calls.push(cmd);
    },
};
