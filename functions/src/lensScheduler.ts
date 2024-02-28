import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { LensClient, production, IStorageProvider, NotificationType } from "@lens-protocol/client";
import { ethers } from "ethers";
import * as functions from 'firebase-functions';

class FirebaseLensStorageProvider implements IStorageProvider {
  readonly collection = admin.firestore().collection('lensAuth');

  async getItem(key: string) {
    const auth = await this.collection.doc('auth').get();
    return auth.data()?.token
  }

  async setItem(key: string, value: string) {
    const auth = this.collection.doc('auth');
    console.log({ key: value });
    await auth.update({ token: value });
  }

  async removeItem(key: string) {
    const auth = this.collection.doc('auth');
    console.log({ token: 'DELETE' });
    await auth.update({ key: admin.firestore.FieldValue.delete() });
  }
}

const lensClient = new LensClient({
  environment: production,
  storage: new FirebaseLensStorageProvider(),
});

export const lensScheduler = onSchedule('* * * * *', async (event) => {
  const notifications = await lensClient.notifications.fetch({ where: { timeBasedAggregation: true } });
  console.log(notifications?.unwrap().items);
});

export const lensAuth = functions.https.onRequest(async (req, res) => {
  const wallet = new ethers.Wallet('');
  const address = await wallet.getAddress();

  const { id, text } = await lensClient.authentication.generateChallenge({
    signedBy: address,
    for: '0x020CF6',
  });
  const signature = await wallet.signMessage(text);
  await lensClient.authentication.authenticate({ id, signature });
  res.send(200);
});