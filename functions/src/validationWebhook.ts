import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { validationInput } from './schemes';
import { validateBrand, extractBrand } from './aiValidations'
import { determineQuestId } from './ensoUtils'

export const validationWebhook = functions.https.onRequest(async (req, res) => {
    try {
        const data = validationInput.parse({
            key: req.body.key,
            imageUrl: req.body.imageUrl,
            username: req.body.username,
            message: req.body.message
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

        res.status(200).send({ brand: brandName,  validationMessage: brandValidation, questId: questId });
    } catch(error) {
        res.status(500).send(error);
    }
});