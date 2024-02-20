import * as admin from 'firebase-admin';

export const checkFarcasterUserState = async (fid: string) => {
    try {
        const farcasterUserStateCollection =  admin.firestore().collection('farcasterUserState');
        const farcasterUserStateSnapshot = await farcasterUserStateCollection.where('fid', '==', fid).get();

        if (!farcasterUserStateSnapshot.empty) {
            const stateDoc = farcasterUserStateSnapshot.docs[0];
            const now = new Date();
            const lastAccess = stateDoc.data().lastAccess.toDate();

            const timePassed = (Math.abs(now.valueOf() - lastAccess.valueOf()) / 36e5) > 24;
            if (!timePassed && stateDoc.data().count > 2) {
                return false;
            }

            await stateDoc.ref.update({
                lastAccess: admin.firestore.Timestamp.fromDate(new Date()),
                count: timePassed ? 1 : stateDoc.data().count + 1,
            });

            return true;
        }

        const userState = {
            fid: fid,
            lastAccess: admin.firestore.Timestamp.fromDate(new Date()),
            count: 1,
          };
          await farcasterUserStateCollection.doc(fid).set(userState);
          return true;
    } catch (error) {
        console.error(error);
        return false
    }
};