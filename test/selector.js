'use strict';

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { equal } from 'assert';
import postcss from 'postcss';
import plugin from '../index';

describe('Rule replacer', () => {
    const read = file => readFileSync(resolve(__dirname, file), 'utf8');

    it('should update rules with module name', () => {
        const processor = postcss([ plugin('my-module') ]);
        const input = read('./fixtures/input.css');

        return processor.process(input, { from: 'input.css' }).then(result => {
            equal(result.css, read('./fixtures/output.css'));
        });
    });

    it('should apply custom suffix', () => {
        const processor = postcss([
            plugin({
                component: 'end-module2',
                suffix: 'sf'
            })
        ]);

        return processor.process(':host{} .a {}', { from: undefined }).then(result => {
            equal(result.css, 'end-module2{} .a[sf] {}');
        });
    });
});
