import { IsDate, IsEmail, IsEthereumAddress, IsOptional, IsString } from 'class-validator'

import { EthereumAddress } from '../types'

export class CreateUserDto {
	@IsString()
	@IsOptional()
	avatarUrl?: string

	@IsString()
	@IsOptional()
	bio?: string

	@IsDate()
	createdAt: Date

	@IsString()
	@IsOptional()
	displayName?: string

	@IsEmail()
	email: string

	@IsEthereumAddress()
	@IsOptional()
	eoaAddress?: EthereumAddress

	@IsString({ each: true })
	@IsOptional()
	interests?: string[]

	@IsString()
	username: string
}
