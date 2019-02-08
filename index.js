const { parse, walk, generate } = require('css-tree');

/**
 * @typedef {Object} CSSModuleOptions
 * @property {boolean} sourceMap Generate output with source maps
 * @property {(scope: string) => string} element A function that should return token for scoping single element inside component
 * @property {(scope: string) => string} host A function that should return token for scoping component host
 */

const defaultOptions = {
    /**
     * Returns token for scoping single element inside component
     * @param {string} scope
     * @returns {string}
     */
    element(scope) {
        return `[${scope}]`;
    },

    /**
     * Returns token for scoping component host
     * @param {string} scope
     * @returns {string}
     */
    host(scope) {
        return `[${scope}-host]`;
    }
};

/**
 * Isolates given CSS code with `scope` token
 * @param {string} code CSS source to rewrite
 * @param {string} scope CSS scoping token
 * @param {CSSModuleOptions} [options] Options for CSS Tree parser
 */
module.exports = function rewriteCSS(code, scope, options) {
    options = {
        ...defaultOptions,
        ...options
    };
    const ast = parse(code, options);
    const animations = {};

    walk(ast, function(node) {
        if (node.type === 'Selector') {
            if (!this.atrule || this.atrule.name !== 'keyframes') {
                // Do no rewrite selectors inside @keyframes
                rewriteSelector(node, scope, options);
            }
        } else if (node.type === 'Identifier' && this.atrulePrelude && this.atrule.name === 'keyframes') {
            // Rewrite animation definition
            const scopedName = concat(node.name, scope);
            animations[node.name] = scopedName;
            node.name = scopedName;
        }
    });

    // Use second pass to replace locally defined animations with scoped names
    walk(ast, {
        visit: 'Declaration',
        enter(node) {
            if (node.property === 'animation' || node.property === 'animation-name') {
                walk(node.value, value => {
                    if (value.type === 'Identifier' && value.name in animations) {
                        value.name = animations[value.name];
                    }
                });
            }
        }
    });

    return generate(ast, options);
};

/**
 * Scopes given CSS selector
 * @param {Object} sel
 * @param {string} scope
 * @param {CSSModuleOptions} options
 */
function rewriteSelector(sel, scope, options) {
    // To properly scope CSS selector, we have to rewrite fist and last part of it.
    // E.g. in `.foo .bar. > .baz` we have to scope `.foo` and `.baz` only
    const parts = getParts(sel);
    const localGlobal = [];
    const scopable = parts.filter(part => {
        if (part.type === 'PseudoElementSelector' && (part.name === 'global' || part.name === 'local')) {
            localGlobal.push(part);
            return false;
        }

        return true;
    });
    const first = scopable.shift();
    const last = scopable.pop();

    first && rewriteSelectorPart(sel, first, scope, options);
    last && rewriteSelectorPart(sel, last, scope, options);

    while (localGlobal.length) {
        rewriteSelectorPart(sel, localGlobal.pop(), scope, options);
    }
}

/**
 * Scopes given CSS selector fragment, if possible.
 * Returns either rewritten or the same node
 * @param {List} selector
 * @param {Object} item
 * @param {string} scope
 * @param {CSSModuleOptions} options
 * @returns {boolean}
 */
function rewriteSelectorPart(selector, item, scope, options) {
    const part = item.data;
    const list = selector.children;

    if (part.type === 'PseudoClassSelector') {
        if (part.name === 'host') {
            // :host(<sel>)
            list.insertData(raw(options.host(scope)), item);
            if (part.children) {
                list.replace(item, part.children);
            } else {
                list.remove(item);
            }
        } else if (part.name === 'host-context') {
            // :host-context(<sel>)
            if (part.children) {
                list.insertList(part.children, item);
            }
            list.insertData(raw(` ${options.host(scope)}`), item);
            list.remove(item);
        }
    } else if (part.type === 'PseudoElementSelector' && part.children) {
        if (part.name === 'slotted') {
            part.children.forEach((subSel, subSelItem) => {
                subSel.children.prependData(raw(`slot[slotted]${options.element(scope)} > `));
                list.insert(subSelItem, item);
            });
            list.remove(item);
        } else if (part.name === 'global') {
            // TODO properly handle multiple selectors
            part.children.forEach((subSel, subSelItem) => {
                list.insert(subSelItem, item);
            });
            list.remove(item);
        } else if (part.name === 'local') {
            // TODO properly handle multiple selectors
            part.children.forEach((subSel, subSelItem) => {
                list.insertData(raw(options.host(scope) + ' '), item);
                list.insert(subSelItem, item);
            });
            list.remove(item);
        }
    } else if (part.type === 'TypeSelector') {
        list.insertData(raw(options.element(scope)), item.next);
    } else if (part.type === 'IdSelector' || part.type === 'ClassSelector' || part.type === 'AttributeSelector') {
        list.insertData(raw(options.element(scope)), item);
    }
}

/**
 * Creates raw token with given value
 * @param {string} value
 */
function raw(value) {
    return { type: 'Raw', value };
}

/**
 * Concatenates two strings with optional separator
 * @param {string} name
 * @param {string} suffix
 */
function concat(name, suffix) {
    const sep = suffix[0] === '_' || suffix[0] === '-' ? '' : '-';
    return name + sep + suffix;
}

/**
 * Returns list of child items where selector part starts
 * @param {AstNode} sel
 * @returns {object[]}
 */
function getParts(sel) {
    const result = [];
    let part = null;
    sel.children.forEach((child, listItem) => {
        if (child.type === 'Combinator' || child.type === 'WhiteSpace') {
            part = null;
        } else if (!part) {
            result.push(part = listItem);
        }
    });

    return result;
}
