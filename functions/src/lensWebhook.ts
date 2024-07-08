import * as admin from 'firebase-admin';
import { LensClient, production, IStorageProvider, NotificationType, PostFragment, ImageMetadataV3Fragment } from "@lens-protocol/client";
import { ethers } from "ethers";
import * as functions from 'firebase-functions/v2';
import { lensWebhookInput } from './schemes';
import { validateBrand, extractBrand } from './aiValidations'
import { determineQuestId } from './ensoUtils'
import { eas_mint } from './mint'
import { textOnly } from '@lens-protocol/metadata'
import Irys from "@irys/sdk";

const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY as string;
const PROFILE_ID = process.env.PROFILE_ID;
const WALLET_PRIVATE = process.env.MINT_WALLET_PRIVATE_KEY

const irys = new Irys({
  network: 'mainnet',
  token: 'base-eth',
  key: WALLET_PRIVATE,
});

class FirebaseLensStorageProvider implements IStorageProvider {
  readonly collection = admin.firestore().collection('lensAuth');

  async getItem(key: string) {
    const auth = await this.collection.doc('auth').get();
    return auth.data()?.token
  }

  async setItem(key: string, value: string) {
    const auth = this.collection.doc('auth');
    await auth.update({ token: value });
  }

  async removeItem(key: string) {
    const auth = this.collection.doc('auth');
    await auth.update({ key: admin.firestore.FieldValue.delete() });
  }
}

const lensClient = new LensClient({
  environment: production,
  storage: new FirebaseLensStorageProvider(),
});

// export const lensScheduler = onSchedule('* * * * *', async (event) => {
//   const notifications = await lensClient.notifications.fetch({ where: { timeBasedAggregation: true } });
//   console.log(notifications?.unwrap().items);
// });

export const lensWebhook = functions.https.onRequest(async (req, res) => {
  try {
    const data = lensWebhookInput.parse({
      key: req.body.key,
      publicationId: req.body.publicationId,
      profileId: req.body.profileId,
    });

    const apiUsersCollection =  admin.firestore().collection('apiUsers');
    const apiUsersSnapshot = await apiUsersCollection.where('key', '==', data.key).get();
    if (apiUsersSnapshot.docs.length == 0) {
        res.status(401).send("Unauthorized");
        return;
    }

    const profile = await lensClient.profile.fetch({ forProfileId: data.profileId })
    const handle = profile?.handle?.fullHandle
    const ownedBy = profile?.handle?.ownedBy

    console.log(`handle: ${handle}`);

    const publication = await lensClient.publication.fetch({ forId: data.publicationId });

    if (publication?.__typename !== 'Post') {
      res.sendStatus(200);
      return;
    }

    const pub = publication as PostFragment;
    if (pub.metadata.__typename !== 'ImageMetadataV3') {
      lensComment(data.publicationId, `I didn't see an image attached to your publication @${handle}, please retry a new publication with an image.`);
      res.sendStatus(200);
      return;
    }
    
    const meta = pub.metadata as ImageMetadataV3Fragment

    const brandName = await extractBrand(meta.content);

    if (brandName === null) {
      lensComment(data.publicationId, `We didn't find a clear brand or quest described in your publication @${handle}. Please retry your publication with more specific description of the brand or quest hashtag.`);
      console.log('Cannot extract brand name');
      res.sendStatus(200);
      return
    }

    const imageUrl = meta.asset.image.optimized?.uri!
    const brandValidation = await validateBrand(brandName, meta.content, meta.asset.image.optimized?.uri!);
    if (brandValidation === null) {
      lensComment(data.publicationId, `@${handle} the AI analysis of your description & image determined it to be "${brandValidation}" for a Proof. Please try again with a different image or description.`);
      res.sendStatus(200);
      return;
    }

    let questId = determineQuestId(brandName);
    const pubURL = `https://hey.xyz/posts/${data.publicationId}`;
    const hash = await eas_mint(handle!, ownedBy!, pubURL, imageUrl, meta.content, questId);

    lensComment(data.publicationId, `@${handle} your Proof:of ${brandName} afk Brussels Proof:of is minted! View the attestation: https://www.onceupon.gg/${hash} and view the leaderboard & gallery: proofof.bot/events/afk`);
  }  catch(error) {
    console.log(error);
  }
  res.sendStatus(200);
});

export const lensTestWebhook = functions.https.onRequest(async (req, res) => {
  res.sendStatus(200);
});

export const lensAuth = functions.https.onRequest(async (req, res) => {
  const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY!);
  const address = await wallet.getAddress();

  const { id, text } = await lensClient.authentication.generateChallenge({
    signedBy: address,
    for: PROFILE_ID,
  });
  const signature = await wallet.signMessage(text);
  await lensClient.authentication.authenticate({ id, signature });
  res.sendStatus(200);
});

const lensComment = async (on: string, text: string) => {
  let id = "";
  try {
    id = await createMetadata(text)
  } catch {
    id = await createMetadata(text)
  }

  try {
    console.log(`sending comment: https://gateway.irys.xyz/${id}`)
    await lensClient.publication.commentOnMomoka({ commentOn: on, contentURI: `https://gateway.irys.xyz/${id}` });
  } catch (e) {
    console.log("error commenting ", e);
  }
}

const createMetadata = async (text: string) => {
  const textMetadata = JSON.stringify(textOnly({ content: text }));
  const tx = await irys.upload(textMetadata, {
    tags: [{ name: "Content-Type", value: "application/json" }],
  });

  return tx.id;
}