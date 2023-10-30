import { Expose } from 'class-transformer'
import {
	IsDate,
	IsDefined,
	IsEmail,
	IsEthereumAddress,
	IsOptional,
	IsString,
} from 'class-validator'

import { EthereumAddress } from '../types'

export class CreateUserWithEmailDto {
	@IsDate()
	createdAt: Date

	@IsEmail()
	@IsDefined()
	@Expose()
	email: string

	@IsString()
	@IsDefined()
	@Expose()
	firstName: string

	@IsString()
	@IsDefined()
	@Expose()
	lastName: string

	@IsString()
	@IsDefined()
	@Expose()
	username: string

	@IsString()
	@IsOptional()
	@Expose()
	avatarUrl?: string

	@IsString()
	@IsOptional()
	@Expose()
	bio?: string

	@IsString({ each: true })
	@IsOptional()
	@Expose()
	interests?: string[]
}

export class CreateUserWithWalletDto extends CreateUserWithEmailDto {
	@IsEthereumAddress()
	@IsDefined()
	@Expose()
	eoaAddress: EthereumAddress
}
