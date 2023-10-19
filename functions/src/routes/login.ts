import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'

import { COLLECTIONS, SUBCOLLECTIONS } from '../constants'
import { CreateUserAccountDto, UpdateUserAccountDto } from '../dtos'
import { AuthProvider, UserAccountType } from '../types'
import { handleServerErrorResponse } from '../utils/handleServerError'

/**
 * Firebase HTTP Function to authenticate with an email address and create a Firebase custom token.
 *
 * @param {functions.https.Request} req - The HTTP request object containing Apple ID and email.
 * @param {functions.Response} res - The HTTP response object to send the Firebase custom token.
 */
export const loginWithEmail = functions.https.onRequest(async (req, res) => {
	try {
		const { authProvider, email } = req.body

		// Validate inputs
		if (
			!email ||
			!authProvider ||
			(authProvider !== AuthProvider.Apple &&
				authProvider !== AuthProvider.Google &&
				authProvider !== AuthProvider.Auth0)
		)
			throw Error('Invalid inputs')

		// TODO: determine if needing special branch for Auth0 (lookup by email works just fine)
		// if (authProvider === AuthProvider.Auth0) {
		// Initialize the Auth0 client
		// const auth0 = new AuthenticationClient({
		// 	domain: 'dev-gjtt35jcnaro1wqn.us.auth0.com',
		// 	clientId: 'N0dyY1AJ7UVluxDlvtN1Nsvc0sW9qHl8',
		// })
		// 	const userInfo = await auth0.users?.getInfo(req.body.auth0Token)
		// 	if (!userInfo) throw new Error('No user info')
		// }

		// 1. Get user by email. There should only be one user per email based on signup constraints
		const userSnapshot = await admin
			.firestore()
			.collection(COLLECTIONS.USERS)
			.where('email', '==', email)
			.get()
		if (userSnapshot.empty) throw Error(`User with email ${email} could not be found`)
		const userRef = userSnapshot.docs[0].ref

		// 2. Get the user account related to the auth provider
		const userAccountSnapshot = await userRef
			.collection(SUBCOLLECTIONS.USER_ACCOUNTS)
			.where('provider', '==', authProvider)
			.get()

		// 3. If exists, update the login time using that account.
		if (!userAccountSnapshot.empty) {
			const userAccountRef = userAccountSnapshot.docs[0].ref
			const updateUserAccountData: UpdateUserAccountDto = {
				lastLogin: new Date(),
			}
			userAccountRef.set(updateUserAccountData, { merge: true })
		}
		// 3b. If doesn't exist (first time login), create a new account record for the user
		else {
			const userAccount: CreateUserAccountDto = {
				type: UserAccountType.Web2,
				provider: authProvider,
				value: email,
				lastLogin: new Date(),
			}
			await userRef.collection(SUBCOLLECTIONS.USER_ACCOUNTS).add(userAccount)
		}

		// 4. Create and return the JWT relating to the user record's UID
		const firebaseToken = await admin.auth().createCustomToken(userRef.id)

		// 5. Return the JWT
		res.json({ firebaseToken })
	} catch (error) {
		handleServerErrorResponse(error, res)
	}
})

// TODO: implement
/**
 * Firebase HTTP Function to authenticate with a Web3 wallet and create a Firebase custom token.
 *
 * @param {functions.https.Request} req - The HTTP request object containing Apple ID and email.
 * @param {functions.Response} res - The HTTP response object to send the Firebase custom token.
 */
export const loginWithWallet = functions.https.onRequest(async (req, res) => {
	try {
		const { authProvider, email, eoaAddress } = req.body

		// Validate inputs
		if (
			!email ||
			!authProvider ||
			!eoaAddress ||
			(authProvider !== AuthProvider.MetaMask && authProvider !== AuthProvider.WalletConnect)
		)
			throw Error('Invalid inputs')

		// 1. Get user by email. There should only be one user per email based on signup constraints
		const userSnapshot = await admin
			.firestore()
			.collection(COLLECTIONS.USERS)
			.where('email', '==', email)
			.get()
		if (userSnapshot.empty) throw Error(`User with email ${email} could not be found`)
		const userRef = userSnapshot.docs[0].ref

		// 2. Get the user account related to the auth provider
		const userAccountSnapshot = await userRef
			.collection(SUBCOLLECTIONS.USER_ACCOUNTS)
			.where('provider', '==', authProvider) // TODO: and eoaAddress is found
			.get()

		// 3. If exists, update the login time using that account.
		if (!userAccountSnapshot.empty) {
			const userAccountRef = userAccountSnapshot.docs[0].ref
			let updateUserAccountData: UpdateUserAccountDto
			// TODO: support multiple wallet addresses from the same provider
			// @ts-ignore
			if (/* eoaAddress !== userAccountRef.values['eoaAddress']*/ 'false' !== 'comparison') {
				updateUserAccountData = {
					value: eoaAddress,
					lastLogin: new Date(),
				}
			} else {
				updateUserAccountData = {
					lastLogin: new Date(),
				}
			}
			userAccountRef.set(updateUserAccountData, { merge: true })
		}
		// 3b. If doesn't exist (first time login), create a new account record for the user
		else {
			const userAccount: CreateUserAccountDto = {
				type: UserAccountType.Web3,
				provider: authProvider,
				value: eoaAddress,
				lastLogin: new Date(),
			}
			await userRef.collection(SUBCOLLECTIONS.USER_ACCOUNTS).add(userAccount)
		}

		// TODO: update the User record's 'eoaAddress' field for the currently logged in address

		// 4. Create and return the JWT relating to the user record's UID
		const firebaseToken = await admin.auth().createCustomToken(userRef.id)

		// 5. Return the JWT
		res.json({ firebaseToken })
	} catch (error) {
		handleServerErrorResponse(error, res)
	}
})
