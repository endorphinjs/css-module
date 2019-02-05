'use strict';

import ident from './ident';
import prefixed from './prefixed';

const CLASS = 46; // .

/**
 * Consumes class fragment from given stream, e.g. `.foo`
 * @param  {StreamReader} stream
 * @return {ClassToken}
 */
export default function className(stream) {
    return prefixed(stream, 'class', CLASS, ident);
}
