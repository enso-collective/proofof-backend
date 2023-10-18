import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { handleServerError, handleServerErrorResponse } from '../utils/handleServerError'

// Constants for Firestore collection names
const USERS_COLLECTION = 'users'

/**
 * Firebase HTTP Function to validate an email's existence in Firestore.
 *
 * @param {functions.https.Request} req - The HTTP request object containing the email to validate.
 * @param {functions.Response} res - The HTTP response object to send the validation result.
 */
export const validateEmail = functions.https.onRequest(async (req, res) => {
	try {
		const email: string = req.body.email
		const userExists = await checkUserExists('email', email)
		res.json({ exists: userExists })
	} catch (error) {
		handleServerErrorResponse(error, res)
	}
})

/**
 * Firebase HTTP Function to validate a username's existence in Firestore.
 *
 * @param {functions.https.Request} req - The HTTP request object containing the username to validate.
 * @param {functions.Response} res - The HTTP response object to send the validation result.
 */
export const validateUsername = functions.https.onRequest(async (req, res) => {
	try {
		const username: string = req.body.username
		const userExists = await checkUserExists('username', `@${username}`)
		res.json({ exists: userExists })
	} catch (error) {
		handleServerErrorResponse(error, res)
	}
})

/**
 * Check if a user with the specified field and value exists in Firestore.
 *
 * @param {string} field - The field to check (e.g., 'email', 'username').
 * @param {string} value - The value to check for existence.
 * @returns {Promise<boolean>} A promise that resolves to true if a user with the specified value exists, otherwise false.
 */
async function checkUserExists(field: string, value: string): Promise<boolean> {
	try {
		const usersCollection = admin.firestore().collection(USERS_COLLECTION)
		const userSnapshot = await usersCollection.where(field, '==', value).get()
		return !userSnapshot.empty
	} catch (error) {
		handleServerError(error)
		return false
	}
}
