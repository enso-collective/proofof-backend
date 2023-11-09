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

exports.authWithAuth0 = functions.https.onRequest(async (req, res) => {
  try {
    const auth0Token = req.body.auth0Token;
    const accountType = 'auth0';
    const userInfo = await auth0.users?.getInfo(auth0Token);

    if (!userInfo) throw new Error('No user info');
    const auth0UserId = userInfo.sub.split('|')[1];

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

exports.authWithApple = functions.https.onRequest(async (req, res) => {
  try {
    const appleId = req.body.appleId;
    const email = req.body.email; // Email is optional
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
      email: email, // Assuming email is optional
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

exports.loginWithWallet = functions.https.onRequest(async (req, res) => {
  try {
    const walletPublicAddress = req.body.walletPublicAddress;
    const walletName = req.body.walletName;
    const namespace = req.body.namespace;
    const reference = req.body.reference;

    const accountType = 'crypto';

    const accountsCollection = admin.firestore().collection('accounts');
    const accountSnapshot = await accountsCollection
      .where('type', '==', accountType)
      .where('walletAddress', '==', walletPublicAddress)
      .where('provider', '==', walletName)
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
      type: 'crypto',
      walletAddress: walletPublicAddress,
      provider: walletName,
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

exports.attachWalletToUser = functions.https.onCall(async (data, context) => {
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
    const userId = context.auth.uid; // The UID of the authenticated user

    const accountType = 'crypto';
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
    throw new functions.https.HttpsError('internal', error.message);
  }
});
