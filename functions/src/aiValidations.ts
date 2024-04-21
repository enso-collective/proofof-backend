import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function extractBrand(message: string) {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const extractBrandQuery = await openai.chat.completions.create({
        messages: [{ 
            role: 'assistant', 
            content: `A user supplied an image plus text content, which may contain a primary brand name about the image , or describe a moment in their life they are taking a picture of. Without seeing the image, your job is to choose the primary brand they are describing. It may be a short word, such as "SheFi" or "Unlonely", which is ok. Note: there are some new brand names to learn: SheFi, Consensys, Mesh, Infura, Metamask. It is likely that if a word is capitalized it is the Brand name. The brand name could be referred to by a mention using the @ decorator, such as @shefi or @nike (describing the shefi brand or nike brand). It could be in a hashtag, such as #happySheFi, or with a / in front such as /shefi. The brand is never described by @proofof` 
        }, 
        { 
            role: 'system', 
            content: `A user supplied an image plus text content, which may contain a primary brand name about the image. Without seeing the image, your job is to choose the primary brand they are describing. It may be a short word, such as "SheFi" or "Intuition", which is ok. Note: there are some new brand names to learn: SheFi, Unlonely, Consensys, Mesh, Infura, Metamask.  It is likely that if a word is capitalized it is a brand name. The brand name could be referred to by a mention using the @ decorator, such as @shefi or @nike (describing the shefi brand or nike brand). It could be in a hashtag, such as #happySheFi, or with a / in front such as /shefi. Return ONLY the brand name in plain text, or an empty response if no brands are mentioned. The brand is never described by @proofof` 
        }, 
        {
            role: 'user',
            content: `A user supplied the following description which is meant to contain a brand name. Your job is to choose the primary brand they are describing and return the name of it as BRAND. If the choice of brand is unsure then return an an empty response. If they say "[BRAND] at a [PLACE]" then choose the [BRAND].
            User description: ${message}`
        }],
        model: 'gpt-4-turbo',
        max_tokens: 500
    });

    const brandName = extractBrandQuery.choices.at(0)?.message.content

    if (typeof brandName !== 'string' || (typeof brandName === 'string' && brandName.trim().length == 0)) {
        return null;
    }

    return brandName;
}

export async function validateBrand(brandName: string, message: string, imageUrl: string) {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const validateBrandQuery = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ 
            role: 'user', 
            content: [ 
                { type: 'text', text: `You are a decision-maker for a social company, where users submit an IMAGE with a DESCRIPTION. The DESCRIPTION may mention a BRAND "${brandName}" that they claim is visible in the IMAGE, or a QUEST they are completing such as #photobooth. and you decide whether the user's claim is true and therefore VALID or not true and so therefore NOT VALID. You may not recognize the Brand name or the logos, as they are very new. 
                Here is the original user DESCRIPTION: "${message}" 
                
                For this image, think through what is the full list of every piece of clothing, apparel, visible signage, logos, and items in the image. 
                Special brands to note: the Unlonely brand has a wordmark/logo with the "u and the n" combined in the word unlonely, the SheFi brand has a logo that says SheFi and has products such as blue bucket hats, beanies, and shirts. The Linea brand does bracelets, and Paypal has beanies, Capsule has pens, Phaver has a black sweatshirt, WalletConnect has a water bottle and tote bags.
                
                You need to think whether you would answer TRUE or FALSE to each of the two following questions: 
                1) Is the user's DESCRIPTION of the IMAGE generally correct, and without any false statements? For example, if they describe a swimsuit but the image contains a man in a business suit, this would be FALSE. 
                2) Either the BRAND "${brandName}" name or logo visible and present in the image, or is the QUEST "${brandName}" correct? 
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
                { type: 'image_url', image_url: { url: imageUrl } }
            ],
        }]
    });

    const brandValidation = validateBrandQuery.choices.at(0)?.message.content
    if (typeof brandValidation !== 'string' || (typeof brandValidation === 'string' && brandValidation.includes('NOT VALID'))) {
        return null;
    }

    return brandValidation;
}