import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { eas_mint } from './mint'
import { farcasterFrameInput } from './schemes';
import { validateBrand, extractBrand } from './aiValidations'
import { determineQuestId } from './ensoUtils'

export const farcasterFrame = functions.https.onRequest(async (req, res) => {
    try {
        const data = farcasterFrameInput.parse({
            key: req.body.key,
            username: req.body.username,
            imageUrl: req.body.imageUrl,
            message: req.body.message,
            castHash: req.body.castHash,
            wallet: req.body.wallet
        });

        console.log(data);
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

        if (data.wallet === undefined) {
            // reply in farcaster
            res.status(500).send({ message: `Please add a verified wallet in your profile settings and retry this cast to mint a Proof` });
            return
        }

        const brandName = await extractBrand(data.message);
        if (brandName === null) {
            res.status(500).send({message: `We didn't find a clear brand or quest described in your cast @${data.username}. Please retry your cast with more specific description of the brand or quest hashtag.`});
            return;
        }

        const brandValidation = await validateBrand(brandName, data.message, data.imageUrl);
        if (brandValidation === null) {
            res.status(500).send({message: `@${data.username} the AI analysis of your description & image determined it to be "${brandValidation}" for a Proof. Please try again with a different image or description.`});
            return;
        }

        let questId = determineQuestId(brandName);

        const castURL = `https://warpcast.com/${data.username}/0x${data.castHash.substring(2, 10)}`;
        const hash = await eas_mint(data.username, data.wallet, castURL, data.imageUrl, data.message, questId);

        const url = `https://www.onceupon.gg/${hash}`;
        console.log(url);

        res.json({ url: url });
    } catch(error) {
        res.status(500).send(error);
    }
});