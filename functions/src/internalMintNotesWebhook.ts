import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { eas_mint_notes } from './mintNotes'
import { internalMintNotesInput } from './schemes';

export const internalMintNotesWebhook = functions.https.onRequest(async (req, res) => {
    try {
        const data = internalMintNotesInput.parse({
            key: req.body.key,
            username: req.body.username, 
            attestWallet: req.body.wallet, 
            postUrl: req.body.postUrl, 
            noteText: req.body.noteText,
            sentiment: req.body.sentiment
        });

        const apiUsersCollection =  admin.firestore().collection('apiUsers');
        const apiUsersSnapshot = await apiUsersCollection.where('key', '==', data.key).get();
        if (apiUsersSnapshot.docs.length == 0) {
            res.status(401).send("Unauthorized");
            return;
        }

        const apiUser = apiUsersSnapshot.docs[0].data();
        console.log(apiUser);

        if (apiUser.company != "enso") {
            res.status(401).send("Unauthorized");
            return;
        }

        const hash = await eas_mint_notes(data.username, data.attestWallet, data.postUrl, data.noteText, data.sentiment);

        const url = `https://www.onceupon.gg/${hash}`;
        console.log(url);

        res.json({ url: url });
    } catch(error) {
        res.status(500).send(error);
    }
});