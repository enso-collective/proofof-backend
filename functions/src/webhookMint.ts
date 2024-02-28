import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";
import * as admin from 'firebase-admin';

export async function webhook_mint(attest_wallet: string, company: string, quest: string, data: string[]) {
    //push to EAS either onchain or offchain. docs: https://docs.attest.sh/docs/tutorials/make-an-attestation
    const provider = ethers.getDefaultProvider(
        "base", {
            alchemy: process.env.ALCHEMY_KEY
        }
    );
    const privateKey = process.env.MINT_WALLET_PRIVATE_KEY
    if (!privateKey) {
        throw new Error('PRIVATE_KEY is not defined in the environment variables');
    }
    const signer = new ethers.Wallet(privateKey, provider);
    const eas = new EAS("0x4200000000000000000000000000000000000021"); //https://docs.attest.sh/docs/quick--start/contracts#base
    eas.connect(signer);

        // Initialize SchemaEncoder with the schema string
    const schemaEncoder = new SchemaEncoder("string company,string quest,string[] data");
    const encodedData = schemaEncoder.encodeData([
        { name: "company", value: company, type: "string" }, 
        { name: "quest", value: quest, type: "string" }, 
        { name: "data", value: data, type: "string[]" }
    ]);
    
    const SchemaUID = "0x2710384e4cd3a480f1daeb7418dd9449689413e26f146474f746d6e5b1d1f195";    

    const tx = await eas.attest({
        schema: SchemaUID,
        data: {
            recipient: attest_wallet,
            revocable: true,
            data: encodedData
        },
    });

    const points = 5;

    console.log(tx);
    const newAttestationUID = await tx.wait();
    console.log("New attestation UID:", newAttestationUID);
    console.log(tx.tx.hash)

    const db = admin.firestore();
    try {
        const proofRef = db.collection('Proof').doc(); 
        const userSnapshot = await db.collection('User').where('attestWallet', '==', attest_wallet).get();

        if (userSnapshot.empty) {
            const newUserRef = db.collection('User').doc(); // Create a new document reference for the new user

            await db.runTransaction(async (t: admin.firestore.Transaction) => {
                t.set(proofRef, {
                    company: company,
                    userWallet: attest_wallet,
                    quest: quest,
                    data: data,
                    pointValue: points,
                    timestamp: Date.now(),
                    attestationUID: newAttestationUID,
                    transactionHash: tx.tx.hash,
                    image: false
                });
                t.set(newUserRef, {
                    proofs: admin.firestore.FieldValue.arrayUnion(proofRef.id),
                    userWallet: attest_wallet,
                    attestationUID: admin.firestore.FieldValue.arrayUnion(newAttestationUID),
                    points: admin.firestore.FieldValue.increment(points) // Increment the user's point value
                }, { merge: true });
            });
    } else {
        // Found a user with the matching attest_wallet
        const userRef = userSnapshot.docs[0].ref;
    
        await db.runTransaction(async (t: admin.firestore.Transaction) => {
            t.set(proofRef, {
                company: company,
                userWallet: attest_wallet,
                quest: quest,
                data: data,
                pointValue: points,
                timestamp: Date.now(),
                attestationUID: newAttestationUID,
                transaction: tx.tx.hash,
                image: false
            });
            t.set(userRef, {
                proofs: admin.firestore.FieldValue.arrayUnion(proofRef.id),
                attestationUID: admin.firestore.FieldValue.arrayUnion(newAttestationUID),
                points: admin.firestore.FieldValue.increment(points) // Increment the user's point value
                }, { merge: true });
            });
        } 
    } catch (error) {
        console.error('Error writing to Firestore:', error);
    }
    return tx.tx.hash;
}