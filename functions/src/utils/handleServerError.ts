import * as functions from 'firebase-functions'

/**
 * Handle server errors by logging them.
 *
 * @param {Error | unknown} error - The error to handle.
 */
export function handleServerError(error: Error | unknown): void {
	console.error('Server error:', error)
}
/**
 * Handle server errors by logging them and sending a 500 response.
 *
 * @param {Error | unknown} error - The error to handle.
 * @param {functions.Response} res - The HTTP response object to send the error response.
 */
export function handleServerErrorResponse(error: Error | unknown, res: functions.Response): void {
	console.error('Server error:', error)
	res.status(500).send('Server error')
}
