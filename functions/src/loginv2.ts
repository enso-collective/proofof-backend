import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { AuthenticationClient } from 'auth0';
import {
  AppleAccountSchema,
  Auth0AccountSchema,
  CryptoWalletSchema,
  FirebaseAccountSchema,
  UserSchema,
} from './schemes';
import { log, warn } from 'firebase-functions/logger';

const auth0 = new AuthenticationClient({
  domain: 'dev-gjtt35jcnaro1wqn.us.auth0.com',
  clientId: 'N0dyY1AJ7UVluxDlvtN1Nsvc0sW9qHl8',
});

export const updateUserOnAccountCreation = functions.firestore
  .document('accounts/{accountId}')
  .onCreate(async (snap, context) => {
    const accountData = snap.data();

    // Check if the account type is 'crypto'
    if (accountData.type === 'crypto') {
      const userId = accountData.userId;
      const walletAddress = accountData.walletAddress;

      // Reference to the user document
      const userRef = admin.firestore().collection('users').doc(userId);

      // Update the user document
      await userRef.update({
        walletAddress: walletAddress,
      });
    }
  });



export const updateUserPublicMetadata = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    const userId = context.params.userId;
    const usersPublicMetadataRef = admin
      .firestore()
      .collection('usersPublicMetadata');
    const snapshot = await usersPublicMetadataRef
      .where('userId', '==', userId)
      .get();

    if (!change.after.exists) {
      if (!snapshot.empty) {
        const publicMetadataRef = snapshot.docs[0].ref;
        await publicMetadataRef.delete();
      }
      return null;
    }

    const userData = change.after.data();
    if (!userData) {
      return null;
    }

    // Check each field for undefined and provide a default value or omit it
    const userPublicInfo = {
      avatar: userData.avatar || '',
      username: userData.username || '',
      displayName: userData.displayName || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      backgroundUrl: userData.backgroundUrl || '',
      bio: userData.bio || '',
    };

    if (!snapshot.empty) {
      const publicMetadataRef = snapshot.docs[0].ref;
      await publicMetadataRef.set(userPublicInfo, { merge: true });
    } else {
      await usersPublicMetadataRef
        .doc(userId)
        .set({ ...userPublicInfo, userId });
    }

    return null;
  });

export const createUserAccount = functions.auth
  .user()
  .onCreate(async (user) => {
    const { uid, email } = user;

    // Create the user object using the UserSchema
    const userObject = UserSchema.parse({
      uid: uid,
      email: email,
      // Add any other user fields as per your schema requirements
    });

    // Create the Firebase account object using the FirebaseAccountSchema
    const accountObject = FirebaseAccountSchema.parse({
      userId: uid,
      type: 'firebase',
      email: email,
      firebaseId: uid,
    });

    try {
      await admin.firestore().collection('users').doc(uid).set(userObject);
      const accountsCollection = admin.firestore().collection('accounts');
      await accountsCollection.add(accountObject);
      log(`User account created: ${uid}`);
    } catch (error) {
      warn(`Error creating user account: ${error}`);
    }
  });

export const authWithAuth0 = functions.https.onRequest(async (req, res) => {
  try {
    const auth0Token = req.body.auth0Token;
    const accountType = 'auth0';
    const userInfo = await auth0.users?.getInfo(auth0Token);

    if (!userInfo) throw new Error('No user info');
    const auth0UserId = (userInfo as any).sub.split('|')[1];

    const accountsCollection = admin.firestore().collection('accounts');
    const accountSnapshot = await accountsCollection
      .where('type', '==', accountType)
      .where('auth0Id', '==', auth0UserId)
      .get();

    if (!accountSnapshot.empty) {
      const accountDoc = accountSnapshot.docs[0];
      const userId = accountDoc.data().userId;
      const customToken = await admin.auth().createCustomToken(userId);
      res.json({ firebaseToken: customToken });
      return;
    }

    const userRef = admin.firestore().collection('users').doc();
    const accountRef = accountsCollection.doc();
    const user = {
      uid: userRef.id,
      email: userInfo.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await userRef.set(user);

    const account = Auth0AccountSchema.parse({
      userId: userRef.id,
      type: accountType,
      email: userInfo.email,
      auth0Id: auth0UserId,
    });

    await accountRef.set(account);

    const customToken = await admin.auth().createCustomToken(userRef.id);
    res.json({ firebaseToken: customToken });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

export const authWithApple = functions.https.onRequest(async (req, res) => {
  try {
    const appleId = req.body.appleId;
    const accountType = 'apple';

    const accountsCollection = admin.firestore().collection('accounts');
    const accountSnapshot = await accountsCollection
      .where('type', '==', accountType)
      .where('appleId', '==', appleId)
      .get();

    if (!accountSnapshot.empty) {
      // Account found, generate custom token for Firebase auth
      const accountDoc = accountSnapshot.docs[0];
      const userId = accountDoc.data().userId;
      const customToken = await admin.auth().createCustomToken(userId);
      res.json({ firebaseToken: customToken });
      return;
    }

    // No account found, create new user and account
    const userRef = admin.firestore().collection('users').doc();
    const accountRef = accountsCollection.doc();

    // Create user document
    const user = {
      uid: userRef.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await userRef.set(user);

    const validatedData = AppleAccountSchema.parse({
      userId: userRef.id,
      type: accountType,
      appleId: appleId,
    });
    await accountRef.set(validatedData);

    const customToken = await admin.auth().createCustomToken(userRef.id);
    res.json({ firebaseToken: customToken });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

export const loginWithWallet = functions.https.onRequest(async (req, res) => {
  try {
    const walletPublicAddress = req.body.walletPublicAddress;
    const namespace = req.body.namespace;
    const reference = req.body.reference;

    const accountType = 'crypto';

    const accountsCollection = admin.firestore().collection('accounts');
    const accountSnapshot = await accountsCollection
      .where('type', '==', accountType)
      .where('walletAddress', '==', walletPublicAddress)
      .get();

    if (!accountSnapshot.empty) {
      // Account found, generate custom token for Firebase auth
      const accountDoc = accountSnapshot.docs[0];
      const userId = accountDoc.data().userId;
      const customToken = await admin.auth().createCustomToken(userId);
      res.json({ firebaseToken: customToken });
      return;
    }

    // No account found, create new user and account
    const userRef = admin.firestore().collection('users').doc();
    const accountRef = accountsCollection.doc();

    // Create user document
    const user = {
      uid: userRef.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await userRef.set(user);

    const validatedData = CryptoWalletSchema.parse({
      userId: userRef.id,
      type: accountType,
      walletAddress: walletPublicAddress,
      namespace,
      reference,
    });
    await accountRef.set(validatedData);

    const customToken = await admin.auth().createCustomToken(userRef.id);
    res.json({ firebaseToken: customToken });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

export const attachWalletToUser = functions.https.onCall(
  async (data, context) => {
    // Check if the function call is made by an authenticated user
    if (!context.auth) {
      // Throwing an HttpsError so that the client gets the error details.
      throw new functions.https.HttpsError(
        'unauthenticated',
        'The function must be called while authenticated.',
      );
    }

    try {
      const { walletPublicAddress, walletName, namespace, reference } = data;
      const accountsCollection = admin.firestore().collection('accounts');

      // Check if the wallet is already attached to the user
      const existingAccountSnapshot = await accountsCollection
        .where('walletAddress', '==', walletPublicAddress)
        .get();

      if (!existingAccountSnapshot.empty) {
        // Throwing an HttpsError so that the client gets the error details.
        throw new functions.https.HttpsError(
          'already-exists',
          'This wallet is already attached to the user.',
        );
      }

      // Attach wallet account to the user
      const accountRef = accountsCollection.doc();

      const validatedData = CryptoWalletSchema.parse({
        userId: context.auth.uid,
        type: 'crypto',
        walletAddress: data.walletPublicAddress,
        provider: walletName,
        namespace,
        reference,
      });

      await accountRef.set(validatedData);

      return { result: 'Wallet attached to user successfully.' };
    } catch (error) {
      // Throwing an HttpsError so that the client gets the error details.
      throw new functions.https.HttpsError('internal', (error as any).message);
    }
  },
);
