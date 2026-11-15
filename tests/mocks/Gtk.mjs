export default {
    StringList: {new: items => ({items})},
    Adjustment: class { constructor(p) { Object.assign(this, p); } },
};
