import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('kiro-constellation'));
	});

	test('Extension commands should be registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('kiro-constellation.helloWorld'), 
				 'Hello World command should be registered');
		assert.ok(commands.includes('kiro-constellation.showMap'), 
				 'Show Map command should be registered');
	});

	test('Commands should be executable', async () => {
		// Test that commands can be executed without throwing errors
		assert.doesNotReject(async () => {
			await vscode.commands.executeCommand('kiro-constellation.helloWorld');
		}, 'Hello World command should be executable');

		assert.doesNotReject(async () => {
			await vscode.commands.executeCommand('kiro-constellation.showMap');
		}, 'Show Map command should be executable');
	});
});
