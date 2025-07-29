// Test file 2: Mixed documented and undocumented code

/**
 * Calculates the sum of two numbers
 * @param a First number
 * @param b Second number
 * @returns The sum of a and b
 */
function add(a: number, b: number): number {
    return a + b;
}

// This function has no documentation - should get AI-generated docs
function subtract(a: number, b: number): number {
    return a - b;
}

class Calculator {
    /**
     * Multiplies two numbers
     * @param x First number
     * @param y Second number
     * @returns Product of x and y
     */
    multiply(x: number, y: number): number {
        return x * y;
    }

    // This method has no documentation - should get AI-generated docs
    divide(x: number, y: number): number {
        if (y === 0) {
            throw new Error('Division by zero');
        }
        return x / y;
    }

    // Another undocumented method
    power(base: number, exponent: number): number {
        return Math.pow(base, exponent);
    }
}