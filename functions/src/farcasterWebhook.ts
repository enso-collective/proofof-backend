import * as functions from 'firebase-functions';
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { eas_mint } from './mint'
import { validateBrand, extractBrand } from './aiValidations'
import { determineQuestId } from './ensoUtils'
// import { checkFarcasterUserState } from './farcasterUserState';

import {
    farcasterWebhookInput
  } from './schemes';
import { EmbeddedCast } from '@neynar/nodejs-sdk/build/neynar-api/v2';

const NEYNAR_API_KEY =  process.env.NEYNAR_API_KEY;
const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;

export const farcasterWebhook = functions.https.onRequest(async (req, res) => {
    res.send({ success: true });
    try {
        const data = farcasterWebhookInput.parse({
            fid: req.body.data.author.fid,
            username: req.body.data.author.username,
            displayName: req.body.data.author.display_name,
            message: req.body.data.text,
            embedUrl: req.body.data.embeds?.at(0)?.url,
            hash: req.body.data.hash,
            wallet: req.body.data.author.verifications?.at(0), //TODO add check for Solana wallet
        });

        console.log(data);

        if (data.wallet === undefined) {
            // reply in farcaster
            await farcasterPost(`Please add a verified wallet in your profile settings and retry this cast to mint a Proof:of attestation`, data.hash)
            return
        }

        if (data.embedUrl === undefined) {
            // reply in farcaster
            await farcasterPost(`We didn't see an image attached to your cast @${data.username}, please retry a new cast with your photo/image.`, data.hash)
            return
        }

        // if (false == await checkFarcasterUserState(data.fid)) {
        //     await farcasterPost(`@${data.username} you're out of validations for today. Please try again later.`, data.hash)
        //     res.send({ success: false });
        //     return;
        // }

        const brandName = await extractBrand(data.message);

        if (brandName === null) {
            // reply in farcaster
            await farcasterPost(`We didn't find a clear brand or quest described in your cast @${data.username}. Please retry your cast with more specific description of the brand or quest hashtag.`, data.hash);
            console.log('cannot extract brand name from text description');
            return
        }

        const brandValidation = await validateBrand(brandName, data.message, data.embedUrl!);
        if (brandValidation === null) {
            // reply in farcaster
            await farcasterPost(`@${data.username} the AI analysis of your description & image determined it to be "${brandValidation}" for a Proof. Please try again with a different image or description.`, data.hash);
            console.log('AI image analysis determined it was: ', brandValidation);
            res.send({ success: false});
            return
        }
        
        let questId = determineQuestId(brandName);
        const castURL = `https://warpcast.com/${data.username}/0x${data.hash.substring(2, 10)}`;
        const hash = await eas_mint(data.username, data.wallet, castURL, data.embedUrl, data.message, questId);

        await farcasterPost(`@${data.username} your Proof:of:${brandName} is created onchain! View the transaction on Base: https://www.onceupon.gg/${hash}`, data.hash, [{url: `https://www.onceupon.gg/${hash}`}]);
    }  catch(error) {
        console.log(error);
    }
});

const farcasterPost = async (text: string, replyTo: string, embeds?: EmbeddedCast[]) => {
    try {
        const client = new NeynarAPIClient(NEYNAR_API_KEY!);
        await client.publishCast(NEYNAR_SIGNER_UUID!, text, {
            embeds: embeds,
            replyTo: replyTo
        });
    } catch(error) {
        console.log(error);
    }
}