# Contributing Guidelines

## Overview

IDE Constellation follows a structured development approach with clear coding standards, testing requirements, and contribution workflows. This document outlines the practices and conventions for contributing to the project.

## Development Workflow

### Branch Strategy

The project uses a feature-branch workflow:

```
main (stable)
├── feature/structural-indexing (current major feature)
├── feature/symbol-search (future)
├── bugfix/parser-error-handling
└── docs/update-architecture
```

**Branch Naming Conventions**:
- `feature/description` - New features or enhancements
- `bugfix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring without functional changes

### Commit Message Format

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

**Examples**:
```
feat(parser): add variable and arrow function support

Implement VariableDeclarator visitor to extract variables and arrow functions.
Includes logic to distinguish between regular variables and function assignments.

Closes #123
```

```
fix(filesystem): handle directory creation errors gracefully

Add proper error handling for directory creation failures in FileSystemService.
Prevents extension crashes when .constellation directory cannot be created.
```

## Code Standards

### TypeScript Configuration

The project uses strict TypeScript settings defined in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**Key Requirements**:
- All functions must have explicit return types
- No `any` types without justification
- Unused variables and parameters not allowed
- Strict null checks enabled

### Code Style

**File Organization**:
```typescript
// 1. External imports
import * as vscode from 'vscode';
import { parse } from '@babel/parser';

// 2. Internal imports
import { CodeSymbol } from '../types';

// 3. Type definitions (if any)
interface LocalInterface {
  // ...
}

// 4. Class/function implementations
export class ServiceName {
  // ...
}
```

**Naming Conventions**:
- **Classes**: PascalCase (`CodeParserService`)
- **Methods/Functions**: camelCase (`parseFile`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_FILE_SIZE`)
- **Interfaces**: PascalCase (`CodeSymbol`)
- **Files**: PascalCase for classes (`CodeParserService.ts`)

**Method Documentation**:
All public methods must include JSDoc comments:

```typescript
/**
 * Parse TypeScript code and extract code symbols
 * @param filePath - Relative path from workspace root
 * @param code - TypeScript source code
 * @returns Array of CodeSymbol objects
 * @throws Error if parsing fails critically
 */
static parse(filePath: string, code: string): CodeSymbol[] {
  // Implementation
}
```

### Error Handling Standards

**Service Layer Error Handling**:
```typescript
// ✅ Good: Graceful error handling with logging
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  console.error(`Operation failed: ${error.message}`);
  return fallbackValue;
}

// ❌ Bad: Unhandled errors that crash extension
const result = await riskyOperation(); // Can throw
```

**Error Message Format**:
```typescript
// ✅ Good: Descriptive error messages
throw new Error(`Failed to read file ${uri.fsPath}: ${errorMessage}`);

// ❌ Bad: Generic error messages
throw new Error('Something went wrong');
```

## Testing Requirements

### Test Structure

All services must have corresponding test files:
```
src/services/
├── CodeParserService.ts
├── CodeParserService.test.ts
├── FileSystemService.ts
└── FileSystemService.test.ts
```

### Test Categories

**Unit Tests** (Required for all services):
```typescript
describe('CodeParserService', () => {
  describe('parse', () => {
    it('should extract function declarations with basic metadata', () => {
      const code = `function getUserData() { return {}; }`;
      const symbols = CodeParserService.parse('test.ts', code);
      
      expect(symbols).toHaveLength(1);
      expect(symbols[0].name).toBe('getUserData');
      expect(symbols[0].kind).toBe('function');
    });
  });
});
```

**Integration Tests** (For complex workflows):
```typescript
describe('End-to-end parsing', () => {
  it('should handle complete TypeScript files', async () => {
    const fileContent = await readTestFile('sample.ts');
    const symbols = CodeParserService.parse('sample.ts', fileContent);
    
    // Verify all expected symbols are extracted
    expect(symbols.filter(s => s.kind === 'function')).toHaveLength(3);
    expect(symbols.filter(s => s.kind === 'class')).toHaveLength(1);
  });
});
```

### Test Data Management

**Test Files**: Store sample code in test files or inline strings:
```typescript
const sampleCode = `
/**
 * Sample function for testing
 */
function testFunction(param: string): string {
  return param.toUpperCase();
}
`;
```

**Mock Data**: Use consistent mock data across tests:
```typescript
const mockCodeSymbol: CodeSymbol = {
  id: 'test.ts#testFunction',
  name: 'testFunction',
  kind: 'function',
  filePath: 'test.ts',
  position: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
  docstring: '/** Sample function */'
};
```

### Test Coverage Requirements

- **Minimum Coverage**: 80% line coverage for all service files
- **Critical Paths**: 100% coverage for error handling paths
- **Edge Cases**: Tests for empty inputs, malformed data, boundary conditions

**Running Tests**:
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npx vitest run src/services/CodeParserService.test.ts
```

## Pull Request Process

### Before Submitting

1. **Run Tests**: Ensure all tests pass
   ```bash
   npm test
   ```

2. **Type Check**: Verify TypeScript compilation
   ```bash
   npm run compile
   ```

3. **Manual Testing**: Test in Extension Development Host
   - Launch extension with F5
   - Test affected functionality
   - Verify no console errors

### PR Requirements

**PR Title Format**:
```
feat(parser): add support for arrow functions and variables

- Implement VariableDeclarator AST visitor
- Add logic to distinguish functions from variables  
- Include comprehensive test coverage
- Update documentation for new symbol types
```

**Required Sections**:
- **Description**: What changes were made and why
- **Testing**: How the changes were tested
- **Breaking Changes**: Any API or behavior changes
- **Related Issues**: Link to GitHub issues

**Checklist**:
- [ ] Tests added/updated and passing
- [ ] TypeScript compilation successful
- [ ] Documentation updated if needed
- [ ] No console errors in Extension Development Host
- [ ] Code follows project style guidelines

### Review Process

**Automated Checks**:
- TypeScript compilation
- Test suite execution
- Code style validation (future: ESLint integration)

**Manual Review Focus**:
- Code correctness and logic
- Test coverage and quality
- Error handling robustness
- Performance implications
- API design consistency

## Development Environment Setup

### Required Tools

- **Node.js**: 18.0.0+ (for development dependencies)
- **VS Code**: 1.74.0+ (for extension testing)
- **Git**: For version control

### Recommended VS Code Extensions

- **TypeScript Importer**: Auto-import management
- **Error Lens**: Inline error display
- **GitLens**: Enhanced Git integration
- **Thunder Client**: API testing (future REST endpoints)

### Development Scripts

```bash
# Development workflow
npm run watch          # Continuous TypeScript compilation
npm run test:watch     # Continuous test execution
npm run compile        # One-time compilation

# Quality assurance
npm test              # Run full test suite
npm run type-check    # TypeScript type checking (future)
npm run lint          # Code style checking (future)
```

## Code Review Guidelines

### For Authors

**Before Requesting Review**:
- Self-review your changes
- Ensure tests cover new functionality
- Update documentation for public APIs
- Test manually in Extension Development Host

**Responding to Feedback**:
- Address all review comments
- Ask for clarification if feedback is unclear
- Update tests if implementation changes
- Re-request review after changes

### For Reviewers

**Review Checklist**:
- [ ] Code correctness and logic
- [ ] Test coverage adequacy
- [ ] Error handling robustness
- [ ] Performance considerations
- [ ] API design consistency
- [ ] Documentation completeness

**Feedback Guidelines**:
- Be specific and constructive
- Suggest improvements, not just problems
- Consider maintainability and extensibility
- Verify test quality, not just coverage

## Release Process

### Version Management

The project follows semantic versioning (SemVer):
- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features, backward compatible
- **Patch** (0.0.1): Bug fixes, backward compatible

### Release Checklist

1. **Pre-release Testing**:
   - Full test suite passes
   - Manual testing in clean VS Code instance
   - Performance regression testing

2. **Documentation Updates**:
   - Update CHANGELOG.md
   - Review and update README.md
   - Verify API documentation accuracy

3. **Build and Package**:
   - Clean build: `npm run compile`
   - Package extension: `vsce package`
   - Test packaged extension

## Getting Help

### Resources

- **Project Documentation**: `/docs` directory
- **Feature Specifications**: `.kiro/specs/` directory
- **VS Code Extension API**: [Official Documentation](https://code.visualstudio.com/api)
- **Babel Parser**: [Documentation](https://babeljs.io/docs/en/babel-parser)

### Communication

- **Issues**: Use GitHub Issues for bugs and feature requests
- **Discussions**: GitHub Discussions for questions and ideas
- **Code Review**: Use PR comments for code-specific discussions

### Common Issues

**TypeScript Errors**:
- Check `tsconfig.json` configuration
- Verify all imports are properly typed
- Use `npm run compile` to see detailed errors

**Test Failures**:
- Run tests individually to isolate issues
- Check for async/await issues in test code
- Verify mock data matches expected interfaces

**Extension Loading Issues**:
- Ensure compilation succeeded
- Check VS Code Developer Console for errors
- Verify extension manifest (`package.json`) is valid