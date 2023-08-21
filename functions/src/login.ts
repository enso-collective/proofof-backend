import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { AuthenticationClient } from 'auth0';
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const auth0 = new AuthenticationClient({
  domain: 'dev-gjtt35jcnaro1wqn.us.auth0.com',
  clientId: 'N0dyY1AJ7UVluxDlvtN1Nsvc0sW9qHl8',
});

interface Jwt {
  sub: string;
  email: string;
  user_id: string;
}

export const authWithAuth0 = functions.https.onRequest(async (req, res) => {
  try {
    const auth0Token: string = req.body.auth0Token;
    const accountType: string = 'auth0';
    const userInfo = (await auth0.users?.getInfo(auth0Token)) as
      | Jwt
      | undefined;
    if (!userInfo) throw new Error('No user info');
    userInfo.user_id = userInfo.sub.split('|')[1];
    const userRef = admin
      .firestore()
      .collection('users')
      .doc(userInfo.user_id!);

    const user = {
      uid: userInfo.user_id,
      accounts: {
        [accountType]: {
          auth0Id: userInfo.user_id,
          email: userInfo.email,
        },
      },
    };

    await userRef.set(user, { merge: true });
    const customToken = await admin.auth().createCustomToken(userInfo.user_id!);
    res.json({ firebaseToken: customToken });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});
