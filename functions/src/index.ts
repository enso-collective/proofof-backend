import * as admin from 'firebase-admin';
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export { farcasterWebhook } from './farcasterWebhook'
export { attestation } from './attestation'
export { attest_poap } from "./poap"
export { twitterScheduler } from './twitterScheduler'
export { farcasterFrame } from './farcasterFrame'
export { validationWebhook } from './validationWebhook'
export { internalMintWebhook } from './internalMintWebhook'
export { internalMintNotesWebhook } from './internalMintNotesWebhook'
