/**
 * Sample function for testing
 */
function sampleFunction(param: string): string {
    return `Hello, ${param}!`;
}

/**
 * Sample class for testing
 */
class SampleClass {
    private value: number;

    constructor(value: number) {
        this.value = value;
    }

    /**
     * Sample method
     */
    getValue(): number {
        return this.value;
    }

    setValue(newValue: number): void {
        this.value = newValue;
    }
}

/**
 * Arrow function variable
 */
const arrowFunction = (x: number, y: number) => x + y;

const regularVariable = "test value";