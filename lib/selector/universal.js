'use strict';

import Token from './token';
import { consume } from './utils';

/**
 * Consumes universal selector (*)
 */
export default function universal(stream) {
    return consume(stream, 42) && new Token(stream, 'universal');
}
