import * as functions from 'firebase-functions';
import OpenAI from 'openai';
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { eas_mint } from './mint'
// import { checkFarcasterUserState } from './farcasterUserState';

import {
    farcasterWebhookInput
  } from './schemes';
import { EmbeddedCast } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { Embeddings } from 'openai/resources';

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
        wallet: req.body.data.author.verifications?.at(0), //TODO add check for Solana wallet
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
            content: `A user supplied the a description which contains a primary brand name about an image attached to the description. Without seeing the image, your job is to choose the primary brand they are describing. Note: there are some new brand names to learn: SheFi, Consensys, Mesh, Infura, Metamask. The brand name could be referred to by a mention using the @ decorator, such as @shefi or @nike. It could be in a hashtag, such as #happySheFi, or with a / in front such as /shefi` 
        }, 
        { 
            role: 'system', 
            content: `A user supplied the a description which contains a primary brand name about an image attached to the description. Without seeing the image, your job is to choose the primary brand they are describing. Note: there are some new brand names to learn: SheFi, Consensys, Mesh, Infura, Metamask. The brand name could be referred to by a mention using the @ decorator, such as @shefi or @nike. It could be in a hashtag, such as #happySheFi, or with a / in front such as /shefi. Return ONLY the brand name in plain text, or an empty response if no brands are mentioned. ` 
        }, 
        {
            role: 'user',
            content: `A user supplied the following description which is meant to contain a brand name. Your job is to choose the primary brand they are describing. If no brands are mentioned, then return an empty response. If they say "[Brand] at the SheFi Summit" then choose the [Brand].

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
                { type: 'text', text: `You are a decision-maker for a social company, where users submit an IMAGE with a DESCRIPTION. The DESCRIPTION may mention a BRAND "${brandName}" that they claim is visible in the IMAGE, and you decide whether the user's claim is true and therefore VALID or not true and so therefore NOT VALID. You may not recognize the Brand name or the logos, as they are very new. 
                Here is the original user DESCRIPTION: "${data.message}" 
                
                For this image, think through what is the full list of every piece of clothing, apparel, visible signage, logos, and items in the image. 
                Special brands to note: the SheFi brand has a logo that says SheFi and has products such as blue bucket hats, beanies, and shirts. The Linea brand does bracelets, and Paypal has beanies, Capsule has pens, Phaver has a black sweatshirt, WalletConnect has a water bottle and tote bags.
                
                You need to think whether you would answer TRUE or FALSE to each of the two following questions: 
                1) Is the user's DESCRIPTION of the IMAGE generally correct, and without any false statements? For example, if they describe a swimsuit but the image contains a man in a business suit, this would be FALSE. 
                2) Is the BRAND "${brandName}" name or logo visible and present in the image? 
                Note: If the brand name or logo is not directly visible or legible, but it could plausibly be correct based on the type of items/clothing, then trust the user and answer TRUE.
                
                Think step by step. If the answer to one or both questions is FALSE, then the claim is NOT VALID. If the answer to both questions is TRUE than the claim is VALID.
                Then, your response is one of the two options: Either say:
                1. "NOT VALID - [reason]"
                2. "VALID - [BRAND name]"
                Substitute the appropriate responses into the brackets. 
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
        await farcasterPost(`@${data.username} the AI analysis of your description & image determined it to be "${brandValidation}" for a Proof. Please try again with a different image or description.`, data.hash)
        res.send({ success: false});
        return
    }
    const questBrands = ["SheFi", "Linea", "Capsule", "Phaver", "WalletConnect", "Harpie", "Paypal", "PYUSD", "Enso", "Hyperlane", "Base"];
    let questId;
    const brandNameLower = brandName.toLowerCase();

    if (questBrands.map(brand => brand.toLowerCase()).includes(brandNameLower)) {
        if (brandNameLower === "paypal") {
            questId = "pyusd";
        } else {
            questId = brandNameLower;
        }
    } else {
        questId = "general";
    }

    const castURL = `https://warpcast.com/${data.username}/0x${data.hash.substring(2, 10)}`;
    const hash = await eas_mint(data.username, data.wallet, castURL, data.embedUrl, data.message, questId);

    await farcasterPost(`@${data.username} your ${brandName} Proof is minted! View the transaction on Base: https://www.onceupon.gg/${hash}`, data.hash, [{url: `https://www.onceupon.gg/${hash}`}])
    res.send({ success: true });
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