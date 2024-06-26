import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function checkBrandPresence(inputString: string) {
    // Check for 'thebuildersdao' case-insensitively
    if (/thebuildersdao/i.test(inputString)) {
        return "TheBuildersDao";
    }
    // Check for 'nox gallery' or '@noxgallery' case-insensitively
    else if (/nox gallery|@noxgallery/i.test(inputString)) {
        return "NOXGallery";
    }
    // Return null if none of the conditions are met
    return null;
}

export async function extractBrand(message: string) {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const brandName = checkBrandPresence(message);
    console.log("The brand name from message:", brandName); // Log the brand name

     // Check if the result from checkBrandPresence is not null
     if (brandName !== null) {
        return brandName;  // Return the brand name if it's not null
    }

    const extractBrandQuery = await openai.chat.completions.create({
        messages: [
        { 
            role: 'system', 
            content: `You are an expert in extracting the brand name in a string of text. A user submitted text content which relates to an image, which should contain a primary brand name, or describe a moment in their life they are taking a picture of. Without seeing the image, your job is to choose the primary brand they are describing. It may be a short word, such as "NOX" or "TheBuildersDAO", which is ok. Note: there are some new brand names to learn: TheBuildersDAO, NOX, SheFi, NFC Lisbon, Consensys, Crowdmuse. It is likely that if a word is capitalized it is the Brand name. The brand name could be referred to by a mention using the @ decorator, such as @shefi or @nike (describing the shefi brand or nike brand). It could be in a hashtag, such as #happySheFi, or with a / in front such as /shefi. If you see @proofof, that is a special tag and is not the brandname. If the text contains @TheBuildersDao or #ProofofBuilders then the brand is TheBuildersDao. If both TheBuildersDao and Nox are mentioned, then choose TheBuildersDao.`
        }, 
        {
            role: 'user',
            content: `A user supplied the following description which is meant to contain a brand name. You are an expert in choosing the primary brand they are describing and return the name of it. If the choice of brand is unsure then return an an empty response. If they say "[BRAND] at a [PLACE]" then choose the [BRAND]. If the text contains @TheBuildersDao or #ProofofBuilders then the brand is TheBuildersDao.
            User description: ${message}
            Return the brandname, or "Not"`
        }],
        model: 'gpt-4-turbo',
        max_tokens: 500
    });

    const brandNameFromAi = extractBrandQuery.choices.at(0)?.message.content
    console.log("Extracted brand name:", brandNameFromAi); // Log the extracted brand name


    if (typeof brandNameFromAi !== 'string' || (typeof brandNameFromAi === 'string' && brandNameFromAi.trim().length == 0) || brandNameFromAi === 'Not') {
        return null;
    }

    return brandNameFromAi;
}


export async function validateBrand(brandName: string, message: string, imageUrl: string) {
    console.log("Validating brand:", brandName, "with message:", message, "and image URL:", imageUrl); // Log the inputs

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const validateBrandQuery = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ 
            role: 'user', 
            content: [ 
                { type: 'text', text: `You are an expert in analyzing photos and images, and extracting the content and any text visible. A different user submitted an IMAGE with a DESCRIPTION. The DESCRIPTION may mention a BRAND "${brandName}" that they claim is visible in the IMAGE. Your task is to determine whether the user's claim is true and therefore VALID, or not true and so therefore NOT VALID. You may not recognize the Brand name or the logos, as they are very new brands. If so, learn the new brand.

                Here is the original user DESCRIPTION: "${message}"
                
                For this IMAGE, think through what is the full list of every piece of clothing, artwork, apparel, text, visible signage, logos, and items in the image.
                
                Some Special new Brands to note:
                - NOX - also called NOX Gallery, it can be paintings, artwork, digital images, stickers, shirts. 
                - TheBuildersDao - has shiny stickers that say BLDRS or WEB3 IS BUILT IRL or THE BUILDERS DAO. If you see those then this is the BRAND to choose. Also could be posters, or clothing, at an art gallery, or photos, artwork, paintings. They are working with these artists, who may or may not be mentioned with an image of a work of art: Tormius, Lele Gastini, Fabiola Sangineto, The Social Trauma, Amastasia, Stijn Stragier, Cotama, RedruM, Flavio Acri, Cotama, Caperucita la más roja, Yukari YAMINO, Samanta, BloomingVisions, Nadobroart, Anna Dart, Roger Haus, mochataro. If any of those names are mentioned, reply with "VALID - TheBuildersDAO". If the photo is of an art gallery, it is likely TheBuildersDao.
                - the SheFi brand has a logo that says SheFi and has products such as blue bucket hats, beanies, and shirts.
                - Crowdmuse
                - Web3District
                
                You need to answer TRUE or FALSE to each of the two following questions:
                1) Is the user's DESCRIPTION of the IMAGE generally correct, and without any false statements? For example, if they describe a swimsuit but the image contains a man in a business suit, this would be FALSE.
                2) Is the BRAND "${brandName}" name or logo visible and present in the image? Note: If the brand name or logo is not directly visible or legible, but it could plausibly be correct based on the type of items, clothing, artwork or location setting, then trust the user and answer TRUE.
                
                Your response should be one of the two options:
                1. "NOT VALID - [reason]"
                2. "VALID - [the brand name you extracted]"
                
                Substitute the appropriate responses into the brackets. Respond with NOT VALID if the brand listed is definitely not in the image, because of [reason].
                
                EXAMPLES:
                - If the image has DESCRIPTION of the brand Ray-Ban, and there are no sunglasses visible in the image, then respond "NOT VALID - no Ray-Ban sunglasses visible".
                - If the image has the claim of the brand Ray-Ban, and there are sunglasses visible in the image but hard to tell what brand they are, which could be because there is no brand label visible or the item is small, then respond with "VALID - Ray-Ban".
                - If the DESCRIPTION says a swimsuit but the image contains a jacket, this would be "NOT VALID - image does not match description".`},
                { type: 'image_url', image_url: { url: imageUrl } }
            ],
        }]
    });

    const brandValidation = validateBrandQuery.choices.at(0)?.message.content
    if (typeof brandValidation !== 'string' || (typeof brandValidation === 'string' && brandValidation.includes('NOT VALID'))) {
        return null;
    }
    console.log("Brand validation result:", brandValidation); 
    return brandValidation;

}