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

    if (first) {
        first.data = rewriteSelectorPart(first.data, scope);
    }

    if (last) {
        last.data = rewriteSelectorPart(last.data, scope);
    }
}

/**
 * Scopes given CSS selector fragment, if possible.
 * Returns either rewritten or the same node
 * @param {Object} part
 * @param {string} scope
 * @returns {boolean}
 */
function rewriteSelectorPart(part, scope) {
    if (part.type === 'PseudoClassSelector') {
        if (part.name === 'host') {
            // :host(<sel>)
            return raw(`[${scope}-host]${rawContent(part)}`, part);
        }

        if (part.name === 'host-context') {
            // :host-context(<sel>)
            return raw(`${rawContent(part)} [${scope}-host]`, part);
        }
    }

    if (part.type === 'PseudoElementSelector' && part.name === 'slotted') {
        const content = rawContent(part);

        if (content) {
            return raw(`slot[slotted][${scope}] > ${content}`, part);
        }
    }

    if (part.type === 'TypeSelector') {
        return raw(`${part.name}[${scope}]`, part);
    }

    if (part.type === 'IdSelector') {
        return raw(`[${scope}]#${part.name}`, part);
    }

    if (part.type === 'ClassSelector') {
        return raw(`[${scope}].${part.name}`, part);
    }

    if (part.type === 'AttributeSelector') {
        return raw(`[${scope}]${generate(part)}`, part);
    }

    return part;
}

/**
 * Creates raw token with given value
 * @param {string} value
 * @param {Object} [src]
 */
function raw(value, src) {
    return {
        type: 'Raw',
        loc: src && src.loc,
        value
    };
}

function rawContent(node) {
    let content = '';
    walk(node, child => {
        if (child.type === 'Selector') {
            content = generate(child);
        } else if (child.type === 'Raw') {
            content = child.value;
        }
    });

    return content;
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
