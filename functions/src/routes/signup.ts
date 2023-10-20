import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'
import _omit from 'lodash/omit'

import { COLLECTIONS, SUBCOLLECTIONS } from '../constants'
import {
	CreateUserAccountWeb2Dto,
	CreateUserAccountWeb3Dto,
	CreateUserWithEmailDto,
	CreateUserWithWalletDto,
} from '../dtos'
import { UserAccountType } from '../types'
import { validateAndConvert } from '../utils/validateInputs'

/**
 * Creates a new user and saves their record to the Firestore database. It only creates a new record if the email is not in use already.
 * @param {CreateUserWithEmailDto | CreateUserWithWalletDto} newUser - The data for the new user.
 * @param {CreateUserAccountDto} userAccount - The data for the user's account.
 * @param {functions.Request} res - The HTTP response object.
 * @return {Promise<string | functions.Response<any>>} A Promise that resolves with a JWT relating to the new user record's UID or a 400 response if the email is already in use.
 */
const createUser = async (
	newUser: CreateUserWithEmailDto | CreateUserWithWalletDto,
	userAccount: CreateUserAccountWeb2Dto | CreateUserAccountWeb3Dto,
	res: functions.Response,
) => {
	// 1. Verify that the email is not in use by another user
	const userSnapshot = await admin
		.firestore()
		.collection(COLLECTIONS.USERS)
		.where('email', '==', newUser.email)
		.get()
	if (!userSnapshot.empty)
		return res.status(400).json({ error: `The email '${newUser.email}' is already in use` })

	// NOTE/TODO: In order to prevent anyone from injecting bad data, ensure that the eoaAddress isn't also in use by another user as well. Even though many users could possibly share one address (permissable), users could also falsely inject this maliciously, which could have adverse side effects. This is simply a note and not a TODO since it's not unheard of multiple people sharing the same EOA address via key-sharing.

	// 2. Create and save the new user record
	const userRef = await admin.firestore().collection(COLLECTIONS.USERS).doc()
	await userRef.set({
		...newUser,
		createdAt: new Date(),
	})

	// 3. Create and save the user account to its 'accounts' subcollection
	await userRef.collection(SUBCOLLECTIONS.USER_ACCOUNTS).add({
		...userAccount,
		lastLogin: new Date(),
	})

	// 4. Create and return the JWT relating to the new user record's UID
	return admin.auth().createCustomToken(userRef.id)
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
		// 1. Validate inputs
		const supportedParams = {
			// Required
			provider: req.body.provider,
			email: req.body.email,
			firstName: req.body.firstName,
			lastName: req.body.lastName,
			username: req.body.username,
			// Optional
			avatarUrl: req.body.avatarUrl,
			bio: req.body.bio,
			interests: req.body.interests,
		}
		const validateUserResult = await validateAndConvert(
			CreateUserWithEmailDto,
			_omit(supportedParams, ['provider']),
		)
		const validateUserAccountResult = await validateAndConvert(CreateUserAccountWeb2Dto, {
			type: UserAccountType.Web2,
			provider: supportedParams.provider,
			value: supportedParams.email,
		})

		// 2. Catch validation errors if any
		if (validateUserResult.error) {
			res.status(400).json({ error: validateUserResult.error })
		} else if (validateUserAccountResult.error) {
			res.status(400).json({ error: validateUserAccountResult.error })
		} else {
			// 3. Save the new record to storage
			const firebaseToken = await createUser(
				validateUserResult.data,
				validateUserAccountResult.data,
				res,
			)
			// 4. Return the JWT
			res.status(201).json({ data: firebaseToken })
		}
	} catch (e: any) {
		res.status(500).json({ error: 'Server error' })
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
		// 1. Validate inputs
		const supportedParams = {
			// Required
			provider: req.body.provider,
			email: req.body.email,
			eoaAddress: req.body.eoaAddress,
			firstName: req.body.firstName,
			lastName: req.body.lastName,
			username: req.body.username,
			// Optional
			avatarUrl: req.body.avatarUrl,
			bio: req.body.bio,
			interests: req.body.interests,
		}
		const validateUserResult = await validateAndConvert(
			CreateUserWithWalletDto,
			_omit(supportedParams, ['provider']),
		)
		const validateUserAccountResult = await validateAndConvert(CreateUserAccountWeb3Dto, {
			type: UserAccountType.Web3,
			provider: supportedParams.provider,
			value: supportedParams.eoaAddress,
		})

		// 2. Catch validation errors if any
		if (validateUserResult.error) {
			res.status(400).json({ error: validateUserResult.error })
		} else if (validateUserAccountResult.error) {
			res.status(400).json({ error: validateUserAccountResult.error })
		} else {
			// 3. Save the new record to storage
			const firebaseToken = await createUser(
				validateUserResult.data,
				validateUserAccountResult.data,
				res,
			)
			// 4. Return the JWT
			res.status(201).json({ data: firebaseToken })
		}
	} catch (e: any) {
		res.status(500).json({ error: 'Server error' })
	}
})
