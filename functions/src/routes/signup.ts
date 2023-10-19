import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'

import { COLLECTIONS, SUBCOLLECTIONS } from '../constants'
import { CreateUserAccountDto, CreateUserDto } from '../dtos'
import { AuthProvider, UserAccountType } from '../types'
import { handleServerErrorResponse } from '../utils/handleServerError'

const createUser = async (newUser: CreateUserDto, userAccount: CreateUserAccountDto) => {
	// 1. Create and save the new user record
	const userRef = await admin.firestore().collection(COLLECTIONS.USERS).doc()
	await userRef.set(newUser)

	// 2. Create and save the user account to its 'accounts' subcollection
	await userRef.collection(SUBCOLLECTIONS.USER_ACCOUNTS).add(userAccount)

	// 3. Create and return the JWT relating to the new user record's UID
	return admin.auth().createCustomToken(userRef.id)
}

// TODO: verify that username and email are both unique
// TODO: use class-validator and class-transformer
const validateEmailInputs = async (email: string, username: string, authProvider: AuthProvider) => {
	if (
		!email ||
		!username ||
		!authProvider ||
		(authProvider !== AuthProvider.Apple &&
			authProvider !== AuthProvider.Auth0 &&
			authProvider !== AuthProvider.Google)
	)
		throw Error('Invalid inputs')
}

const validateWalletInputs = async (
	email: string,
	eoaAddress: string,
	username: string,
	authProvider: AuthProvider,
) => {
	if (
		!email ||
		!eoaAddress ||
		!username ||
		!authProvider ||
		(authProvider !== AuthProvider.MetaMask && authProvider !== AuthProvider.WalletConnect)
	)
		throw Error('Invalid inputs')
}

/**
 * Creates a new user account with the given email, username, and email provider.
 *
 * @remarks
 * This function validates the input data, constructs the necessary data for creating a new user account,
 * saves the new user record to Firestore, and returns a Firebase token for the new user.
 *
 * @param req - The HTTP request object containing the user's input data.
 * @param res - The HTTP response object to send the Firebase token to.
 *
 * @throws An error is thrown if the input data is invalid or if there is an error creating the new user record.
 */
export const signupWithEmail = functions.https.onRequest(async (req, res) => {
	try {
		const { authProvider, email, username } = req.body

		// 1. Validate inputs
		await validateEmailInputs(email, username, authProvider)

		// 2 Construct minimally required data to create a new user and its account
		const userData: CreateUserDto = {
			createdAt: new Date(),
			email,
			eoaAddress: null, // explicitly set to null vs undefined
			username,
		}
		const userAccountData: CreateUserAccountDto = {
			type: UserAccountType.Web2,
			provider: authProvider,
			value: email,
		}

		// 3. Save the new record to storage
		const firebaseToken = await createUser(userData, userAccountData)

		// 4. Return the JWT
		res.json({ firebaseToken })
	} catch (error) {
		handleServerErrorResponse(error, res)
	}
})

/**
 * Creates a new user account with the given email, Ethereum address, username, and wallet provider.
 *
 * @remarks
 * This function validates the input data, constructs the necessary data for creating a new user account,
 * saves the new user record to Firestore, and returns a Firebase token for the new user.
 *
 * @param req - The HTTP request object containing the user's input data.
 * @param res - The HTTP response object to send the Firebase token to.
 *
 * @throws An error is thrown if the input data is invalid or if there is an error creating the new user record.
 */
export const signupWithWallet = functions.https.onRequest(async (req, res) => {
	try {
		const { authProvider, email, eoaAddress, username } = req.body

		// 1. Validate inputs
		await validateWalletInputs(email, eoaAddress, username, authProvider)

		// 2. Construct minimally required data to create a new user and its account
		const userData: CreateUserDto = {
			createdAt: new Date(),
			email,
			eoaAddress,
			username,
		}
		const userAccountData: CreateUserAccountDto = {
			type: UserAccountType.Web3,
			provider: authProvider,
			value: eoaAddress,
		}

		// 3. Save the new record to storage
		const firebaseToken = await createUser(userData, userAccountData)

		// 4. Return the JWT
		res.json({ firebaseToken })
	} catch (error) {
		handleServerErrorResponse(error, res)
	}
})
