export function tokenize(input) {
    let current = 0;
    const tokens = [];

    const getLastTag = () => tokens.filter(t => t.type === 'tag').at(-1);

    const isTagBody = () => {
        const lastTag = getLastTag();

        return lastTag && lastTag.body === 'start'
    }

    const getLastTagWithChildrenStarted = () => {
        let tagStack = [];
        const tags = tokens.filter(t => t.type === 'tag');

        for (const tag of tags) {
            if (tag.children === 'start') {
                tagStack.push(tag);
            } else if (tag.children === 'end') {
                tagStack.pop();
            }
        }

        return tagStack.at(-1);
    }

    const getLastTagWithBodyStarted = () => {
        let tagStack = [];
        const tags = tokens.filter(t => t.type === 'tag');

        for (const tag of tags) {
            if (tag.body === 'start') {
                tagStack.push(tag);
            } else if (tag.body === 'end') {
                tagStack.pop();
            }
        }

        return tagStack.at(-1);
    }

    const skipSpaces = () => {
        const SPACE_REG = /\s/;

        while (SPACE_REG.test(input[current])) {
            current++;
        }
    }

    const readKebabWord = () => {
        const ACCEPTED_SYMBOLS = /[a-z-]/;
        const KEBAB_CASE = /^([a-z][a-z0-9]*)(-[a-z0-9]+)*$/;

        if (!ACCEPTED_SYMBOLS.test(input[current])) {
            throw new TypeError(`Invalid kebab word char found at ${current}: ${input[current]}`)
        }

        let value = input[current];

        while (ACCEPTED_SYMBOLS.test(input[++current]) && current < input.length) {
            value += input[current];
        }

        if (!KEBAB_CASE.test(value)) {
            throw new TypeError(`Invalid kebab word "${value}"`)
        }

        return value
    }

    const readLowerCamelWord = () => {
        const ACCEPTED_SYMBOLS = /[a-z0-9]/i
        const LOWER_CAMEL_CASE = /^[a-z][a-zA-Z0-9]+$/;

        if (!ACCEPTED_SYMBOLS.test(input[current])) {
            throw new TypeError(`Invalid lower camel case word char found at ${current}: ${input[current]}`)
        }

        let value = input[current];

        while (ACCEPTED_SYMBOLS.test(input[++current]) && current < input.length) {
            value += input[current];
        }

        if (!LOWER_CAMEL_CASE.test(value)) {
            throw new TypeError(`Invalid lower camel case word "${value}"`)
        }

        return value
    }

    const readUpperCamelWord = () => {
        const ACCEPTED_SYMBOLS = /[a-z0-9]/i
        const UPPER_CAMEL_CASE = /^[A-Z][a-zA-Z0-9]+$/;

        if (!ACCEPTED_SYMBOLS.test(input[current])) {
            throw new TypeError(`Invalid upper camel case word char found at ${current}: ${input[current]}`)
        }

        let value = input[current];

        while (ACCEPTED_SYMBOLS.test(input[++current]) && current < input.length) {
            value += input[current];
        }

        if (!UPPER_CAMEL_CASE.test(value)) {
            throw new TypeError(`Invalid upper camel case word "${value}"`)
        }

        return value
    }

    const readSerialValue = () => {
        const SERIAL_VALUE = /^[a-z][a-z0-9]*$/i

        if (input[current] !== '{') {
            throw new TypeError(`Invalid serial value. "{" expected at ${current}, not "${input[current]}"`)
        }

        let value = '';
        current++;

        while (input[current] !== '}') {
            value += input[current++];
        }

        if (!SERIAL_VALUE.test(value)) {
            throw new TypeError(`Invalid serial value found at ${current}: ${value}`)
        }

        current++;
        skipSpaces();

        return value;
    }

    const readStringValue = () => {
        if (input[current] !== '"') {
            throw new TypeError(`Invalid string value. '"' expected at ${current}, not '${input[current]}'`)
        }

        let value = '';
        current++;

        while (input[current] !== '"') {
            value += input[current++];
        }

        current++;
        skipSpaces();

        return value;
    }

    const readAttrToken = () => {
        const name = readLowerCamelWord();

        if (input[current] !== '=') {
            skipSpaces();
            return {name, valueType: 'empty', value: null};
        }

        current++;
        skipSpaces();

        if (input[current] === '{') {
            return {name, valueType: 'serial', value: readSerialValue()};
        } else if (input[current] === '"') {
            return {name, valueType: 'string', value: readStringValue()};
        } else {
            throw new TypeError(`Unresolved attribute value at ${current}. '{' or '"' expected, got ''${input[current]}`);
        }
    }

    const readPropsToken = () => {
        if (input[current] !== '$') {
            throw new TypeError(`Invalid props prefix at ${current}. '$' expected, got '${input[current]}'`)
        }

        const lastTag = getLastTag();

        if (!isTagBody() || !lastTag.isCustom) {
            throw new TypeError(`Trying to pass props at ${current}: Props are only allowed inside custom tag's body`)
        }

        current++;
        const name = readLowerCamelWord();

        if (input[current] !== '=') {
            throw new TypeError(`Invalid prop "$${name}" at ${current}: Empty props are not allowed`)
        }

        current++;
        skipSpaces();

        if (input[current] === '{') {
            return {name, valueType: 'serial', value: readSerialValue()};
        } else if (input[current] === '"') {
            return {name, valueType: 'string', value: readStringValue()};
        } else {
            throw new TypeError(`Unresolved attribute value at ${current}. '{' or '"' expected, got ''${input[current]}`);
        }
    }

    const readTextToken = () => {
        const TEXT_CHUNK_REG = /[^<>{}]/;

        if (!TEXT_CHUNK_REG.test(input[current])) {
            throw new TypeError(`Invalid text token chunk found at ${current}: ${input[current]}`)
        }

        let value = input[current];

        while (TEXT_CHUNK_REG.test(input[++current]) && current < input.length) {
            value += input[current];
        }
        return value.trim();
    }

    const readOpenedTag = () => {
        if (input[current] !== '<') {
            throw new TypeError(`Invalid opened tag. "<" expected at ${current}, not "${input[current]}"`);
        }

        current++;
        skipSpaces();

        const UPPER = /[A-Z]/;

        if (input[current] === '/') {
            current++;
            skipSpaces();

            const isCustom = UPPER.test(input[current]);
            const tagName = isCustom ? readUpperCamelWord(): readKebabWord();
            skipSpaces();

            if (input[current] !== '>') {
                throw new TypeError(`Invalid end tag. ">" expected at ${current}, not "${input[current]}"`);
            }

            current++;
            skipSpaces();

            if (!getLastTagWithChildrenStarted()) {
                throw new TypeError(`Trying to closed not opened tag: ${tagName}`);
            }

            return {name: tagName, isCustom: isCustom, isStart: false};
        }

        const isCustom = UPPER.test(input[current]);
        const tagName = isCustom ? readUpperCamelWord(): readKebabWord();
        skipSpaces();

        return {name: tagName, isCustom: isCustom, isStart: true};
    }

    const readChildFreeTagBodyEnd = () => {
        if (input[current] !== '/') {
            throw new TypeError(`Invalid closing end tag. "/" expected at ${current}, not "${input[current]}"`);
        }

        current++;
        skipSpaces();

        if (input[current] !== '>') {
            throw new TypeError(`Invalid closing end tag. ">" expected at ${current}, not "${input[current]}"`);
        }

        current++;
        skipSpaces();

        const tag = getLastTagWithBodyStarted();

        if (!tag) {
            throw new TypeError(`Trying to close an unopened tag at ${current}`);
        }
        return tag;
    }

    const readChildrenStartTag = () => {
        if (input[current] !== '>') {
            throw new TypeError(`Invalid children start tag. ">" expected at ${current}, not "${input[current]}"`);
        }

        current++;
        skipSpaces();

        const tag = getLastTagWithBodyStarted();

        if (!tag) {
            throw new TypeError(`Trying to close an unopened tag at ${current}`);
        }
        return tag;
    }

    skipSpaces();

    while (current < input.length) {
        let char = input[current];

        if (char === '<') {
            const {name, isCustom, isStart} = readOpenedTag();
            tokens.push({
                type: 'tag',
                name,
                isCustom,
                body: isStart ? 'start' : null,
                children: isStart ? null : 'end',
            });

            continue;
        }

        if (char === '/') {
            const {name, isCustom} = readChildFreeTagBodyEnd();
            tokens.push({
                type: 'tag',
                name,
                isCustom,
                body: 'end',
                children: null,
            });

            continue;
        }

        if (char === '>') {
            const tag = readChildrenStartTag();

            tokens.push({
                type: 'tag',
                name: tag.name,
                body: 'end',
                children: 'start',
            });

            continue;
        }

        if (char === '{') {
            const value = readSerialValue();
            tokens.push({type: 'serial', value});

            continue;
        }

        if (isTagBody()) {
            const isProps = char === '$';
            const {name, valueType, value} = isProps ? readPropsToken() : readAttrToken();

            isProps
                ? tokens.push({type: 'props', name, valueType, value})
                : tokens.push({type: 'attr', name, valueType, value});
            continue
        }

        const text = readTextToken();
        tokens.push({type: 'text', value: text});
    }

    const unclosedBodyTag = getLastTagWithBodyStarted();
    if (unclosedBodyTag) throw new TypeError(`Unclosed tag body detected: ${unclosedBodyTag.name}. Add "/>"`);

    const unclosedChildrenTag = getLastTagWithChildrenStarted();
    if (unclosedChildrenTag)
        throw new TypeError(`Unclosed children of tag "${unclosedChildrenTag}" detected. Add "</ ${unclosedChildrenTag.name}>" closing tag`);

    return tokens;
}