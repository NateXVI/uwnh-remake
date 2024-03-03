/**
 * Takes a function as a parameter and returns a new function that can only be called once.
 * @param {Function} func 
 */
export function once(func) {
    let called = false;
    return function (...args) {
        if (called) return;
        called = true;
        return func(...args);
    };
}
