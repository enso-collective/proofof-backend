import { Expose } from 'class-transformer'
import { IsDefined, IsString, Matches } from 'class-validator'

type DiscoRecipientDID = `did:3:${string & { length: 64 }}`

export class DiscoRecipientDto {
	@Matches(/^did:(3|ethr|web|pkh|ion|key):([A-Za-z0-9.\-:_\/]+)$/i)
	@IsString()
	@IsDefined()
	@Expose()
	did: DiscoRecipientDID
}
