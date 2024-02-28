import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { eas_mint } from './mint'
import { attestationInput } from './schemes';

export const attestation = functions.https.onRequest(async (req, res) => {
    try {
        const data = attestationInput.parse({
            key: req.body.key,
            quest: req.body.quest,
            data: req.body.data
        });

        const apiUsersCollection =  admin.firestore().collection('apiUsers');
        const apiUsersSnapshot = await apiUsersCollection.where('key', '==', data.key).get();
        if (apiUsersSnapshot.docs.length == 0) {
            res.status(401).send("Unauthorized");
        }

        // const apiUser = apiUsersSnapshot.docs[0].data();
        // apiUser.company
        // apiUser.wallet

        // await eas_mint()
        res.json({  })
    } catch(error) {
        res.status(500).send(error);
    }
});