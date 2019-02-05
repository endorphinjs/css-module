'use strict';

import ident from './ident';
import prefixed from './prefixed';

const ID = 35; // #

/**
 * Consumes id fragment from given stream, e.g. `#foo`
 * @param  {StreamReader} stream
 * @return {Token}
 */
export default function id(stream) {
    return prefixed(stream, 'id', ID, ident);
}
