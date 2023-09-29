import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const loginWithWallet = functions.https.onRequest(async (req, res) => {
  try {
    const walletPublicAddress: string = req.body.walletPublicAddress;
    const walletName: string = req.body.walletName;
    const namespace: string = req.body.namespace;
    const reference: string = req.body.reference;

    const label = `${walletName}(${namespace}:${reference})`;

    const usersCollection = admin.firestore().collection('users');
    const userSnapshot = await usersCollection
      .where(`accounts.${label}.publicAddress`, '==', walletPublicAddress)
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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      accounts: {
        [label]: {
          publicAddress: walletPublicAddress,
          namespace,
          reference,
        },
      },
    };

    await userRef.set(user, { merge: true });
    const customToken = await admin.auth().createCustomToken(userRef.id); // Use the Firebase generated ID to create the custom token
    res.json({ firebaseToken: customToken });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});
