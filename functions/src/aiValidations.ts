import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function checkBrandPresence(inputString: string) {
    const brandNames = ['lens', 'lens protocol', 'afk', 'brussels', 'raave', 'orb', 'proofof', 'fitcheck', 'bonsai', 'zksync'];
    const regex = new RegExp(brandNames.join('|'), 'i');

    if (regex.test(inputString)) {
        return "Lens";
    }

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
            content: `You are an expert in extracting the brand name in a string of text. A user submitted text content which relates to an image, which should contain a primary brand name, or describe a moment in their life they are taking a picture of. Without seeing the image, your job is to choose the primary brand they are describing. It may be a short word, such as "SheFi" or "Lens", which is ok. Note: there are some new brand names to learn: SheFi, Lens Protocol, Linea, Consensys, Crowdmuse. It is likely that if a word is capitalized it is the Brand name. The brand name could be referred to by a mention using the @ decorator, such as @shefi or @nike (describing the shefi brand or nike brand). It could be in a hashtag, such as #happySheFi, or with a / in front such as /shefi. If you see @0xproofof or @proofof, that is a special tag and is not the brandname.`
        }, 
        {
            role: 'user',
            content: `A user supplied the following text which may contain a brand name. You are an expert in choosing the primary brand they are describing and return the name of it. If the choice of brand is unsure then return an an empty response. If they say "[BRAND] at a [PLACE]" then choose the [BRAND]. 
            User text: ${message}
            Return the primary brand name detected, or the empty string.`
        }],
        model: 'gpt-4o',
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
        model: 'gpt-4o',
        messages: [{ 
            role: 'user', 
            content: [ 
                { type: 'text', text: `You are an expert in analyzing photos and images, and extracting the content and any text visible. A different user submitted an IMAGE with a DESCRIPTION. The DESCRIPTION may mention a BRAND "${brandName}" that they claim is visible in the IMAGE.

                Here is the original user DESCRIPTION: "${message}"
                
                For this IMAGE, think through what is the full list of every piece of clothing, artwork, apparel, text, visible signage, logos, and items in the image.
                
                Some Special new Brands to note:
                - the SheFi brand has a logo that says SheFi and has products such as blue bucket hats, beanies, and shirts.
                - Lens Protocol has green / white / colorful clothing, and the logo is a leaf-shape with a face on it. 
                
                Your response should be in this format:
                2. "VALID - [the brand name from the user's description]"`},

                { type: 'image_url', image_url: { url: imageUrl } }
            ],
        }]
    });

    const brandValidation = validateBrandQuery.choices.at(0)?.message.content
    if (typeof brandValidation !== 'string' || (typeof brandValidation === 'string' && brandValidation.includes('NOT VALID'))) {
        return null;
    }
    console.log("Brand validation result: ", brandValidation); 
    return brandValidation;

}