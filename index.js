const { parse, walk, generate } = require('css-tree');

/**
 * Isolates given CSS code with `scope` token
 * @param {string} code CSS source to rewrite
 * @param {string} scope CSS scoping token
 * @param {Object} [options] Options for CSS Tree parser
 */
module.exports = function rewriteCSS(code, scope, options) {
    const ast = parse(code, options);
    const animations = {};

    walk(ast, function(node) {
        if (node.type === 'Selector') {
            if (!this.atrule || this.atrule.name !== 'keyframes') {
                // Do no rewrite selectors inside @keyframes
                rewriteSelector(node, scope);
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
 */
function rewriteSelector(sel, scope) {
    // To properly scope CSS selector, we have to rewrite fist and last part of it.
    // E.g. in `.foo .bar. > .baz` we have to scope `.foo` and `.baz` only
    const parts = getParts(sel);
    const first = parts.shift(), last = parts.pop();

    first && rewriteSelectorPart2(sel, first, scope);
    last && rewriteSelectorPart2(sel, last, scope);
}

/**
 * Scopes given CSS selector fragment, if possible.
 * Returns either rewritten or the same node
 * @param {List} selector
 * @param {Object} item
 * @param {string} scope
 * @returns {boolean}
 */
function rewriteSelectorPart2(selector, item, scope) {
    const part = item.data;
    const list = selector.children;

    if (part.type === 'PseudoClassSelector') {
        if (part.name === 'host') {
            // :host(<sel>)
            list.insertData(raw(`[${scope}-host]`), item);
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
            list.insertData(raw(` [${scope}-host]`), item);
            list.remove(item);
        }
    } else if (part.type === 'PseudoElementSelector' && part.name === 'slotted') {
        if (part.children) {
            part.children.forEach((subSel, subSelItem) => {
                subSel.children.prependData(raw(`slot[slotted][${scope}] > `));
                list.insert(subSelItem, item);
            });
            list.remove(item);
        }
    } else if (part.type === 'TypeSelector') {
        list.insertData(raw(`[${scope}]`), item.next);
    } else if (part.type === 'IdSelector' || part.type === 'ClassSelector' || part.type === 'AttributeSelector') {
        list.insertData(raw(`[${scope}]`), item);
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
