'use strict';

import * as postcss from 'postcss';
import StreamReader from '@emmetio/stream-reader';
import consumeToken, { args } from './lib/selector/index';

export default postcss.plugin('endorphin-css-modules', options => {
    if (typeof options === 'string') {
        options = { component: options };
    }

    if (!options || !options.component) {
        throw new Error('Component name must be provided!');
    }

    const component = options.component;
    const suffix = options.suffix || `_${component}`;
    const selectorSuffix = `[${suffix}]`;

    return root => {
        root.walkRules(rule => {
            if (!isKeyframesRule(rule.parent)) {
                // Do not rewrite rules inside `@keyframes` and its variations
                rule.selectors = rule.selectors.map(sel => rewriteSelector(sel, component, selectorSuffix));
            }
        });
        rewriteAnimations(root, suffix);
    };
});

/**
 * Переписывает селектор: заменяет различные фрагменты селектора (имя элемента,
 * класс, идентификатор) на класс с суффиксом модуля
 * @param  {String} selector Селектор, который нужно переписать
 * @param  {String} component Название модуля, используется для перезаписи `:host`
 * @param  {String} suffix Суффикс, который нужно добавить частям селектора
 * @return {String} Переписанный селектор
 */
function rewriteSelector(selector, component, suffix) {
    const stream = new StreamReader(selector);
    let token, next, result = '';
    let added = false;

    const addSuffix = () => {
        if (!added) {
            result += suffix;
            added = true;
        }
    };

    while (!stream.eof()) {
        if (token = consumeToken(stream)) {
            if (isPseudo(token, 'host')) {
                // Попали в `:host` — это описание компонента. Также этот селектор
                // может содержать уточняющий селектор в виде аргумента функции:
                // его мы (пока) запишем как есть
                result += component;
                next = args(stream);
                if (next) {
                    for (let j = 0, jl = next.size; j < jl; j++) {
                        result += next.item(j).valueOf();
                    }
                }
            } else if (isPseudo(token, 'host-context')) {
                // Попали в `:host-context(<sel>)` — это описание компонента,
                // который находится внутри `<sel>`.
                next = args(stream);
                if (next) {
                    for (let j = 0, jl = next.size; j < jl; j++) {
                        result += next.item(j).valueOf();
                    }
                }
                result += ` ${component}`;
            } else if (isPseudo(token, 'slotted')) {
                // Попали в псевдо-селектор ::slotted() — это функция,
                // которая содержит другой селектор, который должен сматчится
                // только в том случае, если он пришёл из внешнего слота
                next = args(stream);
                if (next) {
                    result += `slot[slotted]${suffix} > `;
                    for (let j = 0, jl = next.size; j < jl; j++) {
                        result += next.item(j).valueOf();
                    }
                }
            } else if (token.type === 'ident' || token.type === 'id' || token.type === 'universal') {
                result += token.valueOf();
                addSuffix();
            } else if (token.type === 'combinator' || token.type === 'whitespace') {
                added = false;
                result += token.valueOf();
            } else if (token.type === 'class' || token.type === 'attribute') {
                result += token.valueOf();
                addSuffix();
            } else {
                result += token.valueOf();
            }
        } else {
            stream.start = stream.pos;
            stream.next();
            result += stream.current();
        }
    }

    return result;
}

/**
 * Перезапись анимаций (@keyframes): добавляет всем используемым анимациям внутри
 * CSS-модуля указанный префикс. Если используемая анимация отсутствует, она
 * не переписывается
 * @param  {Root}   root
 * @param  {String} suffix
 */
function rewriteAnimations(root, suffix) {
    const animations = new Set();

    root.walkAtRules(rule => {
        if (isKeyframesRule(rule) && rule.params) {
            animations.add(rule.params);
            rule.params += suffix;
        }
    });

    root.walkDecls(decl => {
        if (decl.prop === 'animation' || decl.prop === 'animation-name') {
            const parts = decl.value.split(' ');

            // Переписываем только объявленные в текущем файле анимации,
            // для остальных подразумеваем, что они объявлены глобально и менять
            // их нельзя
            if (animations.has(parts[0])) {
                parts[0] += suffix;
                decl.value = parts.join(' ');
            }
        }
    });
}

function isKeyframesRule(rule) {
    return rule && rule.type === 'atrule' && /\bkeyframes$/.test(rule.name);
}

function isPseudo(token, name) {
    return token.type === 'pseudo' && token.item(0) && token.item(0).valueOf() === name;
}
