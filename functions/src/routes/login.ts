import { AuthenticationClient } from 'auth0'
import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'

import { ACCOUNT_TYPE_APPLE, ACCOUNT_TYPE_AUTH0 } from '../constants'
import { handleServerError, handleServerErrorResponse } from '../utils/handleServerError'

// Initialize the Auth0 client
const auth0 = new AuthenticationClient({
	domain: 'dev-gjtt35jcnaro1wqn.us.auth0.com',
	clientId: 'N0dyY1AJ7UVluxDlvtN1Nsvc0sW9qHl8',
})

/**
 * Interface representing a JSON Web Token (JWT) payload.
 * @interface
 */
interface Jwt {
	sub: string
	email: string
	user_id: string
}

/**
 * Find a user by their account in Firestore.
 *
 * @param {admin.firestore.CollectionReference} usersCollection - Firestore collection reference for users.
 * @param {string} accountType - The type of account (e.g., 'auth0', 'apple', or label for wallet login).
 * @param {string} identifier - The identifier for the account (e.g., user_id, email, or label).
 * @return {Promise<admin.firestore.QuerySnapshot>} A promise that resolves to the Firestore query snapshot.
 */
async function findUserByAccount(
	usersCollection: admin.firestore.CollectionReference,
	accountType: string,
	identifier: string,
): Promise<admin.firestore.QuerySnapshot> {
	return await usersCollection
		.where(`accounts.${accountType}.${identifier}`, '==', true) // Adjust this condition based on your Firestore structure
		.get()
}

/**
 * Firebase Function to create a user account when a new user is created.
 *
 * @param {functions.auth.UserRecord} user - The Firebase user record for the newly created user.
 */
export const createUserAccount = functions.auth.user().onCreate(async user => {
	try {
		const { uid, email, displayName, photoURL } = user
		const userObject = {
			uid,
			email,
			displayName,
			photoURL,
			accounts: {
				['firebase']: {
					id: uid,
					email,
				},
			},
			createdAt: admin.firestore.FieldValue.serverTimestamp(),
		}

		await admin.firestore().collection('users').doc(uid).set(userObject)
		console.log(`User account created: ${uid}`)
	} catch (error) {
		handleServerError(error)
	}
})

/**
 * Firebase HTTP Function to authenticate with Auth0 and create a Firebase custom token.
 *
 * @param {functions.https.Request} req - The HTTP request object containing the Auth0 token.
 * @param {functions.Response} res - The HTTP response object to send the Firebase custom token.
 */
export const authWithAuth0 = functions.https.onRequest(async (req, res) => {
	try {
		const { auth0Token } = req.body
		if (!auth0Token) throw new Error('No auth token passed')

		const userInfo = await auth0.users?.getInfo(req.body.auth0Token)
		if (!userInfo) throw new Error('No user info')

		const usersCollection = admin.firestore().collection('users')
		const userSnapshot = await findUserByAccount(
			usersCollection,
			ACCOUNT_TYPE_AUTH0,
			userInfo.user_id,
		)

		const customToken = await createOrUpdateUserAndToken(
			usersCollection,
			userSnapshot,
			ACCOUNT_TYPE_AUTH0,
			userInfo.email,
			userInfo.user_id,
		)

		res.json({ firebaseToken: customToken })
	} catch (error) {
		handleServerErrorResponse(error, res)
	}
})

/**
 * Firebase HTTP Function to authenticate with Apple and create a Firebase custom token.
 *
 * @param {functions.https.Request} req - The HTTP request object containing Apple ID and email.
 * @param {functions.Response} res - The HTTP response object to send the Firebase custom token.
 */
export const authWithApple = functions.https.onRequest(async (req, res) => {
	try {
		const appleId: string = req.body.appleId
		const email: string | undefined = req.body.email

		const usersCollection = admin.firestore().collection('users')
		const userSnapshot = await findUserByAccount(usersCollection, ACCOUNT_TYPE_APPLE, appleId)

		const customToken = await createOrUpdateUserAndToken(
			usersCollection,
			userSnapshot,
			ACCOUNT_TYPE_APPLE,
			email || '',
			undefined, // Pass undefined for the user_id
			appleId,
		)

		res.json({ firebaseToken: customToken })
	} catch (error) {
		handleServerErrorResponse(error, res)
	}
})

/**
 * Create or update a user account in Firestore and generate a Firebase custom token.
 *
 * @param {admin.firestore.CollectionReference} usersCollection - Firestore collection reference for users.
 * @param {admin.firestore.QuerySnapshot} userSnapshot - Firestore query snapshot for finding a user.
 * @param {string} uidOrLabel - The Firebase user ID or label.
 * @param {string} email - The user's email address (optional).
 * @param {string} user_id - The user_id (optional).
 * @param {string} appleId - The Apple ID (optional).
 * @return {Promise<string>} A promise that resolves to the Firebase custom token.
 */
async function createOrUpdateUserAndToken(
	usersCollection: admin.firestore.CollectionReference,
	userSnapshot: admin.firestore.QuerySnapshot,
	uidOrLabel: string,
	email?: string,
	user_id?: string,
	appleId?: string,
): Promise<string> {
	try {
		const user = {
			uid: uidOrLabel,
			createdAt: admin.firestore.FieldValue.serverTimestamp(),
			accounts: {
				...(email ? { [uidOrLabel]: { email } } : {}),
				...(user_id ? { [uidOrLabel]: { auth0Id: user_id } } : {}),
				...(appleId ? { [uidOrLabel]: { appleId } } : {}),
			},
		}

		if (!userSnapshot.empty) {
			const userDoc = userSnapshot.docs[0]
			// Merge with existing user data
			await userDoc.ref.set(user, { merge: true })
		} else {
			// Create a new user
			await usersCollection.doc(uidOrLabel).set(user)
		}

		// Create and return the Firebase custom token
		return admin.auth().createCustomToken(uidOrLabel)
	} catch (error) {
		handleServerError(error)
		return ''
	}
}

/**
 * Retrieve user information from Auth0 using the provided token.
 *
 * @param {string} auth0Token - The Auth0 access token.
 * @return {Promise<Jwt | undefined>} A promise that resolves to the user information from Auth0.
 */
async function getUserInfoFromAuth0(auth0Token: string): Promise<Jwt | undefined> {
	try {
		const userInfo = (await auth0.users?.getInfo(auth0Token)) as Jwt | undefined
		return userInfo
	} catch (error) {
		console.error('Error fetching user info from Auth0:', error)
		return undefined
	}
}
