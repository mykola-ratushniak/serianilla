import {renderAST, renderDiff} from "./internal/renderer.js";
import {refreshEvents} from "./internal/events.js";
import {StateManager} from "./internal/state-manager.js";
import {unwrapComponentTree} from "./internal/unwrapper.js";
import {findUsedEvents} from "./internal/traversers.js";

export const Serianilla = (function () {
    const _templateMap = new Map();

    let _virtualDOM;
    let _rootComponent;
    let _eventSet;
    let _stateTimeout = null;
    let _stateManager;
    let _isEffectInProgress = false;

    const _updateVirtualDOM = () => {
        _stateManager.reset();

        const node = unwrapComponentTree(_rootComponent, _stateManager, _templateMap);
        const newEventSet = findUsedEvents(node);

        const candidateDOM = {
            type: 'RootNode',
            children: [node]
        };
        node.parent = candidateDOM;
        renderDiff(_virtualDOM, candidateDOM);

        refreshEvents(_virtualDOM.ref, _eventSet, newEventSet);
        _eventSet = newEventSet;
    }

    return {
        render(rootElement, rootComponent) {
            _eventSet = new Set();
            _rootComponent = rootComponent;

            _stateManager = new StateManager();

            const node = unwrapComponentTree(_rootComponent, _stateManager, _templateMap);
            const newEventSet = findUsedEvents(node);

            _virtualDOM = {
                type: 'RootNode',
                ref: rootElement,
                children: [node]
            }
            node.parent = _virtualDOM;
            renderAST(_virtualDOM);

            refreshEvents(_virtualDOM.ref, _eventSet, newEventSet);
            _eventSet = newEventSet;
        },

        useState(initialValue) {
            const states = _stateManager.currentBucket.states;
            const index = _stateManager.currentStateIndex;

            if (states[index] === undefined) {
                states[index] = initialValue;
            }

            const setValue = (newValue) => {
                if (Object.is(newValue, states[index])) {
                    return;
                }
                states[index] = newValue;

                if (_stateTimeout) {
                    return;
                }
                _stateTimeout = setTimeout(() => {
                    _updateVirtualDOM();
                    _stateTimeout = null;
                }, 0);
            };

            return [states[index], setValue];
        },

        useEffect(callback, deps) {
            const stateIndex = _stateManager.currentStateIndex;

            const _deps = _stateManager.currentBucket.states[stateIndex];
            const hasChanges = _deps ? deps.some((d, i) => !Object.is(d, _deps[i])) : false;

            if (!_deps || hasChanges) {
                setTimeout(callback, 0);
                _stateManager.currentBucket.states[stateIndex] = deps;
            }
        },

        useEffectAsync(asyncCallback, deps) {
            if (_isEffectInProgress) {
                return;
            }
            _isEffectInProgress = true;
            const stateIndex = _stateManager.currentStateIndex;

            const _deps = _stateManager.currentBucket.states[stateIndex];
            const hasChanges = _deps ? deps.some((d, i) => !Object.is(d, _deps[i])) : false;

            if (!_deps || hasChanges) {
                setTimeout(async () => {
                    await asyncCallback();
                    _isEffectInProgress = false;
                }, 0);
                _stateManager.currentBucket.states[stateIndex] = deps;
            }
        },

        useRef(initialValue) {
            const states = _stateManager.currentBucket.states;
            const index = _stateManager.currentStateIndex;

            if (states[index] === undefined) {
                states[index] = {current: initialValue};
            }
            return states[index];
        }
    }
})();