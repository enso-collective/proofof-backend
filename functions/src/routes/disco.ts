import * as functions from 'firebase-functions'

import { DiscoRecipientDto } from '../dtos'
import { validateAndConvert } from '../utils/validateInputs'

export const issueDiscoCredential = functions.https.onRequest(async (req, res) => {
	try {
		// 1. Validate required inputs
		const supportedParams = {
			recipientDID: req.body.recipientDID,
		}
		const validateDIDResult = await validateAndConvert(DiscoRecipientDto, {
			did: supportedParams.recipientDID,
		})

		// 2. Catch validation errors if any
		if (validateDIDResult.error) {
			res.status(400).json({ error: validateDIDResult.error })
		} else {
			// 3. Construct Disco API request to issue a credential for the recipeint via the Enso Disco Organization
			// Disco headers
			const headers = new Headers()
			headers.append('Content-Type', 'application/json')
			headers.append('Authorization', `Bearer ${process.env.DISCO_DIDWEB3_API_KEY}`)
			// Disco POST body
			const credential = {
				issuer: `did:web:api.disco.xyz/v1/${process.env.DISCO_ORG_ALIAS}`,
				schema:
					'https://raw.githubusercontent.com/discoxyz/disco-schemas/main/json/GMCredential/1-0-0.json',
				suite: 'jwt',
				subjects: [
					{
						subject: { id: supportedParams.recipientDID },
						recipient: supportedParams.recipientDID,
						expirationDate: '',
					},
				],
			}

			console.log(credential.subjects[0], process.env.DISCO_DIDWEB3_API_KEY)

			const response = await fetch('http://api.disco.xyz/v1/credentials/', {
				method: 'POST',
				headers,
				body: JSON.stringify(credential),
				redirect: 'follow',
			})
			const result = await response.text()
			console.log({ discoResult: result })

			// Return the Disco result as the response data
			res.status(201).json({ data: result })
		}
	} catch (error: any) {
		res.status(500).json({ error: error.message })
	}
})
