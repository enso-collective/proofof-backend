import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { AuthenticationClient } from 'auth0';
import {
  AppleAccountSchema,
  Auth0AccountSchema,
  CryptoWalletSchema,
} from './schemes';

const auth0 = new AuthenticationClient({
  domain: 'dev-gjtt35jcnaro1wqn.us.auth0.com',
  clientId: 'N0dyY1AJ7UVluxDlvtN1Nsvc0sW9qHl8',
});

interface Jwt {
  sub: string;
  email: string;
  user_id: string;
}

const pattern = /^metamask/;

export const createUserAccount = functions.auth
  .user()
  .onCreate(async (user) => {
    const { uid, email, displayName, photoURL } = user;
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
    };
    try {
      await admin.firestore().collection('users').doc(uid).set(userObject);
      console.log(`User account created: ${uid}`);
    } catch (error) {
      console.error(`Error creating user account: ${error}`);
    }
  });

export const authWithAuth0 = functions.https.onRequest(async (req, res) => {
  try {
    const auth0Token: string = req.body.auth0Token;
    const accountType: string = 'auth0';
    const userInfo = (await auth0.users?.getInfo(auth0Token)) as
      | Jwt
      | undefined;
    if (!userInfo) throw new Error('No user info');
    userInfo.user_id = userInfo.sub.split('|')[1];

    const usersCollection = admin.firestore().collection('users');
    const userSnapshot = await usersCollection
      .where('accounts.auth0.auth0Id', '==', userInfo.user_id)
      .get();

    if (!userSnapshot.empty) {
      const userDoc = userSnapshot.docs[0];
      const firebaseUid = userDoc.id;
      const customToken = await admin.auth().createCustomToken(firebaseUid);
      res.json({ firebaseToken: customToken });
      return;
    }

    const userRef = usersCollection.doc();

    const user = {
      uid: userRef.id,
      email: userInfo.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      accounts: {
        [accountType]: {
          auth0Id: userInfo.user_id,
          email: userInfo.email,
        },
      },
    };

    await userRef.set(user, { merge: true });
    const customToken = await admin.auth().createCustomToken(userRef.id);
    res.json({ firebaseToken: customToken });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// ...

// Function to determine the account type
function determineAccountType(accountData: any) {
  if (accountData.publicAddress) {
    return 'crypto';
  } else if (accountData.auth0Id) {
    return 'auth0';
  } else if (accountData.appleId) {
    return 'apple';
  } else if (accountData.email && accountData.id) {
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
      const isMetamask = pattern.test(accountKey);
      accountDoc = CryptoWalletSchema.parse({
        userId,
        type: accountType,
        walletAddress: accountData.publicAddress,
        provider: isMetamask ? 'metamask' : 'walletconnect',
      });
      break;
    case 'firebase':
      accountDoc = {
        userId,
        type: accountType,
        identifier: accountData.email,
      };
      break;
    // Add cases for other account types if necessary
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
});

export const authWithApple = functions.https.onRequest(async (req, res) => {
  try {
    const appleId: string = req.body.appleId;
    const email: string | undefined = req.body.email;
    const accountType: string = 'apple';

    const usersCollection = admin.firestore().collection('users');
    const userSnapshot = await usersCollection
      .where(`accounts.${accountType}.appleId`, '==', appleId)
      .get();

    if (!userSnapshot.empty) {
      const userDoc = userSnapshot.docs[0];
      const firebaseUid = userDoc.id;
      const customToken = await admin.auth().createCustomToken(firebaseUid);
      res.json({ firebaseToken: customToken });
      return;
    }

    const userRef = usersCollection.doc();

    const user = {
      uid: userRef.id,
      email: email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      accounts: {
        [accountType]: {
          appleId,
        },
      },
    };

    await userRef.set(user, { merge: true });
    const customToken = await admin.auth().createCustomToken(userRef.id);
    res.json({ firebaseToken: customToken });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});
