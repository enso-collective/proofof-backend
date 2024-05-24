import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Client, auth } from "twitter-api-sdk";
import { components } from "twitter-api-sdk/dist/gen/openapi-types";
import { eas_mint } from './mint'
import { validateBrand, extractBrand } from './aiValidations'
import { determineQuestId } from './ensoUtils'
import * as admin from 'firebase-admin';

const TWITTER_API_KEY = process.env.TWITTER_API_KEY
const TWITTER_API_SECRET_KEY = process.env.TWITTER_API_SECRET_KEY
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
        const lastLukosMentionId = twitterSettingsData?.lastLukosMentionId;
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

        type MentionData = {
            id: string;
            text: string;
            author_id: string;
            referenced_tweets?: { id: string; type: "retweeted" | "quoted" | "replied_to" }[];
            attachments?: { media_keys: string[] };
            edit_history_tweet_ids: string[];
        };

        const mentions = await appClient.tweets.usersIdMentions('1758104296208396288', {
            start_time: '2024-01-27T07:05:14.227Z',
            since_id: lastMentionTweetId,
            expansions: ['author_id', 'entities.mentions.username', 'attachments.media_keys', 'in_reply_to_user_id', 'referenced_tweets.id'],
            'media.fields': ['url', 'type', 'variants', 'preview_image_url'],
            'user.fields': ['username', 'id', 'name'],
            'tweet.fields': ['attachments', 'author_id', 'text', 'id', 'in_reply_to_user_id']
        });

        const hashtagMentions = await appClient.tweets.tweetsRecentSearch({
            query: '#ProofofLUKSO',
            since_id: lastLukosMentionId,
            expansions: ['author_id', 'entities.mentions.username', 'attachments.media_keys', 'in_reply_to_user_id', 'referenced_tweets.id'],
            'media.fields': ['url', 'type', 'variants', 'preview_image_url'],
            'user.fields': ['username', 'id', 'name'],
            'tweet.fields': ['attachments', 'author_id', 'text', 'id', 'in_reply_to_user_id']
        });

        const processMentions = async (mentionsData: MentionData[], newestId: string | undefined, lastMentionId: string | undefined, mentionType: string) => {
            if (newestId !== lastMentionId) {
                if (newestId !== undefined) {
                    await twitterSettingsCollection.doc('settings').set({ [mentionType]: newestId }, { merge: true });
                }

                const tweetsCollection = admin.firestore().collection('PossibleMention');
                const userCollection = admin.firestore().collection('User');

                const media = mentions.includes?.media ?? [];
                const users = mentions.includes?.users ?? [];

                mentionsData?.forEach(async element => {
                    if (element.referenced_tweets != null) { return; }
                    
                    const user = users.find(x => x.id === element.author_id);
                    const username = user?.username;

                    if (!username) {
                        console.log('Username is undefined, skipping this mention.');
                        return;
                    }

                    console.log(`username: ${username}`);
                    const usersSnapshot = await userCollection.where('twitterUsername', '==', username).get();

                    await tweetsCollection.add({ username: username, data: element });

                    if (usersSnapshot.empty) {
                        return;
                    }

                    const wallet = usersSnapshot.docs![0].data().userWalletLower;
                    const brandName = await extractBrand(element.text);

                    if (brandName === null) {
                        await userClient.tweets.createTweet({ text: `We didn't find a clear brand or quest described in your tweet @${username}. Please retry your tweet with more specific description of the brand or the quest hashtag.`, reply: { in_reply_to_tweet_id: element.id } });
                        return;
                    }

                    const mediaKeys = element.attachments?.media_keys ?? [];
                    const photo = media.find(x => mediaKeys.includes(x.media_key ?? '') && x.type === 'photo') as components['schemas']['Photo'];

                    if (photo === undefined && brandName !== 'LUKSO') {
                        await userClient.tweets.createTweet({ text: `I didn't see an image attached to your tweet @${username}, please retry a new tweet with an image.`, reply: { in_reply_to_tweet_id: element.id } });
                        return;
                    }
                    
                    const brandValidation = await validateBrand(brandName, element.text, photo.url!);
                    if (brandValidation === null) {
                        await userClient.tweets.createTweet({ text: `@${username} the AI analysis of your description & image determined it to be "${brandValidation}" for a Proof. Please try again with a different image or description.`, reply: { in_reply_to_tweet_id: element.id } });
                        return;
                    }

                    let questId = determineQuestId(brandName);

                    const tweetUrl = `https://twitter.com/${username}/status/${newestId}`;
                    const hash = await eas_mint(username, wallet, tweetUrl, photo.url!, element.text, questId);
                    await userClient.tweets.createTweet({ text: `@${username} your ${brandName} Proof is created! Create your Universal Profile, connect your Twitter, and view your attestations and leaderboard on https://www.proofof.bot/events/lukso`, reply: { in_reply_to_tweet_id: element.id } }); 
                });
            }
        };

        const newestMentionId = mentions.meta?.newest_id;
        const newestHashtagMentionId = hashtagMentions.meta?.newest_id;
        
        const validMentions = (mentions.data ?? []).filter((mention): mention is MentionData => mention.author_id !== undefined);
        const validHashtagMentions = (hashtagMentions.data ?? []).filter((mention): mention is MentionData => mention.author_id !== undefined);

        await processMentions(validMentions, newestMentionId, lastMentionTweetId, 'lastMentionTweetid');
        await processMentions(validHashtagMentions, newestHashtagMentionId, lastLukosMentionId, 'lastLukosMentionId');
    } catch (error) {
        console.error('Error processing Twitter mentions:', error);
    }
});