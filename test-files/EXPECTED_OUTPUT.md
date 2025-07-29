# Expected AI-Generated Documentation Examples

## For `simple-functions.ts`

### calculateArea function
```typescript
/**
 * Calculates the area of a rectangle by multiplying width and height
 * @param {number} width The width of the rectangle
 * @param {number} height The height of the rectangle
 * @returns {number} The calculated area
 */
function calculateArea(width: number, height: number): number {
    return width * height;
}
```

### formatUserName function
```typescript
/**
 * Formats a user's full name from first name, last name, and optional middle initial
 * @param {string} firstName The user's first name
 * @param {string} lastName The user's last name
 * @param {string} middleInitial Optional middle initial
 * @returns {string} The formatted full name
 */
function formatUserName(firstName: string, lastName: string, middleInitial?: string): string {
    // ... implementation
}
```

### validateEmail function
```typescript
/**
 * Validates an email address using regex pattern matching
 * @param {string} email The email address to validate
 * @returns {boolean} True if email is valid, false otherwise
 */
const validateEmail = (email: string): boolean => {
    // ... implementation
};
```

## For `mixed-documentation.ts`

Only the undocumented functions should get AI-generated docs:

### subtract function
```typescript
/**
 * Subtracts the second number from the first number
 * @param {number} a The number to subtract from
 * @param {number} b The number to subtract
 * @returns {number} The result of a minus b
 */
function subtract(a: number, b: number): number {
    return a - b;
}
```

### Calculator.divide method
```typescript
/**
 * Divides the first number by the second number with zero-division protection
 * @param {number} x The dividend
 * @param {number} y The divisor
 * @returns {number} The quotient of x divided by y
 * @throws {Error} When attempting to divide by zero
 */
divide(x: number, y: number): number {
    // ... implementation
}
```

## Console Output Example

When you save a test file, you should see output like:

```
📝 Starting file-level documentation processing: /path/to/simple-functions.ts
🔍 Parsing symbols from simple-functions.ts (XXX characters)
📊 Extracted 4 symbols from simple-functions.ts
📋 Symbol classification: 0 documented, 4 undocumented
🤖 Starting AI-powered documentation generation for 4 undocumented symbols
⏳ Waiting for 4 concurrent documentation tasks to complete...
🔄 Processing symbol 1/4: calculateArea (function)
🔄 Processing symbol 2/4: formatUserName (function)
🔄 Processing symbol 3/4: validateEmail (function)
🔄 Processing symbol 4/4: processArray (function)
📝 Generated raw JSDoc for calculateArea: /**...
🔍 Parsed JSDoc for calculateArea: description length 65, 2 params
✅ Successfully generated documentation for calculateArea
📝 Generated raw JSDoc for formatUserName: /**...
🔍 Parsed JSDoc for formatUserName: description length 78, 3 params
✅ Successfully generated documentation for formatUserName
... (similar for other functions)
✅ AI documentation generation completed: 4 successful, 0 failed
✅ File-level documentation completed: /path/to/simple-functions.ts
```

## Generated Files

After processing, you should find:
- `/docs/api/simple-functions.md` - Markdown documentation file
- Console logs showing the AI-generated JSDoc comments
- The original source files remain unchanged (documentation is stored separately)

## Error Scenarios

If the LLM service fails, you'll see fallback documentation like:
```typescript
/**
 * calculateArea - Documentation generation failed, manual review required
 * @todo Add proper documentation
 */
```

## Performance Notes

- All 4 functions in `simple-functions.ts` should be processed concurrently
- Processing time depends on LLM API response time
- File save operations remain responsive (background processing)