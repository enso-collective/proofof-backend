import * as admin from 'firebase-admin'

const serviceAccount = require('../serviceAccountKey.json')

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
})

if (process.env.NODE_ENV !== 'production') {
	admin.firestore().settings({
		host: 'localhost:8080',
		ssl: false,
		ignoreUndefinedProperties: true,
	})
}

export { deletePostFromBoards } from './routes/delete'
export { issueDiscoCredential } from './routes/disco'
export { loginWithEmail, loginWithWallet } from './routes/login'
export { signupWithEmail, signupWithWallet } from './routes/signup'
