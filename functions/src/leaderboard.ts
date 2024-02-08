import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { searchCredentials } from './getDiscoCredentialsList';

async function buildLeaderboard() {
  try {
    const usersCollection = db.collection('usersPublicMetadata');
    const credentialsCollection = db.collection('credentials');
    const leaderboardCollection = db.collection('leaderboard');

    const usersSnapshot = await usersCollection.get();

    // Initialize batch
    const batch = db.batch();

    for (const userDocument of usersSnapshot.docs) {
      const userId = userDocument.id;
      const userPublicInfo = userDocument.data();
      const credentialsQuerySnapshot = await credentialsCollection
        .where('ownerId', '==', userId)
        .get();

      const credentials = credentialsQuerySnapshot.docs.map((doc) =>
        doc.data(),
      );
      const followersCount = await getFollowersCount(userId);

      const leaderboardRow = {
        userId,
        userPublicInfo,
        followersCount,
        credentials,
        credentialsCount: credentials.length,
      };

      // Set document in the batch
      const leaderboardDocRef = leaderboardCollection.doc(userId);
      batch.set(leaderboardDocRef, leaderboardRow, { merge: true });
    }

    // Commit the batch
    await batch.commit();

    console.log('Leaderboard updated successfully.');
  } catch (error) {
    console.error('Error building leaderboard: ', error);
    throw error;
  }
}

async function getFollowersCount(uid: string) {
  const userFollowsCollection = db.collection('userFollows');
  const query = userFollowsCollection.where('to', '==', uid);

  try {
    const snapshot = await query.get();
    return snapshot.empty ? 0 : snapshot.docs.length;
  } catch (error) {
    console.error('Error fetching followers count: ', error);
    return 0;
  }
}

export const incrementCredentialsCount = functions.firestore
  .document('credentials/{credentialId}')
  .onCreate(async (snap, context) => {
    const credential = snap.data();
    const userId = credential.ownerId;
    const userMetadataRef = admin
      .firestore()
      .collection('usersPublicMetadata')
      .doc(userId);

    return admin.firestore().runTransaction(async (transaction) => {
      const userMetadataDoc = await transaction.get(userMetadataRef);
      const currentCount = (userMetadataDoc.data()?.credentialsCount || 0) + 1;

      transaction.update(userMetadataRef, {
        credentialsCount: currentCount,
      });

      const leaderboardRef = admin.firestore().collection('leaderboard');
    });
  });

export const requestDiscoCredentials = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'The function must be called while authenticated.',
      );
    }

    const userId = context.auth.uid;
    const userDoc = await admin
      .firestore()
      .collection('users')
      .doc(userId)
      .get();

    if (!userDoc.exists || !userDoc.data()?.walletAddress) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'User must have a wallet address.',
      );
    }

    const credentials = await searchCredentials({
      walletAddress: `did:ethr:${userDoc.data()!.walletAddress.toLowerCase()}`,
    });

    if (credentials.length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'No credentials found for the provided wallet address.',
      );
    }

    const credentialsRef = admin.firestore().collection('credentials');
    for (const credential of credentials) {
      // Check if the credential already exists
      const existingCredentialSnapshot = await credentialsRef
        .where(
          'vc.credentialSubject.person1',
          '==',
          credential.vc.credentialSubject.person1,
        )
        .where(
          'vc.credentialSubject.person2',
          '==',
          credential.vc.credentialSubject.person2,
        )
        .where('ownerId', '==', userDoc.id) // Use the variable `uid` instead of the string 'uid'
        .get();

      if (existingCredentialSnapshot.empty) {
        await credentialsRef.doc().set({
          type: 'disco',
          vc: credential.vc,
          schema: credential.schema,
          issuer: credential.issuer,
          ownerId: userId,
        });
      }
    }
    return { success: true };
  },
);

// const userObjects = [
//   {
//     uid: '1O65uctYVKXsAsivHpkV',
//     walletAddress: '0x546457bbDdf5e09929399768AB5a9D588Cb0334d',
//   },
//   {
//     uid: '4McOgWYaHQeFThSyfGvR',
//     walletAddress: '0x99EFA25Abfe6c476ec7F2842857deE55f7af381f',
//   },
//   {
//     uid: '8CRmPOfXl4ivcPcG8KQA',
//     walletAddress: '0xf93045917Cf9Ff9ecCb2EBEE591501a6381afdEf',
//   },
//   {
//     uid: 'BtOdA8sII5NnM5b87pF4',
//     walletAddress: '0x88A725F999b012F7d83413951b37417B4EcA87C7',
//   },
//   {
//     uid: 'CN6eirI1jzkIXrrDrrg3',
//     walletAddress: '0xd9e41C5F18F3516514AF73F10b93E5886fbeb01B',
//   },
//   {
//     uid: 'IOb7qmoUOpEUJifZtvjm',
//     walletAddress: '0xC06C7C6ec618DE992d597D8e347669EA44eDe2bc',
//   },
//   {
//     uid: 'JD1gyMhdWsAluFopKjET',
//     walletAddress: '0x428BDdDD8a95286A01E8d1425e46fE9E5389A528',
//   },
//   {
//     uid: 'MgIAqaLvrl5NTRHgQBe0',
//     walletAddress: '0x686129b664A59b35ed1F070257f9EA8894196b69',
//   },
//   {
//     uid: 'W27nEaU1K4EeUTDCFJcE',
//     walletAddress: '0xF3FBC7A936E9332f196AFd8C49153da9525EBBd0',
//   },
//   {
//     uid: 'av4D5WVsa1pUlf4yIIPl',
//     walletAddress: '0xd0f46a5d48596409264d4efc1f3b229878fff743',
//   },
//   {
//     uid: 'd1xbe97xp3w7ZJIWBCpW',
//     walletAddress: '0x418B1cE1F8B160c0fe7ceE2F475f7f1aCd1643c0',
//   },
//   {
//     uid: 'f0wkps3BTbvhqFQ21gGN',
//     walletAddress: '0xb4CE8dcf4312dB84f428fD5293d4a0dDe35Ec106',
//   },
//   {
//     uid: 'j5tUarKS6Li0f40ATZtY',
//     walletAddress: '0xe75e82d21c0db44174639d9db3355e45b8be63bf',
//   },
//   {
//     uid: 'syuYvlmnFK2UuZInBNKL',
//     walletAddress: '0x5bca9e6e693dc462695AE428ffF11D566cD1F631',
//   },
//   {
//     uid: 'u68Rk0DCom0jmvwhGtn1',
//     walletAddress: '0xf47a5fB35E4d746c14835d79C8a515830dE30FC7',
//   },
//   {
//     uid: 'uQtMgs5e0UY4ZA07QkVe',
//     walletAddress: '0xd8880f5420f06304873cd346a516d3da3beed0b2',
//   },
//   {
//     uid: 'vbBKvRLYMzRfYNvH01Lr',
//     walletAddress: '0x8d25687829D6b85d9e0020B8c89e3Ca24dE20a89',
//   },
//   {
//     uid: 'wHMfe6BAROTzQICF3RhAu4s5JGu2',
//     walletAddress: '0x16Df05C1fC34B1F03F6fcd76d711B7230E20d14F',
//   },
//   {
//     uid: 'xUXFSUsl9lI55eWKG6mT',
//     walletAddress: '0xFC2C8F9458330027A8E517D7D6a0d4854eAe3109',
//   },
//   {
//     uid: 'zlhGxFWtpBnbTUNLcQR4',
//     walletAddress: '0x7fC80faD32Ec41fd5CfcC14EeE9C31953b6B4a8B',
//   },
//   {
//     uid: 'zrcxvyRt83NqyYoS6GQD',
//     walletAddress: '0xAE419a2Ec9E77374B03479293CB4a509A6117825',
//   },
// ];
// export const lookupForCreds = functions
//   .runWith({
//     timeoutSeconds: 300,
//   })
//   .https.onRequest(async (req, res) => {
//     await Promise.all(
//       userObjects.map(async ({ uid, walletAddress }) => {
//         const did = `did:ethr:${walletAddress.toLowerCase()}`;
//         info('Looking up for', did);
//         const credentials = await searchCredentials({
//           walletAddress: did,
//         });

//         const filteredCredentials = credentials.filter(
//           (credential) =>
//             credential.vc.credentialSubject.person2.toLowerCase() !==
//             credential.vc.credentialSubject.person1.toLowerCase(),
//         );

//         const userDoc = await admin
//           .firestore()
//           .collection('users')
//           .doc(uid)
//           .get();

//         if (!userDoc.exists || credentials.length === 0) {
//           return;
//         }

//         const credentialsRef = admin.firestore().collection('credentials');

//         for (const credential of filteredCredentials) {
//           const existingCredentialSnapshot = await credentialsRef
//             .where(
//               'vc.credentialSubject.person1',
//               '==',
//               credential.vc.credentialSubject.person1,
//             )
//             .where(
//               'vc.credentialSubject.person2',
//               '==',
//               credential.vc.credentialSubject.person2,
//             )
//             .where('ownerId', '==', uid) // Use the variable `uid` instead of the string 'uid'
//             .get();

//           if (existingCredentialSnapshot.empty) {
//             await credentialsRef.doc().set({
//               type: 'disco',
//               userIsClaimed: true,
//               vc: credential.vc,
//               schema: credential.schema,
//               issuer: credential.issuer,
//               ownerId: uid,
//             });
//           }
//         }
//       }),
//     );
//   });

// export const updateCounters = functions
//   .runWith({
//     timeoutSeconds: 300,
//   })
//   .https.onRequest(async (req, res) => {
//     const usersMetadataRef = admin
//       .firestore()
//       .collection('usersPublicMetadata');
//     const credentialsRef = admin.firestore().collection('credentials');

//     const usersSnapshot = await usersMetadataRef.get();
//     Promise.all(
//       usersSnapshot.docs.map(async (userDoc) => {
//         const userId = userDoc.id;

//         // Count the credentials for the user
//         const credentialsSnapshot = await credentialsRef
//           .where('ownerId', '==', userId)
//           .get();
//         let credentialsCount = 0;
//         if (!credentialsSnapshot.empty) {
//           credentialsCount = credentialsSnapshot.size;
//         }

//         // Update the credentialsCount in the user's metadata
//         await userDoc.ref.update({ credentialsCount });
//       }),
//     );
//     console.log('Updated credentials count for all users');
//   });
