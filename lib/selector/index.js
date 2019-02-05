'use strict';

import _args from './arguments';
import attribute from './attribute';
import className from './class';
import combinator from './combinator';
import comment from './comment';
import pseudo from './pseudo';
import id from './id';
import ident from './ident';
import universal from './universal';
import whitespace from './whitespace';

export default function selector(stream) {
    return ident(stream) || className(stream) || id(stream) || attribute(stream)
        || pseudo(stream) || combinator(stream) || universal(stream) || args(stream)
        || whitespace(stream) || comment(stream);
}

export function args(stream) {
    return _args(stream, selector);
}

export { ident };
