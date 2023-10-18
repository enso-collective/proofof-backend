module.exports = {
	root: true,
	env: {
		es6: true,
		node: true,
	},
	extends: [
		'plugin:@typescript-eslint/recommended',
		'plugin:import/recommended',
		'plugin:import/typescript',
		'google',
		'prettier',
		'plugin:prettier/recommended',
	],
	parser: '@typescript-eslint/parser',
	parserOptions: {
		sourceType: 'module',
		tsconfigRootDir: __dirname,
	},
	plugins: ['import', 'simple-import-sort', '@typescript-eslint', 'prettier'],
	rules: {
		// TS Compiler
		'no-unused-vars': 'off',
		'require-jsdoc': 'off',
		// TS Plugin
		'@typescript-eslint/ban-ts-comment': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/no-var-requires': 'off',
		'@typescript-eslint/no-unused-vars': 'warn',
		'prettier/prettier': ['error', { singleQuote: true, semi: false }],
		// Import
		'import/first': 'error',
		'import/newline-after-import': 'error',
		'import/no-duplicates': 'error',
		'import/no-named-as-default': 'error',
		'import/no-unresolved': 'warn',
		'simple-import-sort/imports': 'error',
		'simple-import-sort/exports': 'warn',
	},
	overrides: [
		{
			files: ['./src/dtos/**/*.ts'],
			rules: {
				'new-cap': 'off',
			},
		},
	],
}
