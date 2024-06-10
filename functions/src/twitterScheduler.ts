import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Client, auth } from "twitter-api-sdk";
import { components } from "twitter-api-sdk/dist/gen/openapi-types";
import { eas_mint } from './mint'
import { validateBrand, extractBrand } from './aiValidations'
import { determineQuestId } from './ensoUtils'
import * as admin from 'firebase-admin';

const TWITTER_API_KEY = process.env.TWITTER_API_KEY // client id
const TWITTER_API_SECRET_KEY = process.env.TWITTER_API_SECRET_KEY // client secret
const TWITTER_API_BEARER_KEY = process.env.TWITTER_API_BEARER_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export const twitterScheduler = onSchedule('* * * * *', async (event) => {
    try {
        const twitterSettingsCollection = admin.firestore().collection('twitterSettings');

        await admin.firestore().runTransaction(async t => {
            const twitterSettings = await t.get(twitterSettingsCollection.doc('settings'));
            const token = twitterSettings.data()?.token;
                const authClient = new auth.OAuth2User({
                    client_id: TWITTER_API_KEY!,
                    client_secret: TWITTER_API_SECRET_KEY,
                    callback: "http://127.0.0.1:3000/callback",
                    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
                    token: token
                });
            
                if (authClient.isAccessTokenExpired()) {
                    const newToken = await authClient.refreshAccessToken();
                    await twitterSettingsCollection.doc('settings').set({ token: newToken.token }, { merge: true });
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
    
        const appClient = new Client(TWITTER_API_BEARER_KEY!);
        const userClient = new Client(authClient);

        const mentions = await appClient.tweets.usersIdMentions('1758104296208396288', { start_time: '2024-01-27T07:05:14.227Z', since_id: lastMentionTweetId, expansions: ['author_id', 'entities.mentions.username', 'attachments.media_keys', 'in_reply_to_user_id', 'referenced_tweets.id'], 'media.fields': ['url', 'type', 'variants', 'preview_image_url'], 'user.fields': ['username', 'id', 'name'], 'tweet.fields': ['attachments', 'author_id', 'text', 'id', 'in_reply_to_user_id'] });
        let newestId = mentions.meta?.newest_id;


        if (newestId !== lastMentionTweetId) {
            if (newestId !== undefined) {
                await twitterSettingsCollection.doc('settings').set({ lastMentionTweetid: newestId }, { merge: true });
            }
    
            const userCollection = admin.firestore().collection('User');
    
            const media = mentions.includes?.media ?? []
            const users = mentions.includes?.users ?? []
    
            mentions.data?.forEach(async element => {
                if (element.referenced_tweets != null) { return; }
                
                const user = users.find(x => x.id === element.author_id);
                console.log(`username: ${user?.username}`);
                const usersSnapshot = await userCollection.where('twitterUsername', '==', user?.username).get()
    
                if (usersSnapshot.empty) {
                    await userClient.tweets.createTweet({ text: `A connected wallet is required for your onchain Proof, please login on https://proofof.bot and connect your Twitter`, reply: { in_reply_to_tweet_id: element.id } });
                    return;
                }
    
                const wallet = usersSnapshot.docs![0].data().userWalletLower;
    
    
                const brandName = await extractBrand(element.text);
    
                if (brandName === null) {
                    await userClient.tweets.createTweet({ text: `We didn't find a clear brand or quest described in your tweet @${user?.username}. Please rewrite your tweet with more specific description of the brand.`, reply: { in_reply_to_tweet_id: element.id } });
    
                    return;
                }
    
                const mediaKeys = element.attachments?.media_keys ?? [];
                const photo = media.find(x => mediaKeys.includes(x.media_key ?? '') && x.type === 'photo') as components['schemas']['Photo'];
    
                if (photo === undefined && brandName !== 'LUKSO') {
                    await userClient.tweets.createTweet({ text: `I didn't see an image attached to your tweet @${user?.username}, please retry a new tweet with a photo.`, reply: { in_reply_to_tweet_id: element.id } });
                    return;
                }
                
                const brandValidation = await validateBrand(brandName, element.text, photo.url!);
                if (brandValidation === null) {
                    await userClient.tweets.createTweet({ text: `@${user?.username} the AI analysis of your description & image determined it to be "${brandValidation}" for a Proof:of. Please try again with a different image or description.`, reply: { in_reply_to_tweet_id: element.id } });
                    return;
                }
    
                let questId = determineQuestId(brandName);
    
                const tweetUrl = `https://twitter.com/${user?.username}/status/${newestId}`;
                console.log('creating mint for wallet and questId: ', wallet, ' ', questId)
                const hash = await eas_mint(user?.username!, wallet, tweetUrl, photo.url!, element.text, questId);
                console.log("creating tweet now")
                await userClient.tweets.createTweet({ text: `@${user?.username} your Proof:of ${brandName} is now onchain! View the transaction on Base: https://www.onceupon.gg/${hash}`, reply: { in_reply_to_tweet_id: element.id } }); 

            });
        }
    } catch(error) {
        console.log(error);
    }
});