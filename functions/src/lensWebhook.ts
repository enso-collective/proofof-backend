import * as admin from 'firebase-admin';
import { LensClient, production, IStorageProvider, NotificationType, PostFragment, ImageMetadataV3Fragment } from "@lens-protocol/client";
import { ethers } from "ethers";
import * as functions from 'firebase-functions/v2';
import { lensWebhookInput } from './schemes';
import { validateBrand, extractBrand } from './aiValidations'
import { determineQuestId } from './ensoUtils'
import { eas_mint } from './mint'
import { textOnly } from '@lens-protocol/metadata'
import PinataSDK from '@pinata/sdk'

const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY as string;
const PROFILE_ID = process.env.PROFILE_ID;

let pinataClient = new PinataSDK({ pinataApiKey: '32f196b95bef76b93fc1', pinataSecretApiKey: '487b382ea6e3d464cdae8344aa849b9c82700f1670408245f9876013a664387a' });

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

    res.sendStatus(200);

    const profile = await lensClient.profile.fetch({ forProfileId: data.profileId })
    const handle = profile?.handle?.fullHandle
    const ownedBy = profile?.handle?.ownedBy

    const publication = await lensClient.publication.fetch({ forId: data.publicationId });

    if (publication?.__typename !== 'Post') {
      return;
    }

    const pub = publication as PostFragment;
    if (pub.metadata.__typename !== 'ImageMetadataV3') {
      lensComment(data.publicationId, `I didn't see an image attached to your cast @${handle}, please retry a new cast with an image.`);
      return;
    }
    
    const meta = pub.metadata as ImageMetadataV3Fragment

    const brandName = await extractBrand(meta.content);

    if (brandName === null) {
      lensComment(data.publicationId, `We didn't find a clear brand or quest described in your cast @${handle}. Please retry your publication with more specific description of the brand or quest hashtag.`);
      console.log('Cannot extract brand name');
      return
    }

    const imageUrl = meta.asset.image.optimized?.uri!
    const brandValidation = await validateBrand(brandName, meta.content, meta.asset.image.optimized?.uri!);
    if (brandValidation === null) {
      lensComment(data.publicationId, `@${handle} the AI analysis of your description & image determined it to be "${brandValidation}" for a Proof. Please try again with a different image or description.`);
      return;
    }

    let questId = determineQuestId(brandName);
    const pubURL = `https://hey.xyz/posts/${data.publicationId}`;
    const hash = await eas_mint(handle!, ownedBy!, pubURL, imageUrl, meta.content, questId);

    lensComment(data.publicationId, `@${handle} your ${brandName} Proof is minted! View the transaction on Base: https://www.onceupon.gg/${hash}`);
  }  catch(error) {
    console.log(error);
  }
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
  const textMetadata = textOnly({ content: text });
  const response = await pinataClient.pinJSONToIPFS(textMetadata);
  await lensCommentSend(on, `ipfs://${response.IpfsHash}`);
}

const lensCommentSend = async (on: string, uri: string) => {
  try {
    lensClient.publication.commentOnMomoka({ commentOn: on, contentURI: uri });
  } catch {
    setTimeout(async function() { await lensComment(on, uri); }, 10000);
  }
}