import { describe, it, expect, vi } from 'vitest';
import { CodeParserService } from './CodeParserService';

describe('CodeParserService', () => {
    describe('parse', () => {
        it('should skip parsing files larger than 1MB', () => {
            // Create a large code string (over 1MB)
            const largeCode = 'function test() {}\n'.repeat(100000); // Creates a file > 1MB

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            const symbols = CodeParserService.parse('large-test.ts', largeCode);

            expect(symbols).toHaveLength(0);
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Skipping parsing of large file')
            );

            consoleSpy.mockRestore();
        });

        it('should extract function declarations with basic metadata', () => {
            const code = `
function getUserData() {
  return { name: 'John', age: 30 };
}

function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
`;

            const symbols = CodeParserService.parse('src/api.ts', code);

            expect(symbols).toHaveLength(2);

            // Check first function
            expect(symbols[0]).toEqual({
                id: 'src/api.ts#getUserData',
                name: 'getUserData',
                kind: 'function',
                filePath: 'src/api.ts',
                position: {
                    start: { line: 1, character: 0 },
                    end: { line: 3, character: 1 }
                },
                docstring: null
            });

            // Check second function
            expect(symbols[1]).toEqual({
                id: 'src/api.ts#calculateTotal',
                name: 'calculateTotal',
                kind: 'function',
                filePath: 'src/api.ts',
                position: {
                    start: { line: 5, character: 0 },
                    end: { line: 7, character: 1 }
                },
                docstring: null
            });
        });

        it('should extract JSDoc comments as docstrings', () => {
            const code = `
/**
 * Fetches user data from the API
 * @param userId - The ID of the user
 * @returns User object with name and email
 */
function fetchUser(userId) {
  return api.get(\`/users/\${userId}\`);
}

/**
 * Simple greeting function
 */
function sayHello() {
  return 'Hello World';
}
`;

            const symbols = CodeParserService.parse('src/user.ts', code);

            expect(symbols).toHaveLength(2);

            // Check function with detailed JSDoc
            expect(symbols[0].docstring).toBe(`/**
 * Fetches user data from the API
 * @param userId - The ID of the user
 * @returns User object with name and email
 */`);

            // Check function with simple JSDoc
            expect(symbols[1].docstring).toBe(`/**
 * Simple greeting function
 */`);
        });

        it('should handle TypeScript syntax correctly', () => {
            const code = `
interface User {
  name: string;
  age: number;
}

function processUser(user: User): string {
  return \`User: \${user.name}, Age: \${user.age}\`;
}

function createUser<T extends User>(data: T): T {
  return { ...data, id: Math.random() };
}
`;

            const symbols = CodeParserService.parse('src/types.ts', code);

            expect(symbols).toHaveLength(2);
            expect(symbols[0].name).toBe('processUser');
            expect(symbols[1].name).toBe('createUser');
        });

        it('should skip anonymous functions', () => {
            const code = `
const anonymousFunc = function() {
  return 'anonymous';
};

const arrowFunc = () => {
  return 'arrow';
};

function namedFunction() {
  return 'named';
}
`;

            const symbols = CodeParserService.parse('src/funcs.ts', code);

            // Should find the named function plus the two variable declarations (which are functions)
            expect(symbols).toHaveLength(3);

            const functions = symbols.filter(s => s.kind === 'function');
            expect(functions).toHaveLength(3);

            // All should be functions now (named function + arrow function + function expression)
            const functionNames = functions.map(f => f.name).sort();
            expect(functionNames).toEqual(['anonymousFunc', 'arrowFunc', 'namedFunction']);
        });

        it('should handle parsing errors gracefully', () => {
            const invalidCode = `
function invalidSyntax( {
  return 'broken';
}
`;

            // Should not throw, but return empty array
            const symbols = CodeParserService.parse('src/broken.ts', invalidCode);
            expect(symbols).toEqual([]);
        });

        it('should handle empty files', () => {
            const emptyCode = '';

            const symbols = CodeParserService.parse('src/empty.ts', emptyCode);
            expect(symbols).toEqual([]);
        });

        it('should handle files with only comments', () => {
            const commentOnlyCode = `
// This is just a comment file
/* 
 * Block comment
 */
`;

            const symbols = CodeParserService.parse('src/comments.ts', commentOnlyCode);
            expect(symbols).toEqual([]);
        });

        it('should extract correct position information', () => {
            const code = `// Line 0
function firstFunction() { // Line 1
  return 'first'; // Line 2
} // Line 3

function secondFunction() { // Line 5
  return 'second';
}`;

            const symbols = CodeParserService.parse('src/positions.ts', code);

            expect(symbols).toHaveLength(2);

            // First function should start at line 1 (0-based)
            expect(symbols[0].position.start.line).toBe(1);
            expect(symbols[0].position.end.line).toBe(3);

            // Second function should start at line 5 (0-based)
            expect(symbols[1].position.start.line).toBe(5);
        });

        describe('class parsing', () => {
            it('should extract class declarations with basic metadata', () => {
                const code = `
/**
 * User management class
 */
class UserManager {
  private users: User[] = [];
  
  constructor() {
    this.users = [];
  }
}

class ApiClient {
  baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
}
`;

                const symbols = CodeParserService.parse('src/classes.ts', code);

                // Should find 2 classes (constructor is not included as separate symbol)
                const classes = symbols.filter(s => s.kind === 'class');
                expect(classes).toHaveLength(2);

                // Check first class
                expect(classes[0]).toEqual({
                    id: 'src/classes.ts#UserManager',
                    name: 'UserManager',
                    kind: 'class',
                    filePath: 'src/classes.ts',
                    position: {
                        start: { line: 4, character: 0 },
                        end: { line: 10, character: 1 }
                    },
                    docstring: `/**
 * User management class
 */`
                });

                // Check second class
                expect(classes[1]).toEqual({
                    id: 'src/classes.ts#ApiClient',
                    name: 'ApiClient',
                    kind: 'class',
                    filePath: 'src/classes.ts',
                    position: {
                        start: { line: 12, character: 0 },
                        end: { line: 18, character: 1 }
                    },
                    docstring: null
                });
            });

            it('should extract class methods with proper IDs', () => {
                const code = `
class Calculator {
  private result: number = 0;

  /**
   * Add two numbers
   */
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }

  /**
   * Get the current result
   */
  getResult(): number {
    return this.result;
  }
}
`;

                const symbols = CodeParserService.parse('src/calculator.ts', code);

                // Should find 1 class and 3 methods
                const classes = symbols.filter(s => s.kind === 'class');
                const methods = symbols.filter(s => s.kind === 'method');

                expect(classes).toHaveLength(1);
                expect(methods).toHaveLength(3);

                // Check class
                expect(classes[0].name).toBe('Calculator');
                expect(classes[0].id).toBe('src/calculator.ts#Calculator');

                // Check methods with class context in ID
                expect(methods[0]).toEqual({
                    id: 'src/calculator.ts#Calculator.add',
                    name: 'add',
                    kind: 'method',
                    filePath: 'src/calculator.ts',
                    position: {
                        start: { line: 7, character: 2 },
                        end: { line: 9, character: 3 }
                    },
                    docstring: `/**
   * Add two numbers
   */`
                });

                expect(methods[1]).toEqual({
                    id: 'src/calculator.ts#Calculator.subtract',
                    name: 'subtract',
                    kind: 'method',
                    filePath: 'src/calculator.ts',
                    position: {
                        start: { line: 11, character: 2 },
                        end: { line: 13, character: 3 }
                    },
                    docstring: null
                });

                expect(methods[2]).toEqual({
                    id: 'src/calculator.ts#Calculator.getResult',
                    name: 'getResult',
                    kind: 'method',
                    filePath: 'src/calculator.ts',
                    position: {
                        start: { line: 18, character: 2 },
                        end: { line: 20, character: 3 }
                    },
                    docstring: `/**
   * Get the current result
   */`
                });
            });

            it('should handle multiple classes with methods', () => {
                const code = `
class UserService {
  getUser(id: string) {
    return { id, name: 'User' };
  }
}

class OrderService {
  createOrder(userId: string) {
    return { id: '123', userId };
  }
  
  getOrder(id: string) {
    return { id, status: 'pending' };
  }
}
`;

                const symbols = CodeParserService.parse('src/services.ts', code);

                const classes = symbols.filter(s => s.kind === 'class');
                const methods = symbols.filter(s => s.kind === 'method');

                expect(classes).toHaveLength(2);
                expect(methods).toHaveLength(3);

                // Check that method IDs include correct class names
                const userMethod = methods.find(m => m.name === 'getUser');
                const orderMethods = methods.filter(m => m.id.includes('OrderService'));

                expect(userMethod?.id).toBe('src/services.ts#UserService.getUser');
                expect(orderMethods).toHaveLength(2);
                expect(orderMethods[0].id).toBe('src/services.ts#OrderService.createOrder');
                expect(orderMethods[1].id).toBe('src/services.ts#OrderService.getOrder');
            });

            it('should skip constructor methods', () => {
                const code = `
class Example {
  constructor(name: string) {
    this.name = name;
  }
  
  getName(): string {
    return this.name;
  }
}
`;

                const symbols = CodeParserService.parse('src/example.ts', code);

                const classes = symbols.filter(s => s.kind === 'class');
                const methods = symbols.filter(s => s.kind === 'method');

                expect(classes).toHaveLength(1);
                expect(methods).toHaveLength(1); // Only getName, not constructor
                expect(methods[0].name).toBe('getName');
            });

            it('should handle classes with static methods', () => {
                const code = `
class MathUtils {
  static PI = 3.14159;
  
  static calculateArea(radius: number): number {
    return MathUtils.PI * radius * radius;
  }
  
  instanceMethod(): void {
    console.log('instance');
  }
}
`;

                const symbols = CodeParserService.parse('src/math.ts', code);

                const classes = symbols.filter(s => s.kind === 'class');
                const methods = symbols.filter(s => s.kind === 'method');

                expect(classes).toHaveLength(1);
                expect(methods).toHaveLength(2); // Both static and instance methods

                const staticMethod = methods.find(m => m.name === 'calculateArea');
                const instanceMethod = methods.find(m => m.name === 'instanceMethod');

                expect(staticMethod?.id).toBe('src/math.ts#MathUtils.calculateArea');
                expect(instanceMethod?.id).toBe('src/math.ts#MathUtils.instanceMethod');
            });

            it('should handle TypeScript class syntax with access modifiers', () => {
                const code = `
class DataProcessor {
  private data: any[] = [];
  
  public addData(item: any): void {
    this.data.push(item);
  }
  
  protected processData(): any[] {
    return this.data.map(item => ({ ...item, processed: true }));
  }
  
  private validateData(item: any): boolean {
    return item !== null && item !== undefined;
  }
}
`;

                const symbols = CodeParserService.parse('src/processor.ts', code);

                const classes = symbols.filter(s => s.kind === 'class');
                const methods = symbols.filter(s => s.kind === 'method');

                expect(classes).toHaveLength(1);
                expect(methods).toHaveLength(3);

                // All methods should be extracted regardless of access modifier
                const methodNames = methods.map(m => m.name).sort();
                expect(methodNames).toEqual(['addData', 'processData', 'validateData']);
            });
        });

        describe('variable and arrow function parsing', () => {
            it('should extract arrow functions as function symbols', () => {
                const code = `
/**
 * Arrow function for user processing
 */
const processUser = (user: User) => {
  return { ...user, processed: true };
};

const calculateTotal = (items: Item[]) => items.reduce((sum, item) => sum + item.price, 0);

/**
 * Multi-line arrow function
 */
const complexOperation = (data: any[]) => {
  const filtered = data.filter(item => item.active);
  return filtered.map(item => ({ ...item, timestamp: Date.now() }));
};
`;

                const symbols = CodeParserService.parse('src/arrows.ts', code);

                const arrowFunctions = symbols.filter(s => s.kind === 'function');
                expect(arrowFunctions).toHaveLength(3);

                // Check first arrow function with docstring
                expect(arrowFunctions[0]).toEqual({
                    id: 'src/arrows.ts#processUser',
                    name: 'processUser',
                    kind: 'function',
                    filePath: 'src/arrows.ts',
                    position: {
                        start: { line: 4, character: 6 },
                        end: { line: 6, character: 1 }
                    },
                    docstring: `/**
 * Arrow function for user processing
 */`
                });

                // Check second arrow function without docstring
                expect(arrowFunctions[1]).toEqual({
                    id: 'src/arrows.ts#calculateTotal',
                    name: 'calculateTotal',
                    kind: 'function',
                    filePath: 'src/arrows.ts',
                    position: {
                        start: { line: 8, character: 6 },
                        end: { line: 8, character: 90 }
                    },
                    docstring: null
                });

                // Check third arrow function with docstring
                expect(arrowFunctions[2]).toEqual({
                    id: 'src/arrows.ts#complexOperation',
                    name: 'complexOperation',
                    kind: 'function',
                    filePath: 'src/arrows.ts',
                    position: {
                        start: { line: 13, character: 6 },
                        end: { line: 16, character: 1 }
                    },
                    docstring: `/**
 * Multi-line arrow function
 */`
                });
            });

            it('should extract function expressions as function symbols', () => {
                const code = `
/**
 * Function expression for data validation
 */
const validateData = function(data: any): boolean {
  return data !== null && data !== undefined;
};

const anonymousHandler = function() {
  console.log('Anonymous function expression');
};
`;

                const symbols = CodeParserService.parse('src/expressions.ts', code);

                const functionExpressions = symbols.filter(s => s.kind === 'function');
                expect(functionExpressions).toHaveLength(2);

                // Check first function expression with docstring
                expect(functionExpressions[0]).toEqual({
                    id: 'src/expressions.ts#validateData',
                    name: 'validateData',
                    kind: 'function',
                    filePath: 'src/expressions.ts',
                    position: {
                        start: { line: 4, character: 6 },
                        end: { line: 6, character: 1 }
                    },
                    docstring: `/**
 * Function expression for data validation
 */`
                });

                // Check second function expression without docstring
                expect(functionExpressions[1]).toEqual({
                    id: 'src/expressions.ts#anonymousHandler',
                    name: 'anonymousHandler',
                    kind: 'function',
                    filePath: 'src/expressions.ts',
                    position: {
                        start: { line: 8, character: 6 },
                        end: { line: 10, character: 1 }
                    },
                    docstring: null
                });
            });

            it('should extract regular variables as variable symbols', () => {
                const code = `
/**
 * Configuration constant
 */
const API_BASE_URL = 'https://api.example.com';

const MAX_RETRIES = 3;

/**
 * User preferences object
 */
let userPreferences = {
  theme: 'dark',
  language: 'en'
};

var legacyVariable = 'old style';

const complexObject = {
  nested: {
    value: 42
  },
  method: function() { return 'not extracted'; }
};
`;

                const symbols = CodeParserService.parse('src/variables.ts', code);

                const variables = symbols.filter(s => s.kind === 'variable');
                expect(variables).toHaveLength(5);

                // Check constant with docstring
                expect(variables[0]).toEqual({
                    id: 'src/variables.ts#API_BASE_URL',
                    name: 'API_BASE_URL',
                    kind: 'variable',
                    filePath: 'src/variables.ts',
                    position: {
                        start: { line: 4, character: 6 },
                        end: { line: 4, character: 46 }
                    },
                    docstring: `/**
 * Configuration constant
 */`
                });

                // Check simple constant without docstring
                expect(variables[1]).toEqual({
                    id: 'src/variables.ts#MAX_RETRIES',
                    name: 'MAX_RETRIES',
                    kind: 'variable',
                    filePath: 'src/variables.ts',
                    position: {
                        start: { line: 6, character: 6 },
                        end: { line: 6, character: 21 }
                    },
                    docstring: null
                });

                // Check let variable with docstring
                expect(variables[2]).toEqual({
                    id: 'src/variables.ts#userPreferences',
                    name: 'userPreferences',
                    kind: 'variable',
                    filePath: 'src/variables.ts',
                    position: {
                        start: { line: 11, character: 4 },
                        end: { line: 14, character: 1 }
                    },
                    docstring: `/**
 * User preferences object
 */`
                });

                // Check var variable
                expect(variables[3]).toEqual({
                    id: 'src/variables.ts#legacyVariable',
                    name: 'legacyVariable',
                    kind: 'variable',
                    filePath: 'src/variables.ts',
                    position: {
                        start: { line: 16, character: 4 },
                        end: { line: 16, character: 32 }
                    },
                    docstring: null
                });

                // Check complex object
                expect(variables[4]).toEqual({
                    id: 'src/variables.ts#complexObject',
                    name: 'complexObject',
                    kind: 'variable',
                    filePath: 'src/variables.ts',
                    position: {
                        start: { line: 18, character: 6 },
                        end: { line: 23, character: 1 }
                    },
                    docstring: null
                });
            });

            it('should distinguish between arrow functions and variables correctly', () => {
                const code = `
// Arrow function
const arrowFunc = () => 'arrow';

// Function expression
const funcExpr = function() { return 'func'; };

// Regular variable
const regularVar = 'just a string';

// Object with method (should be variable, not function)
const objWithMethod = {
  method: () => 'method'
};

// Array
const arrayVar = [1, 2, 3];

// Number
const numberVar = 42;
`;

                const symbols = CodeParserService.parse('src/mixed.ts', code);

                const functions = symbols.filter(s => s.kind === 'function');
                const variables = symbols.filter(s => s.kind === 'variable');

                expect(functions).toHaveLength(2);
                expect(variables).toHaveLength(4);

                // Check functions
                expect(functions[0].name).toBe('arrowFunc');
                expect(functions[1].name).toBe('funcExpr');

                // Check variables
                const variableNames = variables.map(v => v.name).sort();
                expect(variableNames).toEqual(['arrayVar', 'numberVar', 'objWithMethod', 'regularVar']);
            });

            it('should handle TypeScript arrow functions with type annotations', () => {
                const code = `
/**
 * Typed arrow function
 */
const typedArrow = (x: number, y: number): number => x + y;

const genericArrow = <T>(items: T[]): T[] => items.filter(Boolean);

/**
 * Async arrow function
 */
const asyncArrow = async (id: string): Promise<User> => {
  return await fetchUser(id);
};
`;

                const symbols = CodeParserService.parse('src/typed.ts', code);

                const functions = symbols.filter(s => s.kind === 'function');
                expect(functions).toHaveLength(3);

                // Check typed arrow function
                expect(functions[0]).toEqual({
                    id: 'src/typed.ts#typedArrow',
                    name: 'typedArrow',
                    kind: 'function',
                    filePath: 'src/typed.ts',
                    position: {
                        start: { line: 4, character: 6 },
                        end: { line: 4, character: 58 }
                    },
                    docstring: `/**
 * Typed arrow function
 */`
                });

                // Check generic arrow function
                expect(functions[1]).toEqual({
                    id: 'src/typed.ts#genericArrow',
                    name: 'genericArrow',
                    kind: 'function',
                    filePath: 'src/typed.ts',
                    position: {
                        start: { line: 6, character: 6 },
                        end: { line: 6, character: 66 }
                    },
                    docstring: null
                });

                // Check async arrow function
                expect(functions[2]).toEqual({
                    id: 'src/typed.ts#asyncArrow',
                    name: 'asyncArrow',
                    kind: 'function',
                    filePath: 'src/typed.ts',
                    position: {
                        start: { line: 11, character: 6 },
                        end: { line: 13, character: 1 }
                    },
                    docstring: `/**
 * Async arrow function
 */`
                });
            });

            it('should skip destructuring patterns in variable declarations', () => {
                const code = `
// These should be skipped (destructuring patterns)
const { name, age } = user;
const [first, second] = array;
const { data: { nested } } = response;

// These should be extracted (simple identifiers)
const userName = user.name;
const userAge = user.age;
`;

                const symbols = CodeParserService.parse('src/destructuring.ts', code);

                const variables = symbols.filter(s => s.kind === 'variable');
                expect(variables).toHaveLength(2);

                expect(variables[0].name).toBe('userName');
                expect(variables[1].name).toBe('userAge');
            });

            it('should handle variables with no initializer', () => {
                const code = `
let uninitializedVar: string;
var anotherUninit: number;
const mustHaveInit = 'value';
`;

                const symbols = CodeParserService.parse('src/uninit.ts', code);

                const variables = symbols.filter(s => s.kind === 'variable');
                expect(variables).toHaveLength(3);

                // All should be variables since no initializer means no function
                expect(variables[0].name).toBe('uninitializedVar');
                expect(variables[0].kind).toBe('variable');
                expect(variables[1].name).toBe('anotherUninit');
                expect(variables[1].kind).toBe('variable');
                expect(variables[2].name).toBe('mustHaveInit');
                expect(variables[2].kind).toBe('variable');
            });
        });

        describe('mixed symbol types', () => {
            it('should extract functions, classes, and methods together', () => {
                const code = `
/**
 * Utility function
 */
function utilityFunction() {
  return 'utility';
}

/**
 * Main application class
 */
class Application {
  private name: string;
  
  constructor(name: string) {
    this.name = name;
  }
  
  /**
   * Start the application
   */
  start(): void {
    console.log(\`Starting \${this.name}\`);
  }
  
  stop(): void {
    console.log('Stopping application');
  }
}

function anotherFunction() {
  return new Application('test');
}
`;

                const symbols = CodeParserService.parse('src/app.ts', code);

                const functions = symbols.filter(s => s.kind === 'function');
                const classes = symbols.filter(s => s.kind === 'class');
                const methods = symbols.filter(s => s.kind === 'method');

                expect(functions).toHaveLength(2);
                expect(classes).toHaveLength(1);
                expect(methods).toHaveLength(2);

                // Check that all symbols have correct IDs
                expect(functions[0].id).toBe('src/app.ts#utilityFunction');
                expect(functions[1].id).toBe('src/app.ts#anotherFunction');
                expect(classes[0].id).toBe('src/app.ts#Application');
                expect(methods[0].id).toBe('src/app.ts#Application.start');
                expect(methods[1].id).toBe('src/app.ts#Application.stop');
            });

            it('should extract all symbol types including variables and arrow functions', () => {
                const code = `
/**
 * Regular function
 */
function regularFunc() {
  return 'regular';
}

/**
 * Configuration constant
 */
const CONFIG = { api: 'https://api.com' };

/**
 * Arrow function for processing
 */
const processData = (data: any[]) => data.map(item => item.id);

/**
 * Service class
 */
class DataService {
  /**
   * Fetch data method
   */
  fetchData(): Promise<any[]> {
    return Promise.resolve([]);
  }
}

const serviceInstance = new DataService();
`;

                const symbols = CodeParserService.parse('src/complete.ts', code);

                const functions = symbols.filter(s => s.kind === 'function');
                const variables = symbols.filter(s => s.kind === 'variable');
                const classes = symbols.filter(s => s.kind === 'class');
                const methods = symbols.filter(s => s.kind === 'method');

                expect(functions).toHaveLength(2); // regularFunc + processData
                expect(variables).toHaveLength(2); // CONFIG + serviceInstance
                expect(classes).toHaveLength(1); // DataService
                expect(methods).toHaveLength(1); // fetchData

                // Verify specific symbols
                expect(functions.find(f => f.name === 'regularFunc')).toBeDefined();
                expect(functions.find(f => f.name === 'processData')).toBeDefined();
                expect(variables.find(v => v.name === 'CONFIG')).toBeDefined();
                expect(variables.find(v => v.name === 'serviceInstance')).toBeDefined();
                expect(classes.find(c => c.name === 'DataService')).toBeDefined();
                expect(methods.find(m => m.name === 'fetchData')).toBeDefined();
            });
        });
    });
});