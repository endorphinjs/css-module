'use strict';

import { isAlpha, isNumber } from '@emmetio/stream-reader-utils';
import Token from './token';

const HYPHEN     = 45;
const UNDERSCORE = 95;

export default function ident(stream) {
    const start = stream.pos;

    stream.eat(HYPHEN);
    if (stream.eat(isIdentStart)) {
        stream.eatWhile(isIdent);
        return new Token(stream, 'ident', start);
    }

    stream.pos = start;
}

export function isIdentStart(code) {
    return code === UNDERSCORE || code === HYPHEN || isAlpha(code) || code >= 128;
}

export function isIdent(code) {
    return isNumber(code) || isIdentStart(code);
}
