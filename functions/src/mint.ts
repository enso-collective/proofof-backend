import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";
import * as admin from 'firebase-admin';

export async function eas_mint(username: string, attest_wallet: string, post_url: string, post_image_link: string, post_content: string, quest_id: string) {
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
    const eas = new EAS("0x4200000000000000000000000000000000000021"); // connects to Base
    eas.connect(signer);


    const bytes32username = username.substring(0, 32);
    const bytes32quest = quest_id.substring(0, 32);;
    // Initialize SchemaEncoder with the schema string
    const schemaEncoder = new SchemaEncoder("bytes32 username,string postURL,string ipfsImageURL,string postContent,bytes32 questId");
    const encodedData = schemaEncoder.encodeData([
        { name: "username", value: bytes32username, type: "bytes32" }, 
        { name: "postURL", value: post_url, type: "string" }, 
        { name: "ipfsImageURL", value: post_image_link, type: "string" }, //TODO change to NFT.Storage for image
        { name: "postContent", value: post_content, type: "string" },
        { name: "questId", value: bytes32quest, type: "bytes32" },
    ]);
    // BASE schemaUID
    const SchemaUID = "0x7f9aaf2fd9e8fc1682d8240fef5464093a60f127cb3661c863c7c621ab69af02";    

    // const tx = await eas.attest({
    //     schema: SchemaUID,
    //     data: {
    //         recipient: attest_wallet,
    //         revocable: true,
    //         data: encodedData
    //     },
    // });

    // const newAttestationUID = await tx.wait();
    // console.log("New attestation UID:", newAttestationUID);
    // console.log(tx.tx.hash)

    let points = 100;
    const db = admin.firestore();

    try {
        const proofRef = db.collection('Proof').doc(); 
        const userSnapshot = await db.collection('User').where('userWallet', '==', attest_wallet).get();

        const incrementBuildersPoints = (quest_id === "thebuildersdao" || quest_id === "nox");

        if (userSnapshot.empty) {
            const newUserRef = db.collection('User').doc(); // Create a new document reference for the new user
            console.log("u- 3");
            await db.runTransaction(async (t: admin.firestore.Transaction) => {
                t.set(proofRef, {
                    username: username,
                    userWallet: attest_wallet,
                    userWalletLower: attest_wallet.toLowerCase(),
                    postURL: post_url,
                    ipfsImageURL: post_image_link,
                    postContent: post_content,
                    pointValue: points,
                    timestamp: Date.now(),
                    //attestationUID: newAttestationUID,
                    //transaction: tx.tx.hash,
                    questId: quest_id,
                    image: true
                });
                const newUserData: any = {
                    proofs: admin.firestore.FieldValue.arrayUnion(proofRef.id),
                    userWallet: attest_wallet,
                    userWalletLower: attest_wallet.toLowerCase(),
                    //attestationUID: admin.firestore.FieldValue.arrayUnion(newAttestationUID),
                    points: admin.firestore.FieldValue.increment(points) // Increment the user's point value
                };
                if (incrementBuildersPoints) {
                    newUserData.buildersPoints = admin.firestore.FieldValue.increment(points);
                }
                t.set(newUserRef, newUserData, { merge: true });
            });
    } else {
        // Found a user with the matching attest_wallet
        const userRef = userSnapshot.docs[0].ref;
    
        console.log("u- 4");
        await db.runTransaction(async (t: admin.firestore.Transaction) => {
            t.set(proofRef, {
                username: username,
                userWallet: attest_wallet,
                userWalletLower: attest_wallet.toLowerCase(),
                postURL: post_url,
                ipfsImageURL: post_image_link,
                postContent: post_content,
                pointValue: points,
                timestamp: Date.now(),
                //attestationUID: newAttestationUID,
                //transaction: tx.tx.hash,
                questId: quest_id,
                image: true
            });
            const userData: any = {
                proofs: admin.firestore.FieldValue.arrayUnion(proofRef.id),
                //attestationUID: admin.firestore.FieldValue.arrayUnion(newAttestationUID),
                points: admin.firestore.FieldValue.increment(points) // Increment the user's point value
            };
            if (incrementBuildersPoints) {
                userData.buildersPoints = admin.firestore.FieldValue.increment(points);
            }
            t.set(userRef, userData, { merge: true });
            });

        } 
    } catch (error) {
        console.error('Error writing to Firestore:', error);
    }
return tx.tx.hash;
}