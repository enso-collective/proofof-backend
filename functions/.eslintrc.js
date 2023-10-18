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
	plugins: ['prettier', 'import', 'simple-import-sort', '@typescript-eslint'],
	rules: {
		'@typescript-eslint/ban-ts-comment': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/no-var-requires': 'off',
		'prettier/prettier': 'off',
		'import/first': 'error',
		'import/newline-after-import': 'error',
		'import/no-duplicates': 'error',
		'import/no-named-as-default': 'error',
		'import/no-unresolved': 'warn',
		'simple-import-sort/imports': 'error',
		'simple-import-sort/exports': 'warn',
	},
}
