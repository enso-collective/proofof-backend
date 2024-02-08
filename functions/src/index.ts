import * as admin from 'firebase-admin';
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
export {
  authWithAuth0,
  authWithApple,
  loginWithWallet,
  attachWalletToUser,
  updateUserPublicMetadata,
  createUserAccount,
  updateUserOnAccountCreation,
} from './loginv2';
export {
  incrementCredentialsCount,
  requestDiscoCredentials,
  // lookupForCreds,
  // updateCounters,
} from './leaderboard';
export { deletePostFromBoards } from './delete';
// export { migrateUserData, exportData } from './login';
export { validateEmail, validateUsername } from './validation';
