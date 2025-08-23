const esbuild = require("esbuild");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const extensionOnly = process.argv.includes('--extension-only');
const webviewOnly = process.argv.includes('--webview-only');
const mcpOnly = process.argv.includes('--mcp-only');
const workersOnly = process.argv.includes('--workers-only');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

async function main() {
	const contexts = [];

	// Extension build configuration
	if (!webviewOnly && !mcpOnly && !workersOnly) {
		const extensionCtx = await esbuild.context({
			entryPoints: [
				'src/extension.ts'
			],
			bundle: true,
			format: 'cjs',
			minify: production,
			sourcemap: !production,
			sourcesContent: false,
			platform: 'node',
			outfile: 'dist/extension.js',
			external: ['vscode'],
			logLevel: 'silent',
			plugins: [
				/* add to the end of plugins array */
				esbuildProblemMatcherPlugin,
			],
		});
		contexts.push(extensionCtx);
	}

	// Webview build configuration
	if (!extensionOnly && !mcpOnly && !workersOnly) {
		const webviewCtx = await esbuild.context({
			entryPoints: [
				'src/webview/index.tsx'
			],
			bundle: true,
			format: 'iife',
			minify: production,
			sourcemap: !production,
			sourcesContent: false,
			platform: 'browser',
			outfile: 'dist/webview.js',
			jsx: 'automatic',
			jsxImportSource: 'preact',
			logLevel: 'silent',
			plugins: [
				esbuildProblemMatcherPlugin,
			],
		});
		contexts.push(webviewCtx);

		// Sidebar build configuration
		const sidebarCtx = await esbuild.context({
			entryPoints: [
				'src/sidebar/index.tsx'
			],
			bundle: true,
			format: 'iife',
			minify: production,
			sourcemap: !production,
			sourcesContent: false,
			platform: 'browser',
			outfile: 'dist/sidebar.js',
			jsx: 'automatic',
			jsxImportSource: 'preact',
			logLevel: 'silent',
			plugins: [
				esbuildProblemMatcherPlugin,
			],
		});
		contexts.push(sidebarCtx);
	}

	// MCP Server build configuration
	if (!extensionOnly && !webviewOnly && !workersOnly) {
		const mcpServerCtx = await esbuild.context({
			entryPoints: [
				'src/mcp/mcp-stdio.server.ts'
			],
			bundle: true,
			format: 'cjs',
			minify: production,
			sourcemap: !production,
			sourcesContent: false,
			platform: 'node',
			outfile: 'out/mcp-server.js',
			external: ['vscode'],
			logLevel: 'silent',
			plugins: [
				esbuildProblemMatcherPlugin,
			],
		});
		contexts.push(mcpServerCtx);
	}

	// Worker threads build configuration
	if (!extensionOnly && !webviewOnly && !mcpOnly) {
		const workersCtx = await esbuild.context({
			entryPoints: [
				'src/workers/scan-project.worker.ts'
			],
			bundle: true,
			format: 'esm',
			minify: production,
			sourcemap: !production,
			sourcesContent: false,
			platform: 'node',
			outfile: 'dist/workers/scanWorker.mjs',
			external: ['dependency-cruiser'],
			logLevel: 'silent',
			plugins: [
				esbuildProblemMatcherPlugin,
			],
		});
		contexts.push(workersCtx);
	}

	if (watch) {
		// Trigger initial builds so background problem matchers receive a begin/end cycle
		await Promise.all(contexts.map(ctx => ctx.rebuild()));
		await Promise.all(contexts.map(ctx => ctx.watch()));
	} else {
		await Promise.all(contexts.map(ctx => ctx.rebuild()));
		await Promise.all(contexts.map(ctx => ctx.dispose()));
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
