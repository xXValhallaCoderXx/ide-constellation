import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { generateDependencyGraph, DependencyGraph, EmptyDependencyGraph } from '../analyzer';

describe('Analyzer Module Unit Tests', () => {
	let tempDir: string;
	let sampleProjectPath: string;

	beforeAll(() => {
		// Set up paths for testing
		sampleProjectPath = path.join(__dirname, '../../sample-project');
	});

	beforeEach(() => {
		// Create a temporary directory for each test
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analyzer-test-'));
	});

	afterEach(() => {
		// Clean up temporary directory after each test
		if (tempDir && fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	describe('Successful Dependency Analysis Scenarios', () => {
		it('should analyze sample project with known dependencies', async () => {
			const result = await generateDependencyGraph(sampleProjectPath);
			
			// Verify basic structure
			expect(result).toBeDefined();
			expect(Array.isArray(result.modules)).toBe(true);
			expect(result.summary).toBeDefined();
			expect(typeof result.summary.totalDependencies).toBe('number');
			expect(Array.isArray(result.summary.violations)).toBe(true);
			
			// Should not have error in successful analysis
			expect(result.summary.error).toBeUndefined();
			
			// Should find modules (at least the sample files)
			expect(result.modules.length).toBeGreaterThan(0);
			
			// Verify module structure
			result.modules.forEach(module => {
				expect(typeof module.source).toBe('string');
				expect(Array.isArray(module.dependencies)).toBe(true);
				expect(Array.isArray(module.dependents)).toBe(true);
				
				// Verify dependency structure
				module.dependencies.forEach(dep => {
					expect(typeof dep.resolved).toBe('string');
					expect(typeof dep.coreModule).toBe('boolean');
					expect(typeof dep.followable).toBe('boolean');
					expect(typeof dep.dynamic).toBe('boolean');
				});
			});
		});

		it('should handle TypeScript files if present', async () => {
			// Create a temporary TypeScript project
			const tsProjectPath = path.join(tempDir, 'ts-project');
			fs.mkdirSync(tsProjectPath);
			
			// Create TypeScript files
			fs.writeFileSync(path.join(tsProjectPath, 'index.ts'), `
				import { helper } from './helper';
				console.log(helper());
			`);
			
			fs.writeFileSync(path.join(tsProjectPath, 'helper.ts'), `
				export function helper(): string {
					return 'Hello from TypeScript';
				}
			`);
			
			fs.writeFileSync(path.join(tsProjectPath, 'package.json'), JSON.stringify({
				name: 'ts-test-project',
				version: '1.0.0'
			}));

			const result = await generateDependencyGraph(tsProjectPath);
			
			// Should successfully analyze TypeScript files
			expect(result).toBeDefined();
			expect(result.summary.error).toBeUndefined();
			expect(result.modules.length).toBeGreaterThan(0);
		});

		it('should handle mixed JavaScript and TypeScript files', async () => {
			// Create a mixed project
			const mixedProjectPath = path.join(tempDir, 'mixed-project');
			fs.mkdirSync(mixedProjectPath);
			
			fs.writeFileSync(path.join(mixedProjectPath, 'index.js'), `
				const helper = require('./helper.ts');
				console.log(helper.help());
			`);
			
			fs.writeFileSync(path.join(mixedProjectPath, 'helper.ts'), `
				export function help(): string {
					return 'Mixed project helper';
				}
			`);
			
			fs.writeFileSync(path.join(mixedProjectPath, 'package.json'), JSON.stringify({
				name: 'mixed-test-project',
				version: '1.0.0'
			}));

			const result = await generateDependencyGraph(mixedProjectPath);
			
			expect(result).toBeDefined();
			expect(result.modules.length).toBeGreaterThan(0);
		});
	});

	describe('Error Handling with Invalid Workspaces', () => {
		it('should handle non-existent workspace path', async () => {
			const nonExistentPath = path.join(tempDir, 'does-not-exist');
			const result = await generateDependencyGraph(nonExistentPath);
			
			// Should return fallback graph with error
			expect(result).toBeDefined();
			expect(result.summary.error).toBeDefined();
			expect(result.modules.length).toBe(0);
			expect(result.summary.totalDependencies).toBe(0);
			expect(result.summary.error).toContain('does not exist');
		});

		it('should handle file path instead of directory', async () => {
			// Create a file instead of directory
			const filePath = path.join(tempDir, 'not-a-directory.txt');
			fs.writeFileSync(filePath, 'This is a file, not a directory');
			
			const result = await generateDependencyGraph(filePath);
			
			expect(result).toBeDefined();
			expect(result.summary.error).toBeDefined();
			expect(result.modules.length).toBe(0);
			expect(result.summary.error).toContain('not a directory');
		});

		it('should handle empty string workspace path', async () => {
			const result = await generateDependencyGraph('');
			
			expect(result).toBeDefined();
			expect(result.summary.error).toBeDefined();
			expect(result.modules.length).toBe(0);
			expect(result.summary.error).toContain('required');
		});

		it('should handle null/undefined workspace path', async () => {
			const resultNull = await generateDependencyGraph(null as any);
			const resultUndefined = await generateDependencyGraph(undefined as any);
			
			// Both should return error graphs
			expect(resultNull.summary.error).toBeDefined();
			expect(resultUndefined.summary.error).toBeDefined();
			expect(resultNull.modules.length).toBe(0);
			expect(resultUndefined.modules.length).toBe(0);
		});

		it('should handle workspace with permission issues', async () => {
			// Skip this test on Windows as permission handling is different
			if (process.platform === 'win32') {
				return;
			}

			// Create directory with restricted permissions
			const restrictedPath = path.join(tempDir, 'restricted');
			fs.mkdirSync(restrictedPath);
			
			// Create a file inside first
			fs.writeFileSync(path.join(restrictedPath, 'test.js'), 'console.log("test");');
			
			// Remove read permissions
			fs.chmodSync(restrictedPath, 0o000);
			
			try {
				const result = await generateDependencyGraph(restrictedPath);
				
				expect(result).toBeDefined();
				expect(result.summary.error).toBeDefined();
				expect(result.modules.length).toBe(0);
				expect(result.summary.error).toMatch(/Cannot read|Permission/);
			} finally {
				// Restore permissions for cleanup
				try {
					fs.chmodSync(restrictedPath, 0o755);
				} catch (e) {
					// Ignore cleanup errors
				}
			}
		});
	});

	describe('Empty Directory Handling', () => {
		it('should handle completely empty directory', async () => {
			// tempDir is already empty
			const result = await generateDependencyGraph(tempDir);
			
			expect(result).toBeDefined();
			expect(result.summary.error).toBeDefined();
			expect(result.modules.length).toBe(0);
			expect(result.summary.totalDependencies).toBe(0);
			expect(result.summary.error).toContain('analyzable files');
		});

		it('should handle directory with only non-analyzable files', async () => {
			// Create directory with only non-JS/TS files
			const nonAnalyzablePath = path.join(tempDir, 'non-analyzable');
			fs.mkdirSync(nonAnalyzablePath);
			
			fs.writeFileSync(path.join(nonAnalyzablePath, 'README.md'), '# Test Project');
			fs.writeFileSync(path.join(nonAnalyzablePath, 'config.json'), '{}');
			fs.writeFileSync(path.join(nonAnalyzablePath, 'style.css'), 'body { margin: 0; }');
			fs.writeFileSync(path.join(nonAnalyzablePath, 'data.txt'), 'Some data');
			
			const result = await generateDependencyGraph(nonAnalyzablePath);
			
			expect(result).toBeDefined();
			expect(result.summary.error).toBeDefined();
			expect(result.modules.length).toBe(0);
			expect(result.summary.error).toContain('analyzable files');
		});

		it('should handle directory with only node_modules', async () => {
			// Create directory with only node_modules (should be excluded)
			const nodeModulesOnlyPath = path.join(tempDir, 'node-modules-only');
			fs.mkdirSync(nodeModulesOnlyPath);
			
			const nodeModulesPath = path.join(nodeModulesOnlyPath, 'node_modules');
			fs.mkdirSync(nodeModulesPath);
			fs.mkdirSync(path.join(nodeModulesPath, 'some-package'));
			fs.writeFileSync(path.join(nodeModulesPath, 'some-package', 'index.js'), 'module.exports = {};');
			
			const result = await generateDependencyGraph(nodeModulesOnlyPath);
			
			expect(result).toBeDefined();
			expect(result.summary.error).toBeDefined();
			expect(result.modules.length).toBe(0);
			expect(result.summary.error).toContain('analyzable files');
		});
	});

	describe('Syntax Error Resilience', () => {
		it('should handle files with syntax errors', async () => {
			// Create project with syntax errors
			const syntaxErrorPath = path.join(tempDir, 'syntax-error-project');
			fs.mkdirSync(syntaxErrorPath);
			
			// Create file with syntax error
			fs.writeFileSync(path.join(syntaxErrorPath, 'broken.js'), `
				const x = {
					missing: 'closing brace'
				// Missing closing brace
				console.log('This will cause syntax error');
			`);
			
			// Create valid file
			fs.writeFileSync(path.join(syntaxErrorPath, 'valid.js'), `
				console.log('This is valid JavaScript');
				module.exports = { valid: true };
			`);
			
			fs.writeFileSync(path.join(syntaxErrorPath, 'package.json'), JSON.stringify({
				name: 'syntax-error-test',
				version: '1.0.0'
			}));

			const result = await generateDependencyGraph(syntaxErrorPath);
			
			// Should not crash and should return some result
			expect(result).toBeDefined();
			
			// Depending on dependency-cruiser behavior, it might:
			// 1. Return partial results (analyzing valid files)
			// 2. Return error graph
			// Either is acceptable as long as it doesn't crash
			expect(typeof result.summary.totalDependencies).toBe('number');
			expect(Array.isArray(result.modules)).toBe(true);
			expect(Array.isArray(result.summary.violations)).toBe(true);
		});

		it('should handle files with import/require errors', async () => {
			// Create project with import errors
			const importErrorPath = path.join(tempDir, 'import-error-project');
			fs.mkdirSync(importErrorPath);
			
			// Create file that imports non-existent module
			fs.writeFileSync(path.join(importErrorPath, 'importer.js'), `
				const nonExistent = require('./does-not-exist');
				const alsoMissing = require('missing-package');
				
				console.log('This file has import errors');
				module.exports = { importer: true };
			`);
			
			fs.writeFileSync(path.join(importErrorPath, 'package.json'), JSON.stringify({
				name: 'import-error-test',
				version: '1.0.0'
			}));

			const result = await generateDependencyGraph(importErrorPath);
			
			// Should handle gracefully
			expect(result).toBeDefined();
			expect(typeof result.summary.totalDependencies).toBe('number');
			expect(Array.isArray(result.modules)).toBe(true);
		});

		it('should handle mixed valid and invalid files', async () => {
			// Create project with mix of valid and invalid files
			const mixedPath = path.join(tempDir, 'mixed-validity-project');
			fs.mkdirSync(mixedPath);
			
			// Valid file
			fs.writeFileSync(path.join(mixedPath, 'good.js'), `
				const helper = require('./helper');
				module.exports = { good: true };
			`);
			
			// Another valid file
			fs.writeFileSync(path.join(mixedPath, 'helper.js'), `
				module.exports = { help: () => 'helping' };
			`);
			
			// Invalid file
			fs.writeFileSync(path.join(mixedPath, 'bad.js'), `
				const x = {{{{{ invalid syntax
				require('./nonexistent'
			`);
			
			fs.writeFileSync(path.join(mixedPath, 'package.json'), JSON.stringify({
				name: 'mixed-validity-test',
				version: '1.0.0'
			}));

			const result = await generateDependencyGraph(mixedPath);
			
			// Should process what it can
			expect(result).toBeDefined();
			expect(Array.isArray(result.modules)).toBe(true);
			
			// Should find at least some modules (the valid ones)
			// Note: dependency-cruiser might still process some files despite syntax errors
		});
	});

	describe('Edge Cases and Boundary Conditions', () => {
		it('should handle very deep directory structures', async () => {
			// Create deep directory structure
			const deepPath = path.join(tempDir, 'deep-project');
			let currentPath = deepPath;
			
			// Create 5 levels deep
			for (let i = 0; i < 5; i++) {
				currentPath = path.join(currentPath, `level${i}`);
				fs.mkdirSync(currentPath, { recursive: true });
			}
			
			// Add a JS file at the deepest level
			fs.writeFileSync(path.join(currentPath, 'deep.js'), `
				console.log('Deep file');
				module.exports = { deep: true };
			`);
			
			// Add package.json at root
			fs.writeFileSync(path.join(deepPath, 'package.json'), JSON.stringify({
				name: 'deep-test',
				version: '1.0.0'
			}));

			const result = await generateDependencyGraph(deepPath);
			
			expect(result).toBeDefined();
			// Should handle deep structures without issues
		});

		it('should handle circular dependencies', async () => {
			// Create project with circular dependencies
			const circularPath = path.join(tempDir, 'circular-project');
			fs.mkdirSync(circularPath);
			
			// File A requires B
			fs.writeFileSync(path.join(circularPath, 'a.js'), `
				const b = require('./b');
				console.log('A loaded');
				module.exports = { fromA: true, b };
			`);
			
			// File B requires A (circular)
			fs.writeFileSync(path.join(circularPath, 'b.js'), `
				const a = require('./a');
				console.log('B loaded');
				module.exports = { fromB: true, a };
			`);
			
			fs.writeFileSync(path.join(circularPath, 'package.json'), JSON.stringify({
				name: 'circular-test',
				version: '1.0.0'
			}));

			const result = await generateDependencyGraph(circularPath);
			
			// Should handle circular dependencies gracefully
			expect(result).toBeDefined();
			expect(Array.isArray(result.modules)).toBe(true);
			
			// Might have violations for circular dependencies
			if (result.summary.violations.length > 0) {
				// Check if violations are properly structured
				result.summary.violations.forEach(violation => {
					expect(typeof violation.from).toBe('string');
					expect(typeof violation.to).toBe('string');
					expect(violation.rule).toBeDefined();
					expect(typeof violation.rule.severity).toBe('string');
					expect(typeof violation.rule.name).toBe('string');
				});
			}
		});

		it('should handle workspace path with special characters', async () => {
			// Create directory with special characters (if supported by OS)
			const specialChars = process.platform === 'win32' ? 'special-chars' : 'special chars & symbols!';
			const specialPath = path.join(tempDir, specialChars);
			
			try {
				fs.mkdirSync(specialPath);
				
				fs.writeFileSync(path.join(specialPath, 'test.js'), `
					console.log('Special path test');
					module.exports = { special: true };
				`);
				
				fs.writeFileSync(path.join(specialPath, 'package.json'), JSON.stringify({
					name: 'special-chars-test',
					version: '1.0.0'
				}));

				const result = await generateDependencyGraph(specialPath);
				
				expect(result).toBeDefined();
				// Should handle special characters in paths
				
			} catch (error) {
				// If OS doesn't support special characters, skip this test
				console.log('Skipping special characters test due to OS limitations');
			}
		});

		it('should handle very large number of files', async () => {
			// Create project with many files
			const largePath = path.join(tempDir, 'large-project');
			fs.mkdirSync(largePath);
			
			// Create 20 files (reasonable for test performance)
			for (let i = 0; i < 20; i++) {
				const content = i === 0 
					? `// Root file\nmodule.exports = { root: true };`
					: `const prev = require('./file${i-1}');\nmodule.exports = { file${i}: true, prev };`;
				
				fs.writeFileSync(path.join(largePath, `file${i}.js`), content);
			}
			
			fs.writeFileSync(path.join(largePath, 'package.json'), JSON.stringify({
				name: 'large-test',
				version: '1.0.0'
			}));

			const result = await generateDependencyGraph(largePath);
			
			expect(result).toBeDefined();
			expect(result.modules.length).toBeGreaterThan(0);
			expect(result.summary.totalDependencies).toBeGreaterThanOrEqual(0);
		});
	});

	describe('Return Value Validation', () => {
		it('should always return valid DependencyGraph structure', async () => {
			// Test with valid path
			const validResult = await generateDependencyGraph(sampleProjectPath);
			validateDependencyGraphStructure(validResult);
			
			// Test with invalid path
			const invalidResult = await generateDependencyGraph('/nonexistent/path');
			validateDependencyGraphStructure(invalidResult);
		});

		it('should never throw exceptions', async () => {
			const testCases = [
				sampleProjectPath,
				'/nonexistent/path',
				'',
				null as any,
				undefined as any,
				123 as any,
				{} as any,
				[] as any
			];

			for (const testCase of testCases) {
				try {
					const result = await generateDependencyGraph(testCase);
					expect(result).toBeDefined();
					validateDependencyGraphStructure(result);
				} catch (error) {
					throw new Error(`Should not throw exception for input: ${testCase}. Error: ${error}`);
				}
			}
		});
	});

	// Helper function to validate DependencyGraph structure
	function validateDependencyGraphStructure(graph: DependencyGraph) {
		expect(graph).toBeDefined();
		expect(Array.isArray(graph.modules)).toBe(true);
		expect(graph.summary).toBeDefined();
		expect(typeof graph.summary.totalDependencies).toBe('number');
		expect(Array.isArray(graph.summary.violations)).toBe(true);
		
		// Validate each module
		graph.modules.forEach((module, index) => {
			expect(typeof module.source).toBe('string');
			expect(Array.isArray(module.dependencies)).toBe(true);
			expect(Array.isArray(module.dependents)).toBe(true);
			
			// Validate each dependency
			module.dependencies.forEach((dep, depIndex) => {
				expect(typeof dep.resolved).toBe('string');
				expect(typeof dep.coreModule).toBe('boolean');
				expect(typeof dep.followable).toBe('boolean');
				expect(typeof dep.dynamic).toBe('boolean');
			});
		});
		
		// Validate each violation
		graph.summary.violations.forEach((violation, index) => {
			expect(typeof violation.from).toBe('string');
			expect(typeof violation.to).toBe('string');
			expect(violation.rule).toBeDefined();
			expect(typeof violation.rule.severity).toBe('string');
			expect(typeof violation.rule.name).toBe('string');
		});
	}
});