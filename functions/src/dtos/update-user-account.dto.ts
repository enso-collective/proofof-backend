import { IsDate, IsOptional, IsString } from 'class-validator'

import { EmailAddress, EthereumAddress } from '../types'

export class UpdateUserAccountDto {
	@IsString()
	@IsOptional()
	value?: EmailAddress | EthereumAddress

	@IsDate()
	lastLogin: Date
}
