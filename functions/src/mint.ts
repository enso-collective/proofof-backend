import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";
import * as admin from 'firebase-admin';

export async function eas_mint(username: string, attest_wallet: string, post_url: string, post_image_link: string, post_content: string, quest_id: string) {

    let points = 100;
    const db = admin.firestore();

    try {
        const proofRef = db.collection('Proof').doc(); 
        const userSnapshot = await db.collection('User').where('userWallet', '==', attest_wallet).get();

        const proofData = {
            username: username,
            userWallet: attest_wallet,
            userWalletLower: attest_wallet.toLowerCase(),
            postURL: post_url,
            ipfsImageURL: post_image_link,
            postContent: post_content,
            pointValueLukso: points,
            timestamp: Date.now(),
            questId: quest_id,
            image: true
        };

        // Remove undefined values
        Object.keys(proofData).forEach(key => {
            if (proofData[key as keyof typeof proofData] === undefined) {
                delete proofData[key as keyof typeof proofData];
            }
        });

        if (userSnapshot.empty) {
            const newUserRef = db.collection('User').doc(); // Create a new document reference for the new user
            console.log("u- 3");
            await db.runTransaction(async (t: admin.firestore.Transaction) => {
                t.set(proofRef, proofData);
                t.set(newUserRef, {
                    proofs: admin.firestore.FieldValue.arrayUnion(proofRef.id),
                    userWallet: attest_wallet,
                    userWalletLower: attest_wallet.toLowerCase(),
                    pointValueLukso: admin.firestore.FieldValue.increment(points) // Increment the user's point value
                }, { merge: true });
            });
        } else {
            // Found a user with the matching attest_wallet
            const userRef = userSnapshot.docs[0].ref;
        
            console.log("u- 4");
            await db.runTransaction(async (t: admin.firestore.Transaction) => {
                t.set(proofRef, proofData);
                t.set(userRef, {
                    proofs: admin.firestore.FieldValue.arrayUnion(proofRef.id),
                    pointValueLukso: admin.firestore.FieldValue.increment(points) // Increment the user's point value
                }, { merge: true });
            });
        } 
    } catch (error) {
        console.error('Error writing to Firestore:', error);
    }
    return "FirebaseSave";
}