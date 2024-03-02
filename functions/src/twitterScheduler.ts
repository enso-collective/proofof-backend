import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Client, auth } from "twitter-api-sdk";
import { components } from "twitter-api-sdk/dist/gen/openapi-types";
import OpenAI from 'openai';
import { eas_mint } from './mint'
import * as admin from 'firebase-admin';

const TWITTER_API_KEY = process.env.TWITTER_API_KEY
const TWITTER_API_SECRET_KEY = process.env.TWITTER_API_SECRET_KEY
const TWITTER_API_BEARER_KEY = process.env.TWITTER_API_BEARER_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export const twitterScheduler = onSchedule('* * * * *', async (event) => {
    const twitterSettingsCollection = admin.firestore().collection('twitterSettings');

    await admin.firestore().runTransaction(async t => {
        const twitterSettings = await t.get(twitterSettingsCollection.doc('settings'));
        const token = twitterSettings.data()?.token;

        try {
            const authClient = new auth.OAuth2User({
                client_id: TWITTER_API_KEY!,
                client_secret: TWITTER_API_SECRET_KEY,
                callback: "http://127.0.0.1:3000/callback",
                scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
                token: token
            });
        
            if (authClient.isAccessTokenExpired()) {
                const newToken = await authClient.refreshAccessToken();
                await twitterSettingsCollection.doc('settings').set({ token: newToken.token });
            }
        } catch(error) {
            console.log(error);
        }
    });

    const twitterSettings =  await twitterSettingsCollection.doc('settings').get();
    const twitterSettingsData = twitterSettings.data();
    const lastMentionTweetId = twitterSettingsData?.lastMentionTweetid;
    const token = twitterSettingsData?.token;

    const authClient = new auth.OAuth2User({
        client_id: TWITTER_API_KEY!,
        client_secret: TWITTER_API_SECRET_KEY,
        callback: "http://127.0.0.1:3000/callback",
        scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
        token: token
    });

    try {
        const appClient = new Client(TWITTER_API_BEARER_KEY!);
        const userClient = new Client(authClient);

        const mentions = await appClient.tweets.usersIdMentions('1758104296208396288', { start_time: '2024-01-27T07:05:14.227Z', since_id: lastMentionTweetId, expansions: ['author_id', 'entities.mentions.username', 'attachments.media_keys'], 'media.fields': ['url', 'type', 'variants', 'preview_image_url'], 'user.fields': ['username', 'id', 'name'], 'tweet.fields': ['attachments', 'author_id', 'text', 'id'] });
        let newestId = mentions.meta?.newest_id;

        if (newestId !== undefined && twitterSettingsData === undefined) {
            const newTwitterSettings = {
                lastMentionTweetid: newestId
            };
            await twitterSettingsCollection.doc('settings').set(newTwitterSettings);
        } else if (newestId !== undefined) {
            await twitterSettings.ref.update({
                lastMentionTweetid: newestId
            });
        }

        const userCollection = admin.firestore().collection('User');

        const media = mentions.includes?.media ?? []
        const users = mentions.includes?.users ?? []

        mentions.data?.forEach(async element => {
            console.log(element);

            const user = users.find(x => x.id === element.author_id);
            const usersSnapshot = await userCollection.where('twitterUsername', '==', user?.username).get()
            console.log("username from twitter: ", user?.username)
            console.log("userSnapshot: ", usersSnapshot);
            if (usersSnapshot.empty) {
                userClient.tweets.createTweet({ text: `A connected wallet is required for your onchain Proof, please sign up on https://shefi.ensocollective.xyz and connect your Twitter`, reply: { in_reply_to_tweet_id: element.id } });
                return;
            }

            const wallet = usersSnapshot.docs![0].data().userWalletLower;

            const mediaKeys = element.attachments?.media_keys ?? [];
            const photo = media.find(x => mediaKeys.includes(x.media_key ?? '') && x.type === 'photo') as components['schemas']['Photo'];

            if (photo === undefined) {
                userClient.tweets.createTweet({ text: `I didn't see an image attached to your tweet @${user?.username}, please retry a new tweet with an image.`, reply: { in_reply_to_tweet_id: element.id } });
                return;
            }
            console.log(photo.url);
            const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

            // Extract brand name
            const extractBrandQuery = await openai.chat.completions.create({
                messages: [{ 
                    role: 'assistant', 
                    content: `A user supplied a text description of their image, which may contain either a brand name (usually a capitalized word) about an image attached, or describes a moment in their life they are taking a picture of for a "quest". Without seeing the image, your job is to choose the primary brand they are describing, or the quest they are completing. Note: there are some new brand names to learn: SheFi, Harpie, WalletConnect, Phaver, Linea, Capsule. The brand name could be referred to by a mention using the @ decorator, such as @shefi or @nike. It can never be @proofof. It could be in a hashtag, such as #happySheFi, or with a / in front such as /shefi. The brand is never described by @0xproofof`
                }, 
                { 
                    role: 'system', 
                    content: `A user supplied the a description which contains either a primary brand name about an image attached to the description, or describes a moment in their life they are taking a picture of for a "quest". Without seeing the image, your job is to choose the primary brand they are describing. Note: there are some new brand names to learn: SheFi, Consensys, Mesh, Infura, Metamask. The brand name could be referred to by a mention using the @ decorator, such as @shefi or @nike. It could be in a hashtag, such as #happySheFi, or with a / in front such as /shefi. Return ONLY the brand name in plain text, or an empty response if no brands are mentioned. The brand is never described by @0xproofof`
                },
                {
                    role: 'user',
                    content: `A user supplied the following description which is meant to contain a brand name. Your job is to choose the primary brand they are describing and return the name of it as BRAND. If the choice of brand is unsure then return an an empty response. If they say "[BRAND] at a [PLACE]" then choose the [BRAND]

                    User description: ${element.text}`
                }],
                model: 'gpt-4-0125-preview',
                max_tokens: 500
            });

            const brandName = extractBrandQuery.choices.at(0)?.message.content

            if (typeof brandName !== 'string' || (typeof brandName === 'string' && brandName.trim().length == 0)) {
                // reply in twitter
                userClient.tweets.createTweet({ text: `We didn't find a clear brand or quest described in your tweet @${user?.username}. Please retry your tweet with more specific description of the brand or the quest hashtag.`, reply: { in_reply_to_tweet_id: element.id } });
                console.log('cannot extract brand nam or quest')

                return;
            }

            // Validate brand
            const validateBrandQuery = await openai.chat.completions.create({
                model: 'gpt-4-vision-preview',
                messages: [{ 
                    role: 'user', 
                    content: [ 
                        { type: 'text', text: `You are a decision-maker for a social company, where users submit an IMAGE with a DESCRIPTION. The DESCRIPTION must mention a BRAND "${brandName}" that they claim is visible in the IMAGE, or a QUEST they are completing such as #photobooth. And you decide whether the user's claim is true and therefore VALID or not true and so therefore NOT VALID .
                        Here is the original user DESCRIPTION: "${element.text}" 
                        
                        For this image, think through what is the full list of every piece of clothing, apparel, visible signage, logos, and items in the image. 
                        Special brands to note: the SheFi brand has a logo that says SheFi and has products such as blue bucket hats, beanies, and shirts. The Linea brand does bracelets, and Paypal has beanies, Capsule has pens, Phaver has a black sweatshirt, WalletConnect has a water bottle and tote bags.
                        
                        You need to think whether you would answer TRUE or FALSE to each of the two following questions: 
                        1) Is the user's DESCRIPTION of the IMAGE generally correct, and without any false statements? For example, if they describe a swimsuit but the image contains a man in a business suit, this would be FALSE. 
                        2) Either is the BRAND "${brandName}" name or logo visible and present in the image, or is the QUEST "${brandName}" correct?
                        Note: If the brand name or logo is not directly visible or legible, but it could plausibly be correct based on the type of items/clothing, then trust the user and answer TRUE.
                        
                        Think step by step. If the answer to one or both questions is FALSE, then the claim is NOT VALID. If the answer to both questions is TRUE than the claim is VALID.
                        Then, your response is one of the two options: Either say:
                        1. "NOT VALID - [reason]"
                        2. "VALID - [BRAND/QUEST name]"
                        Substitute the appropriate responses into the brackets.
                        Respond with NOT VALID if the brand listed is definitely not in the image, because of [reason].
                        
                        EXAMPLES:
                        If the image has DESCRIPTION of the brand Ray-Ban, and there are no sunglasses visible in the image, then respond "NOT VALID - no Ray-Ban sunglasses visible".
                        If the image has the claim of the brand Ray-Ban, and there are sunglasses visible in the image but hard to tell what brand they are, which could be because there is no brand label visible or the item is small, then respond with "VALID - Ray-Ban, sunglasses".
                        If the DESCRIPTION says a swimsuit but the image contains a jacket, this would be "NOT VALID - image does not match description".`},
                        { type: 'image_url', image_url: { url: photo.url! } }
                    ],
                }]
            });

            const brandValidation = validateBrandQuery.choices.at(0)?.message.content
            if (typeof brandValidation !== 'string' || (typeof brandValidation === 'string' && brandValidation.includes('NOT VALID'))) {
                // reply in twitter
                userClient.tweets.createTweet({ text: `@${user?.username} the AI analysis of your description & image determined it to be "${brandValidation}" for a Proof. Please try again with a different image or description.`, reply: { in_reply_to_tweet_id: element.id } });
                return;
            }
            const questBrands = ["SheFi", "Linea", "Capsule", "Phaver", "WalletConnect", "Harpie", "Paypal", "PYUSD", "Enso", "Hyperlane", "Base", "photobooth", "newfriend", "shefipanel"];
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

            const tweetUrl = `https://twitter.com/${user?.username}/status/${newestId}`;
            const hash = await eas_mint(user?.username!, wallet, tweetUrl, photo.url!, element.text, questId);
            userClient.tweets.createTweet({ text: `@${user?.username} your ${brandName} Proof is minted! View the transaction on Base: https://www.onceupon.gg/${hash}`, reply: { in_reply_to_tweet_id: element.id } });
        });
    } catch(error) {
        console.log(error);
    }
});