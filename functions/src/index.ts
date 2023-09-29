import * as admin from 'firebase-admin';
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
export { authWithAuth0, authWithApple, createUserAccount } from './login';
export { loginWithWallet } from './loginWithWallet';
export { deletePostFromBoards } from './delete';
export { validateEmail, validateUsername } from './validation';
