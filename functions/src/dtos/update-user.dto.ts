import { IsDate, IsEthereumAddress, IsFirebasePushId, IsOptional, IsString } from 'class-validator'

import { EthereumAddress } from '../types'

export class UpdateUserDto {
	@IsFirebasePushId({ each: true })
	@IsOptional()
	accountIds?: string[]

	@IsString()
	@IsOptional()
	avatarUrl?: string

	@IsString()
	@IsOptional()
	bio?: string

	@IsString()
	@IsOptional()
	displayName?: string

	// TODO: allow for updating email in the future

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
