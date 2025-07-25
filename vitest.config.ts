export default {
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['out/**/*', 'node_modules/**/*'],
    silent: false,
    reporter: 'verbose',
  },
};