import { describe, it, expect } from 'vitest';
import { CodeParserService } from './CodeParserService';

describe('CodeParserService', () => {
  describe('parse', () => {
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
      
      // Should only find the named function, not the anonymous ones
      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('namedFunction');
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
  });
});