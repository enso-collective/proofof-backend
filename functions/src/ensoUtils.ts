export function determineQuestId(brandName: string) {
    const questBrands = ["LUKSO", "TheBuildersDAO", "NOX", "Crowdmuse", "SheFi", "Linea", "Unlonely", "Capsule", "Phaver", "WalletConnect", "Harpie", "Paypal", "PYUSD", "Enso", "Hyperlane", "Base", "photobooth", "newfriend", "shefipanel"];
    let questId;
    const brandNameLower = brandName.toLowerCase();

    if (questBrands.map(brand => brand.toLowerCase()).includes(brandNameLower)) {
       questId = brandNameLower;
    } else {
        questId = "general";
    }

    return questId
};