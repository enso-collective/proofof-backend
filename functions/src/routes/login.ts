import { AuthenticationClient } from 'auth0'
import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'

import {
	CreateUserAccountWeb2Dto,
	CreateUserAccountWeb3Dto,
	UpdateUserAccountDto,
	UpdateUserDto,
	UserEmailDto,
} from '../dtos'
import { COLLECTIONS, SUBCOLLECTIONS, UserAccountType } from '../types'
import { validateAndConvert } from '../utils/validateInputs'

// TODO: DRY up some of the duplicate code

// Initialize the Auth0 client
const auth0 = new AuthenticationClient({
	domain: process.env.AUTH0_DOMAIN,
	clientId: process.env.AUTH0_CLIENT_ID,
})

/**
 * Firebase HTTP Function to authenticate with an email address and create a Firebase custom token.
 */
export const loginWithEmail = functions.https.onRequest(async (req, res) => {
	try {
		// 1. Validate required inputs
		const supportedParams = {
			authProvider: req.body.authProvider,
			email: req.body.email,
			auth0Token: req.body.auth0Token,
		}
		const validateEmailResult = await validateAndConvert(UserEmailDto, {
			email: supportedParams.email,
		})
		const validateUserAccountResult = await validateAndConvert(CreateUserAccountWeb2Dto, {
			type: UserAccountType.Web2,
			authProvider: supportedParams.authProvider,
			value: supportedParams.email,
		})

		// 2. Catch validation errors if any
		if (validateEmailResult.error) {
			res.status(400).json({ error: validateEmailResult.error })
		} else if (validateUserAccountResult.error) {
			res.status(400).json({ error: validateUserAccountResult.error })
		} else {
			// 3. Get user by provided Auth0 token and check that emails match
			const userInfo = await auth0.users.getInfo(supportedParams.auth0Token)
			if (!userInfo) throw new Error('User with provided Auth0 token could not be found')
			if (userInfo.email !== supportedParams.email)
				throw new Error(
					`The provided Auth0 token must match with the email ${supportedParams.email}`,
				)

			// 4. Get user record by email. There should only be one user per email based on signup constraints
			const userSnapshot = await admin
				.firestore()
				.collection(COLLECTIONS.USERS)
				.where('email', '==', supportedParams.email)
				.get()
			if (userSnapshot.empty)
				throw new Error(`User with email ${supportedParams.email} could not be found`)

			// 4. Get the user account related to the auth provider
			const userRef = userSnapshot.docs[0].ref
			const userAccountSnapshot = await userRef
				.collection(SUBCOLLECTIONS.USER_ACCOUNTS)
				.where('authProvider', '==', supportedParams.authProvider)
				.get()

			// 5a. If doesn't exist (first time login with provider), create a new account record for the user. The same email can log in with multiple providers, so it's possible to have an email but log in with a new provider.
			if (userAccountSnapshot.empty) {
				const userAccount: CreateUserAccountWeb2Dto = {
					type: UserAccountType.Web2,
					authProvider: supportedParams.authProvider,
					value: supportedParams.email,
					lastLogin: new Date(),
				}
				await userRef.collection(SUBCOLLECTIONS.USER_ACCOUNTS).add(userAccount)
			}
			// 5b. Otherwise, update the login time for that provider account.
			else {
				const userAccountRef = userAccountSnapshot.docs[0].ref
				const updateUserAccountData: UpdateUserAccountDto = {
					lastLogin: new Date(),
				}
				userAccountRef.set(updateUserAccountData, { merge: true })
			}

			// 6. Create and return the JWT relating to the user record's UID
			const firebaseToken = await admin.auth().createCustomToken(userRef.id)
			res.json({ firebaseToken })
		}
	} catch (error: any) {
		res.status(500).json({ error: error.message })
	}
})

/**
 * Firebase HTTP Function to authenticate with a Web3 wallet and create a Firebase custom token.
 */
export const loginWithWallet = functions.https.onRequest(async (req, res) => {
	try {
		// 1. Validate required inputs
		const supportedParams = {
			authProvider: req.body.authProvider,
			email: req.body.email,
			eoaAddress: req.body.eoaAddress,
		}
		const validateEmailResult = await validateAndConvert(UserEmailDto, {
			email: supportedParams.email,
		})
		const validateUserAccountResult = await validateAndConvert(CreateUserAccountWeb3Dto, {
			type: UserAccountType.Web3,
			authProvider: supportedParams.authProvider,
			value: supportedParams.eoaAddress,
		})

		// 2. Catch validation errors if any
		if (validateEmailResult.error) {
			res.status(400).json({ error: validateEmailResult.error })
		} else if (validateUserAccountResult.error) {
			res.status(400).json({ error: validateUserAccountResult.error })
		} else {
			// 3. Get user by email. There should only be one user per email based on signup constraints
			const userSnapshot = await admin
				.firestore()
				.collection(COLLECTIONS.USERS)
				.where('email', '==', supportedParams.email)
				.get()
			if (userSnapshot.empty)
				throw new Error(`User with email ${supportedParams.email} could not be found`)

			// 4. Get the user account related to the auth provider
			const userRef = userSnapshot.docs[0].ref
			const userAccountSnapshot = await userRef
				.collection(SUBCOLLECTIONS.USER_ACCOUNTS)
				.where('authProvider', '==', supportedParams.authProvider)
				.get()

			// 4a. If doesn't exist (first time login with provider), create a new account record for the user. The same email can log in with multiple providers, so it's possible to have an email but log in with a new provider.
			if (userAccountSnapshot.empty) {
				const userAccount: CreateUserAccountWeb3Dto = {
					type: UserAccountType.Web3,
					authProvider: supportedParams.authProvider,
					value: supportedParams.eoaAddress,
					lastLogin: new Date(),
				}
				await userRef.collection(SUBCOLLECTIONS.USER_ACCOUNTS).add(userAccount)
			}
			// 4b. Otherwise, update the login time for that provider account.
			else {
				const userAccountRef = userAccountSnapshot.docs[0].ref
				let updateUserAccountData: UpdateUserAccountDto
				// Check if it's a different account for the given provider (ie user changes their active account in their wallet)
				if (supportedParams.eoaAddress !== userAccountSnapshot.docs[0].data().eoaAddress) {
					// TODO: Support multiple wallet addresses from the same provider by creating new records. For now, update the existing provider account with the address being used to log in with
					updateUserAccountData = {
						value: supportedParams.eoaAddress,
						lastLogin: new Date(),
					}
				} else {
					updateUserAccountData = {
						lastLogin: new Date(),
					}
				}
				userAccountRef.set(updateUserAccountData, { merge: true })
			}

			// 5. Update the User record's 'eoaAddress' field to represent the currently logged in one
			const updateUserData: UpdateUserDto = {
				eoaAddress: supportedParams.eoaAddress,
				lastModified: new Date(),
			}
			userRef.set(updateUserData, { merge: true })

			// 6. Create and return the JWT relating to the user record's UID
			const firebaseToken = await admin.auth().createCustomToken(userRef.id)
			res.json({ firebaseToken })
		}
	} catch (error: any) {
		res.status(500).json({ error: error.message })
	}
})
