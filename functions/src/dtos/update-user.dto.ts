import { IsDate, IsEthereumAddress, IsOptional, IsString } from 'class-validator'

import { EthereumAddress } from '../types'

export class UpdateUserDto {
	@IsString()
	@IsOptional()
	avatarUrl?: string

	@IsString()
	@IsOptional()
	bio?: string

	@IsString()
	@IsOptional()
	displayName?: string

	// @IsString()
	// @IsOptional()
	// firstName?: string

	// @IsString()
	// @IsOptional()
	// lastName?: string

	// TODO: allow for updating email in the future
	// @IsEmail()
	// @IsOptional()
	// email?: string;

	// For updating their current logged in account
	@IsEthereumAddress()
	@IsOptional()
	eoaAddress?: EthereumAddress

	@IsString({ each: true })
	@IsOptional()
	interests?: string[]

	@IsDate()
	modifiedAt: Date

	@IsString()
	@IsOptional()
	username?: string
}
