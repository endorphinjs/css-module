'use strict';

export function consume(stream, match) {
    const start = stream.pos;
    if (stream.eat(match)) {
        stream.start = start;
        return true;
    }

    return false;
}

export function consumeWhile(stream, match) {
    const start = stream.pos;
    if (stream.eatWhile(match)) {
        stream.start = start;
        return true;
    }

    return false;
}

export function last(arr) {
    return arr[arr.length - 1];
}
