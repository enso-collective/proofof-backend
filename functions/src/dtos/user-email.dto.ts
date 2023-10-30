import { Expose } from 'class-transformer'
import { IsDefined, IsEmail } from 'class-validator'

export class UserEmailDto {
	@IsEmail()
	@IsDefined()
	@Expose()
	email: string
}
