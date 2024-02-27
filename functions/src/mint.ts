import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";
import * as admin from 'firebase-admin';

export async function eas_mint(username: string, attest_wallet: string, post_url: string, post_image_link: string, post_content: string, quest_id: string, category: string) {
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

    // Initialize SchemaEncoder with the schema string
    const schemaEncoder = new SchemaEncoder("bytes32 username,string postURL,string ipfsImageURL,string postContent,bytes32 questId");
    const encodedData = schemaEncoder.encodeData([
        { name: "username", value: username, type: "uint32" }, 
        { name: "postURL", value: post_url, type: "string" }, 
        { name: "ipfsImageURL", value: post_image_link, type: "string" }, //TODO change to NFT.Storage for image
        { name: "postContent", value: post_content, type: "string" },
        { name: "questId", value: quest_id, type: "bytes32" },
    ]);
    
    const SchemaUID = "0x7f9aaf2fd9e8fc1682d8240fef5464093a60f127cb3661c863c7c621ab69af02";    

    const tx = await eas.attest({
        schema: SchemaUID,
        data: {
            recipient: attest_wallet,
            revocable: true,
            data: encodedData
        },
    });

    let points = 0; // default value
    switch (category) {
        case 'general':
            points = 10;
            break;
        case 'merch':
            points = 5;
            break;
        case 'conference':
            points = 15;
            break;
        default:
            points = 5; // default value if none of the cases match
    }

    console.log(tx);
    const newAttestationUID = await tx.wait();
    console.log("New attestation UID:", newAttestationUID);
    console.log(tx.tx.hash)

    const db = admin.firestore();
    const proofRef = db.collection('Proof').doc(); 
    const userRef = db.collection('User').doc(); 

    await db.runTransaction(async (t: admin.firestore.Transaction) => {
        t.set(proofRef, {
            username: username,
            userWallet: attest_wallet,
            postURL: post_url,
            ipfsImageURL: post_image_link,
            postContent: post_content,
            points: points,
            attestationUID: newAttestationUID,
            transaction: tx.tx.hash
        });
        t.set(userRef, {
            attestWallet: attest_wallet,
            attestationUID: newAttestationUID
        });
    });

    return tx.tx.hash;
}