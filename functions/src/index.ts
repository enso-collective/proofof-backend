import * as admin from 'firebase-admin'

const serviceAccount = require('../serviceAccountKey.json')

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
})

if (process.env.NODE_ENV !== 'production') {
	admin.firestore().settings({
		host: 'localhost:8080',
		ssl: false,
	})
}

export { deletePostFromBoards } from './routes/delete'
export { authWithApple, authWithAuth0, createUserAccount, loginWithWallet } from './routes/login'
export { validateEmail, validateUsername } from './routes/validation'
