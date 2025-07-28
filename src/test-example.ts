/**
 * Test file to verify structural indexing
 */

/**
 * A simple test function that returns a greeting
 * @returns A hello world string
 */
export function testFunction(): string {
    return "Hello, World!";
}

/**
 * A test class demonstrating property and method extraction
 */
export class TestClass {
    private value: number = 0;
    
    /**
     * Gets the current value
     * @returns The current value
     */
    public getValue(): number {
        return this.value;
    }
}

/**
 * Test interface for demonstrating interface extraction
 */
export interface TestInterface {
    /** The person's name */
    name: string;
    /** The person's age */
    age: number;
}
