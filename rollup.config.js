'use strict';

export default {
    input: './index.js',
    external: [
        '@emmetio/stream-reader',
        '@emmetio/stream-reader-utils',
        'postcss'
    ],
    output: [{
        file: 'dist/css-modules.es.js',
        format: 'es',
        sourcemap: true
    }, {
        file: 'dist/css-modules.cjs.js',
        format: 'cjs',
        sourcemap: true
    }]
};
