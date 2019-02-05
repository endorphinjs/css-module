'use strict';

import { isQuote } from '@emmetio/stream-reader-utils';
import Token from './token';

/**
 * Consumes quoted string from current string and returns token with consumed
 * data or `null`, if string wasn’t consumed
 * @param  {StreamReader} stream
 * @return {Token}
 */
export default function string(stream) {
    let ch = stream.peek(), pos;

    if (isQuote(ch)) {
        stream.start = stream.pos;
        stream.next();

        const quote = ch;
        const valueStart = stream.pos;

        while (!stream.eof()) {
            pos = stream.pos;
            if (stream.eat(quote) || stream.eat(isNewline)) {
                // found end of string or newline without preceding '\',
                // which is not allowed (don’t throw error, for now)
                break;
            } else if (stream.eat(92 /* \ */)) {
                // backslash allows newline in string
                stream.eat(isNewline);
            }

            stream.next();
        }

        const token = new Token(stream, 'string');
        token.add(new Token(stream, 'unquoted', valueStart, pos));
        token.property('quote', quote);
        return token;
    }

    return false;
}

function isNewline(code) {
    return code === 10  /* LF */ || code === 13 /* CR */;
}
