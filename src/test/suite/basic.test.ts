import * as assert from 'assert';

suite('Basic Test Suite', () => {
    test('should pass a simple assertion', () => {
        assert.strictEqual(1 + 1, 2);
    });

    test('should pass another simple assertion', () => {
        assert.ok(true, 'This should always pass');
    });
});