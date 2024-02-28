import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { poap_mint } from './poapMint'
import { poapInput } from './schemes';
import { init, fetchQueryWithPagination } from "@airstack/node";


// airstack input always takes a graphQL query for a list of addresses and mints an EAS to them

export const attest_poap = functions.https.onRequest(async (req, res) => {
    try {
        const poapData = poapInput.parse({
            key: req.body.key,
            poap_id: req.body.id,
            poap_name: req.body.name
        });
        console.log(poapData);


        const apiUsersCollection =  admin.firestore().collection('apiUsers');
        const apiUsersSnapshot = await apiUsersCollection.where('key', '==', poapData.key).get();
        if (apiUsersSnapshot.docs.length == 0) {
            res.status(401).send("Unauthorized");
        }

    await fetchDataAndMint();

    async function fetchDataAndMint() {
        const query = `
                query PoapWallets($eventId: String!) {
                    Poaps(
                        input: {
                            filter: { eventId: { _in: [$eventId] } }
                            blockchain: ALL
                            limit: 200
                            }
                    ) {
                    Poap {
                        owner {
                            addresses
                        }
                    }
                    pageInfo {
                        nextCursor
                        prevCursor
                        }
                    }
                }
                `;
        let variables = {
            eventId: poapData.poap_id,
            first: 200, // Number of items to fetch per page
            after: null // Cursor for the next page
        };
    init("37cc3dd12e72487abefbe8d7bdd57b2e", "prod");
    let result = await fetchQueryWithPagination(query, variables);
    
        while (result.hasNextPage) {
            console.log(result.data); // Process the data
            for (const edge of result.data.Poaps.edges) {
                const userWallet = edge.node.address;
                
                //check if wallet already has EAS for the poapID
                const db = admin.firestore();
                const userSnapshot = await db.collection('User').where('attestWallet', '==', userWallet).get();
                if (!userSnapshot.empty) {
                    // Found a user with the matching attest_wallet
                    const userDoc = userSnapshot.docs[0];
                    const userData = userDoc.data();

                    if (userData.poapId && userData.poapId.includes(poapData.poap_id)) {
                        // The user already has the poapId
                        console.log(`User ${userWallet} already has poapId ${poapData.poap_id}`);
                    } else {
                        await poap_mint(userWallet, poapData.poap_id, poapData.poap_name);
                        console.log("minting to: ", userWallet);
                    }
                } else {
                    // new user wallet so can mint
                    await poap_mint(userWallet, poapData.poap_id, poapData.poap_name);
                    console.log("minting to: ", userWallet);
                }
            }

            // Fetch the next page
            const nextPage = await result.getNextPage();
            if (nextPage !== null) {
                result = nextPage;
            } else {
                break;
                }
        }
    }
    res.json({ success: true });

    } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred while processing your request.");
    }
});