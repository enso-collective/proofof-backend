import { Expose } from 'class-transformer'
import { IsDefined, IsString, Matches } from 'class-validator'

type DiscoRecipientDID = `did:3:${string & { length: 64 }}`

export class DiscoRecipientDto {
	// @Matches(/^did:3:[a-z0-9]{64}$/)
	@IsString()
	@IsDefined()
	@Expose()
	did: DiscoRecipientDID
}

// did:3:kjzl6cwe1jw147ozoxkk1gce1gjrmil9fnao20ddkj116qkalpap2sqb2d9fl7v
// did:3:kjzl6cwe1jw14bfjsuk8jdx86bo897rxq5qnyoi6945omh89mzm7ixojfvxw4qq
