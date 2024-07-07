import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";
import * as admin from 'firebase-admin';

export async function poap_mint(attest_wallet: string, poap_id: string, poap_name: string) {
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
    const schemaEncoder = new SchemaEncoder("string poapName,bytes32 poapId");
    const encodedData = schemaEncoder.encodeData([
        { name: "poapName", value: poap_name, type: "string" }, 
        { name: "poapId", value: poap_id, type: "bytes32" }
    ]);
    console.log("encodeddata=", encodedData)
    
    const SchemaUID = "0x326d3cdd4aa05f0c47d6e33059435a50e735c88f2485cca6d0ebcb001e636a92";    

    const tx = await eas.attest({
        schema: SchemaUID,
        data: {
            recipient: attest_wallet,
            revocable: true,
            data: encodedData
        },
    });

    const points = 10;

    const newAttestationUID = await tx.wait();
    console.log("New attestation UID:", newAttestationUID);

    const db = admin.firestore();
    try {
        const proofRef = db.collection('Proof').doc(); 
        const userSnapshot = await db.collection('User').where('userWalletLower', '==', attest_wallet.toLowerCase()).get();

        if (userSnapshot.empty) {
            const newUserRef = db.collection('User').doc(); // Create a new document reference for the new user

            await db.runTransaction(async (t: admin.firestore.Transaction) => {
                t.set(proofRef, {
                    userWallet: attest_wallet,
                    userWalletLower: attest_wallet.toLowerCase(),
                    pointValue: points,
                    timestamp: Date.now(),
                    attestationUID: newAttestationUID,
                    transaction: tx.tx.hash,
                    poapId: poap_id,
                    poapName: poap_name,
                    image: false
                });
                t.set(newUserRef, {
                    proofs: admin.firestore.FieldValue.arrayUnion(proofRef.id),
                    userWallet: attest_wallet,
                    userWalletLower: attest_wallet.toLowerCase(),
                    attestationUID: admin.firestore.FieldValue.arrayUnion(newAttestationUID),
                    shefiPoints: admin.firestore.FieldValue.increment(points) // Increment the user's point value
                }, { merge: true });
            });
    } else {
        // Found a user with the matching attest_wallet
        const userRef = userSnapshot.docs[0].ref;
    
        await db.runTransaction(async (t: admin.firestore.Transaction) => {
            t.set(proofRef, {
                userWallet: attest_wallet,
                userWalletLower: attest_wallet.toLowerCase(),
                pointValue: points,
                timestamp: Date.now(),
                attestationUID: newAttestationUID,
                transaction: tx.tx.hash,
                poapId: poap_id,
                poapName: poap_name,
                image: false
            });
            t.set(userRef, {
                proofs: admin.firestore.FieldValue.arrayUnion(proofRef.id),
                attestationUID: admin.firestore.FieldValue.arrayUnion(newAttestationUID),
                shefiPoints: admin.firestore.FieldValue.increment(points) // Increment the user's point value
            }, { merge: true });
            });
        } 
    } catch (error) {
        console.error('Error writing to Firestore:', error);
    }
    return tx.tx.hash;
}