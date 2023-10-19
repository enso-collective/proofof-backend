// user.account_ids = ['123', '456', '789']

// account_types: ‘web3' | ‘web2'
// account_provider: 'apple', 'google', 'auth0', 'metamask', 'walletconnect'

// account_value: drew@ensocollective.xyz when account_type = ‘web2'
// account_value: 0x....1234 when account_type = 'web3'

type Doc = {
	uid: string
}

export type EmailAddress = `${string}@${string}.${string}`
export type EthereumAddress = `0x${string}`

export enum AuthProvider {
	// Web2
	Apple = 'apple',
	Auth0 = 'auth0',
	Google = 'google',
	// Web3
	MetaMask = 'metamask',
	WalletConnect = 'walletconnect',
}

export enum UserAccountType {
	Web2 = 'web2',
	Web3 = 'web3',
}

export type User = Doc & {
	username: string
	email: string
	accountIds: string[]
}

export type UserAccount = {
	type: UserAccountType
	provider: AuthProvider
	value: EmailAddress | EthereumAddress
}
