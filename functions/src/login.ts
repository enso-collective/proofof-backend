import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
// import { AuthenticationClient } from 'auth0';
import {
  AppleAccountSchema,
  Auth0AccountSchema,
  CryptoWalletSchema,
} from './schemes';

// Function to determine the account type
function determineAccountType(accountData: any) {
  if (accountData.publicAddress) {
    return 'crypto';
  } else if (accountData.auth0Id) {
    return 'auth0';
  } else if (accountData.appleId) {
    return 'apple';
  } else if (accountData.id) {
    return 'firebase'; // Assuming the presence of 'id' implies a Firebase account
  }
  // Add more conditions as needed for other account types
  return null; // or a default account type if applicable
}

// Function to create Account document from old user account map
function createAccountDocument(
  userId: string,
  accountData: any,
  accountKey: string,
) {
  const accountType = determineAccountType(accountData);
  let accountDoc;

  switch (accountType) {
    case 'auth0':
      accountDoc = Auth0AccountSchema.parse({
        userId,
        type: accountType,
        auth0Id: accountData.auth0Id,
      });
      break;
    case 'apple':
      accountDoc = AppleAccountSchema.parse({
        userId,
        type: accountType,
        appleId: accountData.appleId,
      });
      break;
    case 'crypto':
      accountDoc = CryptoWalletSchema.parse({
        userId,
        type: accountType,
        namespace: accountData.namespace,
        walletAddress: accountData.publicAddress,
        reference: accountData.reference,
      });
      break;
    case 'firebase':
      accountDoc = {
        userId,
        type: accountType,
        email: accountData.email,
      };
      break;
  }
  return accountDoc;
}

export const exportData = functions.https.onRequest(async (req, res) => {
  const usersRef = admin.firestore().collection('users');

  // Get all user documents
  const usersSnapshot = await usersRef.get();

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const userId = userDoc.id;

    // Iterate over accounts in the user document
    for (const [key, accountData] of Object.entries(userData.accounts || {})) {
      const accountDoc = createAccountDocument(userId, accountData, key);
      await admin
        .firestore()
        .collection('accounts')
        .add(accountDoc as any);
    }
  }
  res.send('Migration completed.');
});

export const migrateUserData = functions.https.onRequest(async (req, res) => {
  // Reference to the users collection
  const usersRef = admin.firestore().collection('users');

  // Reference to the publicInfo sub-collection
  const batch = admin.firestore().batch();

  // Fetch all user documents
  const snapshot = await usersRef.get();

  snapshot.forEach((doc) => {
    const userData = doc.data();
    const userId = doc.id;

    // Transform the data
    const publicInfo = {
      avatarUrl: userData.avatarUrl || '',
      username: userData.username || '',
      displayName: userData.displayName || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      userId,
      bio: userData.bio || '',
      backgroundUrl: userData.backgroundUrl || '',
    };

    // Write to the publicInfo sub-collection
    const publicInfoRef = admin
      .firestore()
      .collection('usersPublicMetadata')
      .doc(userId);

    batch.set(publicInfoRef, publicInfo, { merge: true });
  });

  // Commit the batch
  await batch.commit();

  res.send('Migration completed.');
});
