import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";
import * as admin from 'firebase-admin';

export async function eas_mint_notes(username: string, attest_wallet: string, post_url: string, noteText: string, sentiment: string) {
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

    
    //const nftStorageKey = process.env.NFTSTORAGE_API_KEY (is stored on Cloud Function already)
    //const nftStorageURL = TODO upload image https://nft.storage/docs/client/js/#store---store-erc1155-nft-data
    const bytes32username = username.substring(0, 32);
    const bytes32sentiment = sentiment.substring(0, 32);
    // Initialize SchemaEncoder with the schema string
    const schemaEncoder = new SchemaEncoder("bytes32 username,string postURL,string noteText,bytes32 sentiment");
    const encodedData = schemaEncoder.encodeData([
        { name: "username", value: bytes32username, type: "bytes32" }, 
        { name: "postURL", value: post_url, type: "string" }, 
        { name: "noteText", value: noteText, type: "string" },
        { name: "sentiment", value: bytes32sentiment, type: "bytes32" },
    ]);
    
    const SchemaUID = "0x0919558fe0fb61e97098e5e788530e20e3aaec6bc01f81e65c916eaff27ad6a9";    

    const tx = await eas.attest({
        schema: SchemaUID,
        data: {
            recipient: attest_wallet,
            revocable: true,
            data: encodedData
        },
    });

    console.log(tx);
    const newAttestationUID = await tx.wait();
    console.log("New attestation UID:", newAttestationUID);
    console.log(tx.tx.hash)

    let points = 5;
    const db = admin.firestore();
    try {
        const proofRef = db.collection('NotesProof').doc(); 
        const userSnapshot = await db.collection('User').where('userWallet', '==', attest_wallet).get();

        if (userSnapshot.empty) {
            const newUserRef = db.collection('User').doc(); // Create a new document reference for the new user
            await db.runTransaction(async (t: admin.firestore.Transaction) => {
                t.set(proofRef, {
                    username: username,
                    userWallet: attest_wallet,
                    userWalletLower: attest_wallet.toLowerCase(),
                    postURL: post_url,
                    noteText: noteText,
                    timestamp: Date.now(),
                    attestationUID: newAttestationUID,
                    transaction: tx.tx.hash,
                    questId: sentiment,
                    image: true
                });
                t.set(newUserRef, {
                    proofs: admin.firestore.FieldValue.arrayUnion(proofRef.id),
                    userWallet: attest_wallet,
                    userWalletLower: attest_wallet.toLowerCase(),
                    attestationUID: admin.firestore.FieldValue.arrayUnion(newAttestationUID)
                }, { merge: true });
            });
    } else {
        // Found a user with the matching attest_wallet
        const userRef = userSnapshot.docs[0].ref;

        await db.runTransaction(async (t: admin.firestore.Transaction) => {
            t.set(proofRef, {
                username: username,
                userWallet: attest_wallet,
                userWalletLower: attest_wallet.toLowerCase(),
                postURL: post_url,
                noteText: noteText,
                timestamp: Date.now(),
                attestationUID: newAttestationUID,
                transaction: tx.tx.hash,
                questId: sentiment,
                image: true
            });
            t.set(userRef, {
                proofs: admin.firestore.FieldValue.arrayUnion(proofRef.id),
                attestationUID: admin.firestore.FieldValue.arrayUnion(newAttestationUID)
                }, { merge: true });
            });
        } 
    } catch (error) {
        console.error('Error writing to Firestore:', error);
    }
    return tx.tx.hash;
}