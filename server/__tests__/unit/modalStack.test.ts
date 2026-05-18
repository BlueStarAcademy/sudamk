import { describe, expect, it } from 'vitest';
import {
    bringModalStackEntryToFront,
    getModalStackDepth,
    isModalStackEntryTop,
    registerModalStackEntry,
    resetModalStackForTests,
    unregisterModalStackEntry,
} from '../../../utils/modalStack.js';

describe('modalStack', () => {
    it('later registration stacks above earlier', () => {
        resetModalStackForTests();
        const z1 = registerModalStackEntry('a');
        const z2 = registerModalStackEntry('b');
        expect(z2).toBeGreaterThan(z1);
        expect(isModalStackEntryTop('b')).toBe(true);
        expect(isModalStackEntryTop('a')).toBe(false);
    });

    it('bringToFront reorders without duplicate entries', () => {
        resetModalStackForTests();
        registerModalStackEntry('a');
        registerModalStackEntry('b');
        registerModalStackEntry('c');
        expect(getModalStackDepth()).toBe(3);
        const z = bringModalStackEntryToFront('a', 50);
        expect(z).toBeGreaterThan(50);
        expect(isModalStackEntryTop('a')).toBe(true);
        expect(getModalStackDepth()).toBe(3);
    });

    it('unregister removes entry', () => {
        resetModalStackForTests();
        registerModalStackEntry('a');
        registerModalStackEntry('b');
        unregisterModalStackEntry('b');
        expect(getModalStackDepth()).toBe(1);
        expect(isModalStackEntryTop('a')).toBe(true);
    });
});
