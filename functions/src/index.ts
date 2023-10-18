import * as admin from 'firebase-admin'

const serviceAccount = require('../serviceAccountKey.json')

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
})

export { deletePostFromBoards } from './routes/delete'
export { authWithApple, authWithAuth0, createUserAccount, loginWithWallet } from './routes/login'
export { validateEmail, validateUsername } from './routes/validation'
