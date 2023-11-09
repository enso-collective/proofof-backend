import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const validateEmail = functions.https.onRequest(async (req, res) => {
  try {
    const email: string = req.body.email;
    const usersCollection = admin.firestore().collection('users');
    const userSnapshot = await usersCollection
      .where('email', '==', email)
      .get();

    if (!userSnapshot.empty) {
      res.json({ exists: true });
      return;
    } else {
      res.json({ exists: false });
      return;
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

export const validateUsername = functions.https.onRequest(async (req, res) => {
  try {
    const username: string = req.body.username;
    const usersCollection = admin.firestore().collection('users');
    const userSnapshot = await usersCollection
      .where('username', '==', `@${username}`)
      .get();

    if (!userSnapshot.empty) {
      res.json({ exists: true });
      return;
    } else {
      res.json({ exists: false });
      return;
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});
