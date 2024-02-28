import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { webhook_mint } from './webhookMint'
import { attestationInput } from './schemes';

export const attestation = functions.https.onRequest(async (req, res) => {
    try {
        const data = attestationInput.parse({
            key: req.body.key,
            quest: req.body.quest,
            data: req.body.data,
            userWallet: req.body.wallet
        });
        console.log(data);
        const apiUsersCollection =  admin.firestore().collection('apiUsers');
        const apiUsersSnapshot = await apiUsersCollection.where('key', '==', data.key).get();
        if (apiUsersSnapshot.docs.length == 0) {
            res.status(401).send("Unauthorized");
        }

        const apiUser = apiUsersSnapshot.docs[0].data();
        console.log(apiUser);

        const hash = await webhook_mint(data.userWallet, apiUser.company, data.quest, data.data);
        console.log(hash);
        const url = `https://www.onceupon.gg/${hash}`;
        console.log(url);

        res.json({ success: true, url: url});
    } catch(error) {
        res.status(500).send(error);
    }
});