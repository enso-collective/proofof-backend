import { Expose } from 'class-transformer'
import {
	Equals,
	IsDate,
	IsDefined,
	IsEmail,
	IsEnum,
	IsEthereumAddress,
	IsString,
} from 'class-validator'

import {
	EmailAddress,
	EthereumAddress,
	UserAccountType,
	Web2AuthProvider,
	Web3AuthProvider,
} from '../types'

export class CreateUserAccountWeb2Dto {
	@Equals(UserAccountType.Web2)
	@IsDefined()
	@Expose()
	type: UserAccountType.Web2

	@IsEnum(Web2AuthProvider)
	@IsDefined()
	@Expose()
	authProvider: Web2AuthProvider

	@IsEmail()
	@IsDefined()
	@Expose()
	value: EmailAddress

	@IsDate()
	lastLogin: Date
}

export class CreateUserAccountWeb3Dto {
	@IsString()
	@IsDefined()
	@Equals(UserAccountType.Web3)
	@Expose()
	type: UserAccountType.Web3

	@IsString()
	@IsEnum(Web3AuthProvider)
	@IsDefined()
	@Expose()
	authProvider: Web3AuthProvider

	@IsEthereumAddress()
	@IsDefined()
	@Expose()
	value: EthereumAddress

	@IsDate()
	lastLogin: Date
}
