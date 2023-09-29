import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { AuthenticationClient } from 'auth0';

const auth0 = new AuthenticationClient({
  domain: 'dev-gjtt35jcnaro1wqn.us.auth0.com',
  clientId: 'N0dyY1AJ7UVluxDlvtN1Nsvc0sW9qHl8',
});

interface Jwt {
  sub: string;
  email: string;
  user_id: string;
}

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
