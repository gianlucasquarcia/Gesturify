// Redirects gi:// and resource:// imports to mocks so GJS code runs under node.
export async function resolve(specifier, context, next) {
    if (specifier.startsWith('gi://') || specifier.startsWith('resource://')) {
        const name = specifier.startsWith('gi://')
            ? specifier.slice(5) : specifier.split('/').pop().replace('.js', '');
        return {url: new URL(`./mocks/${name}.mjs`, import.meta.url).href, shortCircuit: true};
    }
    return next(specifier, context);
}
