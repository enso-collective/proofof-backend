import * as functions from 'firebase-functions';
import OpenAI from 'openai';
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { eas_mint } from './mint'
// import { checkFarcasterUserState } from './farcasterUserState';

import {
    farcasterWebhookInput
  } from './schemes';
import { EmbeddedCast } from '@neynar/nodejs-sdk/build/neynar-api/v2';

const NEYNAR_API_KEY =  process.env.NEYNAR_API_KEY;
const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export const farcasterWebhook = functions.https.onRequest(async (req, res) => {
    const data = farcasterWebhookInput.parse({
        fid: req.body.data.author.fid,
        username: req.body.data.author.username,
        displayName: req.body.data.author.display_name,
        message: req.body.data.text,
        embedUrl: req.body.data.embeds?.at(0)?.url,
        hash: req.body.data.hash,
        wallet: req.body.data.author.verifications?.at(0),
    });

    console.log(data);

    if (data.wallet === undefined) {
        // reply in farcaster
        await farcasterPost(`Please add a verified wallet in your profile settings and retry this cast to mint a Proof`, data.hash)
        res.send({ success: false });
        return
    }

    if (data.embedUrl === undefined) {
        // reply in farcaster
        await farcasterPost(`I didn't see an image attached to your cast @${data.username}, please retry a new cast with an image.`, data.hash)
        res.send({ success: false });
        return
    }

    // if (false == await checkFarcasterUserState(data.fid)) {
    //     await farcasterPost(`@${data.username} you're out of validations for today. Please try again later.`, data.hash)
    //     res.send({ success: false });
    //     return;
    // }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

    // Extract brand name
    const extractBrandQuery = await openai.chat.completions.create({
        messages: [{ 
            role: 'assistant', 
            content: `A user supplied the a description which is meant to contain a brand name. Your job is to choose the primary brand they are describing. Note: there are some new brand names to learn: SheFi, Consensys, Mesh, Infura, Metamask. The brand name could be referred to by a mention using the @ decorator, such as @shefi or @nike. It could be in a hashtag, such as #happySheFi, or with a / in front such as /shefi` 
        }, 
        { 
            role: 'system', 
            content: `Return ONLY the brand name in plain text, or an empty response if no brands are mentioned` 
        }, 
        {
            role: 'user',
            content: `A user supplied the following description which is meant to contain a brand name. Your job is to choose the primary brand they are describing. If you are unsure, or if no brands are mentioned, then return an empty response. 

            User description: ${data.message}`
        }],
        model: 'gpt-4-0125-preview',
        max_tokens: 500
    });

    const brandName = extractBrandQuery.choices.at(0)?.message.content

    if (typeof brandName !== 'string' || (typeof brandName === 'string' && brandName.trim().length == 0)) {
        // reply in farcaster
        await farcasterPost(`We didn't find a clear brand described in your cast @${data.username}. Please retry your cast with more specific description of the brand.`, data.hash)
        console.log('cannot extract brand name')

        res.send({ success: false });
        return
    }

    // Validate brand
    const validateBrandQuery = await openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [{ 
            role: 'user', 
            content: [ 
                { type: 'text', text: `You are a decision-maker for a social company, where users submit an IMAGE with a DESCRIPTION. The DESCRIPTION must mention a BRAND "${brandName}" that they claim is visible in the IMAGE, and you decide whether the user's claim is true and therefore VALID or not true and so therefore NOT VALID .
                Here is the original user DESCRIPTION: "${data.message}" 
                
                For this image, think through what is the full list of every piece of clothing, apparel, visible signage, and items in the image. 
                Special brands to note: the SheFi brand has tie-dye bucket hats, beanies, and shirts, the Metamask brand logo has a cartoon image of a fox, the Infura brand logo has an black/orange japanese symbol, the Consensys brand logo has a small square outside of a circle, and the Mesh brand logo has 3 connected ovals.
                 
                After thinking of that, can you answer TRUE or FALSE to each of the two following questions: 
                1) Is the user's DESCRIPTION of the IMAGE generally correct, and without any false statements? For example, if they describe a swimsuit but the image contains a jacket, this would be FALSE. 
                2) Is the BRAND "${brandName}" visible and present in the image? 
                Note: If the brand name or logo is not directly visible or legible, but it could plausibly be correct based on the type of items/clothing, then trust the user and answer TRUE.
                
                Think step by step. If the answer to one or both questions is FALSE, then the claim is NOT VALID. If the answer to both questions is TRUE than the claim is VALID.
                Then, your response is one of the two options: Either say:
                1. "NOT VALID - [reason]"
                2. "VALID - [BRAND name] + [item]"
                Substitute the appropriate responses into the brackets. For [item] insert the item that displays or matches the BRAND.
                Respond with NOT VALID if the brand listed is definitely not in the image, because of [reason].
                
                EXAMPLES:
                If the image has DESCRIPTION of the brand Ray-Ban, and there are no sunglasses visible in the image, then respond "NOT VALID - no Ray-Ban sunglasses visible".
                If the image has the claim of the brand Ray-Ban, and there are sunglasses visible in the image but hard to tell what brand they are, which could be because there is no brand label visible or the item is small, then respond with "VALID - Ray-Ban, sunglasses".
                If the DESCRIPTION says a swimsuit but the image contains a jacket, this would be "NOT VALID - image does not match description".`},
                { type: 'image_url', image_url: { url: data.embedUrl! } }
            ],
        }]
    });

    const brandValidation = validateBrandQuery.choices.at(0)?.message.content
    if (typeof brandValidation !== 'string' || (typeof brandValidation === 'string' && brandValidation.includes('NOT VALID'))) {
        // reply in farcaster
        await farcasterPost(`@${data.username} we found a result of "${brandValidation}". Please try again with a different image or description.`, data.hash)
        res.send({ success: false});
        return
    }

    const hash = await eas_mint(data.hash, data.fid, data.wallet, data.message, data.embedUrl, brandName);

    await farcasterPost(`@${data.username} your ${brandName} Proof is minted! View the transaction on Base: https://www.onceupon.gg/${hash}`, data.hash, [{url: `https://www.onceupon.gg/${hash}`}])
    res.send({ success: true });
});

const farcasterPost = async (text: string, replyTo: string, embeds?: EmbeddedCast[]) => {
    const client = new NeynarAPIClient(NEYNAR_API_KEY!);
    await client.publishCast(NEYNAR_SIGNER_UUID!, text, {
        embeds: embeds,
        replyTo: replyTo
    });
}