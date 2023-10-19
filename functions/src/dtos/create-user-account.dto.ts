import { IsDate, IsString } from 'class-validator'

import { AuthProvider, EmailAddress, EthereumAddress, UserAccountType } from '../types'

/*
	account_types: ‘web3' | ‘web2'
	account_provider: 'apple', 'google', 'auth0', 'metamask', 'walletconnect'
	account_value: drew@ensocollective.xyz when account_type = ‘web2'
	account_value: 0x....1234 when account_type = 'web3'
*/
export class CreateUserAccountDto {
	@IsString()
	type: UserAccountType

	@IsString()
	provider: AuthProvider

	@IsString()
	value: EmailAddress | EthereumAddress

	@IsDate()
	lastLogin: Date
}
