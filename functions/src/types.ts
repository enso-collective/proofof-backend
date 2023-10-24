// Strings
export type EmailAddress = `${string}@${string}.${string}`
export type EthereumAddress = `0x${string}`

// Enums (collections viewed as constants)
export enum COLLECTIONS {
	BOARDS = 'boards',
	POSTS = 'posts',
	POST_LOCATIONS = 'postLocations',
	USERS = 'users',
}

export enum SUBCOLLECTIONS {
	USER_ACCOUNTS = 'accounts',
}

export enum Web2AuthProvider {
	Apple = 'apple',
	Auth0 = 'auth0',
	Google = 'google',
}

export enum Web3AuthProvider {
	MetaMask = 'metamask',
	WalletConnect = 'walletconnect',
}

export enum UserAccountType {
	Web2 = 'web2',
	Web3 = 'web3',
}
