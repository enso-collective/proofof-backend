import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'

import { DiscoRecipientDto, UserEmailDto } from '../dtos'
import { COLLECTIONS, SUBCOLLECTIONS } from '../types'
import { validateAndConvert } from '../utils/validateInputs'

export const issueDiscoCredential = functions.https.onRequest(async (req, res) => {
	try {
		// 1. Validate required inputs
		const supportedParams = {
			email: req.body.email,
			recipientDID: req.body.recipientDID,
		}
		const validateDIDResult = await validateAndConvert(DiscoRecipientDto, {
			did: supportedParams.recipientDID,
		})
		const validateEmailResult = await validateAndConvert(UserEmailDto, {
			email: supportedParams.email,
		})

		// Look up the user by email
		const userSnapshot = await admin
			.firestore()
			.collection(COLLECTIONS.USERS)
			.where('email', '==', supportedParams.email)
			.get()
		if (userSnapshot.empty)
			throw new Error(`User with email '${supportedParams.email}' could not be found`)
		const userRef = userSnapshot.docs[0].ref

		// 2. Catch validation errors if any
		if (validateDIDResult.error) {
			res.status(400).json({ error: validateDIDResult.error })
		} else if (validateEmailResult.error) {
			res.status(400).json({ error: validateEmailResult.error })
		} else {
			// 3. Make a request to Disco API to issue a credential to the recipeint from the Enso Disco Org
			// Construct headers
			const headers = new Headers()
			headers.append('Content-Type', 'application/json')
			headers.append('Accept', '*/*')
			headers.append('Authorization', `Bearer ${process.env.DISCO_ORG_API_KEY}`)
			// Construct body
			// Credential Schema URLs - available schemas can be found at https://github.com/discoxyz/disco-schemas
			const attendanceSchema =
				'https://raw.githubusercontent.com/discoxyz/disco-schemas/main/json/AttendanceCredential/1-0-0.json'
			// Must adhere to schema requirements
			const subjectData = {
				eventDate: 'November 13-19, 2023',
				eventDescription: 'You met up with us at DevConnect in Istanbul, Turkey!',
				eventName: 'Enso Collective - DevConnect 2023',
			}
			const credential = {
				issuer: process.env.DISCO_ORG_DIDWEB,
				schemaUrl: attendanceSchema,
				recipientDID: supportedParams.recipientDID,
				subjectData,
				expirationDate: '', // No expiration
				skipSign: false, // Signing is considered best practice
			}
			// Make Request
			const response = await fetch('https://api.disco.xyz/v1/credential/', {
				method: 'POST',
				headers,
				body: JSON.stringify(credential),
				redirect: 'follow',
			})
			// Get Result
			const result = JSON.parse(await response.text())

			// 4.Store the entire result in the user's discoCredentials subcollection (could slim down what is important to persist in future iterations)
			await userRef.collection(SUBCOLLECTIONS.DISCO_CREDENTIALS).add(result)

			// 5. Return the VC's ID back to the client
			res.status(201).json({ data: result.vc.id })
		}
	} catch (error: any) {
		console.error(error)
		res.status(500).json({ error: error.message })
	}
})
