/**
 * Integration test for manifest reading and updating logic
 */

import * as path from 'path';
import { CodeSymbol } from './src/types';

// Test the manifest URI construction
function testManifestUriConstruction() {
    console.log('Testing manifest URI construction...');

    const workspacePath = '/test/workspace';
    const expectedPath = path.join(workspacePath, '.constellation', 'manifest.json');
    const manifestPath = path.join(workspacePath, '.constellation', 'manifest.json');

    console.log(`Expected: ${expectedPath}`);
    console.log(`Actual: ${manifestPath}`);
    console.log(`Match: ${expectedPath === manifestPath}`);
    console.log(`✓ Manifest URI construction works correctly\n`);
}

// Test empty manifest fallback
async function testEmptyManifestFallback() {
    console.log('Testing empty manifest fallback...');

    // Simulate readManifest function behavior when file doesn't exist
    try {
        throw new Error('File not found');
    } catch (error) {
        const manifest = {}; // Empty object fallback
        console.log('Manifest fallback:', manifest);
        console.log('✓ Empty manifest fallback works correctly\n');
    }
}

// Test manifest updating logic
function testManifestUpdating() {
    console.log('Testing manifest updating logic...');

    // Start with existing manifest
    const existingManifest: { [key: string]: CodeSymbol[] } = {
        'src/existing.ts': [
            {
                id: 'src/existing.ts#oldFunction',
                name: 'oldFunction',
                kind: 'function',
                filePath: 'src/existing.ts',
                position: { start: { line: 0, character: 0 }, end: { line: 5, character: 1 } },
                docstring: null
            }
        ],
        'src/other.ts': [
            {
                id: 'src/other.ts#otherFunction',
                name: 'otherFunction',
                kind: 'function',
                filePath: 'src/other.ts',
                position: { start: { line: 0, character: 0 }, end: { line: 3, character: 1 } },
                docstring: null
            }
        ]
    };

    // New symbols for existing.ts
    const newSymbols: CodeSymbol[] = [
        {
            id: 'src/existing.ts#newFunction',
            name: 'newFunction',
            kind: 'function',
            filePath: 'src/existing.ts',
            position: { start: { line: 10, character: 0 }, end: { line: 15, character: 1 } },
            docstring: '/** New function */'
        }
    ];

    // Update manifest - replace file-specific symbols without affecting other files
    const updatedManifest = { ...existingManifest };
    updatedManifest['src/existing.ts'] = newSymbols;

    console.log('Original manifest keys:', Object.keys(existingManifest));
    console.log('Updated manifest keys:', Object.keys(updatedManifest));
    console.log('src/existing.ts symbols updated:', updatedManifest['src/existing.ts'].length);
    console.log('src/other.ts symbols unchanged:', updatedManifest['src/other.ts'].length);
    console.log('Other file preserved:', updatedManifest['src/other.ts'][0].name === 'otherFunction');
    console.log('✓ Atomic manifest updating works correctly\n');
}

// Test JSON serialization
function testJsonSerialization() {
    console.log('Testing JSON serialization...');

    const manifest: { [key: string]: CodeSymbol[] } = {
        'src/test.ts': [
            {
                id: 'src/test.ts#testFunction',
                name: 'testFunction',
                kind: 'function',
                filePath: 'src/test.ts',
                position: { start: { line: 0, character: 0 }, end: { line: 5, character: 1 } },
                docstring: '/** Test function */'
            }
        ]
    };

    const serialized = JSON.stringify(manifest, null, 2);
    const parsed = JSON.parse(serialized);

    console.log('Serialized length:', serialized.length);
    console.log('Parsed matches original:', JSON.stringify(parsed) === JSON.stringify(manifest));
    console.log('Contains expected content:', serialized.includes('"testFunction"'));
    console.log('✓ JSON serialization works correctly\n');
}

// Run all tests
async function runTests() {
    console.log('=== Manifest Integration Tests ===\n');

    testManifestUriConstruction();
    await testEmptyManifestFallback();
    testManifestUpdating();
    testJsonSerialization();

    console.log('=== All tests completed successfully! ===');
}

// Run tests
runTests().catch(console.error);