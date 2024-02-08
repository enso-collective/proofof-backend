import axios from 'axios';
import { ListOfCredentials } from './schemes';

export async function searchCredentials({
  walletAddress,
}: {
  walletAddress: string;
}): Promise<ListOfCredentials> {
  const apiUrl = 'https://api.disco.xyz/v1/credentials/search';
  const data = {
    conjunction: 'and',
    criteria: [
      {
        field: 'issuer',
        operator: '=',
        value: 'did:web:api.disco.xyz/v1/enso',
      },
      {
        field: 'schema',
        operator: '=',
        value:
          'https://raw.githubusercontent.com/discoxyz/disco-schemas/main/json/AttestedMetIrlCredential/1-0-0.json',
      },
      {
        field: 'vc.credentialSubject.person2',
        operator: '=',
        value: walletAddress,
      },
    ],
    page: 1,
    size: 2000,
  };

  try {
    const response = await axios.post<ListOfCredentials>(apiUrl, data, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer 5fd83972-68bb-498b-a9e4-7cfa4ae5dbca',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching credentials:', error);
    throw error;
  }
}
