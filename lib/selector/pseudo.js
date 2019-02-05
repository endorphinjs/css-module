'use strict';

import Token from './token';
import ident from './ident';

const PSEUDO = 58; // :

/**
 * Consumes pseudo-selector from given stream
 */
export default function(stream) {
    const start = stream.pos;

    if (stream.eatWhile(PSEUDO)) {
        const name = ident(stream);
        if (name) {
            return new Token(stream, 'pseudo', start).add(name);
        }
    }

    stream.pos = start;
}
