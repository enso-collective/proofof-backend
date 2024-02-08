import { z } from 'zod';

const AccountType = z.enum(['auth0', 'apple', 'crypto', 'firebase']);
const ethAddressPattern = /^0x[a-fA-F0-9]{40}$/;

const UserSchema = z.object({
  accountIds: z.array(z.string()),
  email: z.string().email().optional(),
});

const AccountSchema = z.object({
  userId: z.string(),
  type: AccountType,
});

const FirebaseAccountSchema = AccountSchema.extend({
  email: z.string().optional(),
  firebaseId: z.string(),
});

const Auth0AccountSchema = AccountSchema.extend({
  auth0Id: z.string(),
});

const AppleAccountSchema = AccountSchema.extend({
  appleId: z.string(),
});

const CryptoWalletSchema = AccountSchema.extend({
  walletAddress: z.string().refine((data) => ethAddressPattern.test(data), {
    message: 'Invalid Ethereum address',
  }),
  namespace: z.string(),
  reference: z.string(),
});

const CredentialSchema = z.object({
  credentialId: z.string(),
  userId: z.string(),
  label: z.string(),
});

const UserPublicInfoSchema = z.object({
  userId: z.string(),
  avatar: z.string().optional(),
  username: z.string(),
  displayName: z.string(),
  createdAt: z.date(), // Firestore Timestamp converted to JavaScript Date
  updatedAt: z.date(),
  backgroundUrl: z.string().optional(),
  bio: z.string(),
});
interface CredentialRecord {
  _id: string;
  vc: VerifiableCredential;
  isPublic: boolean;
  issuer: string;
  recipient: string;
  subject: string;
  schema: string;
  isDeleted: boolean;
  genId: string;
  updatedAt: string;
  history: any[]; // Replace with a more specific type if history has a defined structure
}

interface VerifiableCredential {
  '@context': string[];
  type: string[];
  issuer: { id: string };
  issuanceDate: string;
  id: string;
  credentialSubject: {
    id: string;
    person1: string;
    person2: string;
  };
  credentialSchema: {
    id: string;
    type: string;
  };
  proof: {
    verificationMethod: string;
    created: string;
    proofPurpose: string;
    type: string;
    proofValue: string;
    eip712Domain: {
      domain: {
        chainId: number;
        name: string;
        version: string;
      };
      messageSchema: {
        [key: string]: Array<{ name: string; type: string }>;
      };
      primaryType: string;
    };
  };
}

type ListOfCredentials = CredentialRecord[];

export {
  AccountSchema,
  UserSchema,
  Auth0AccountSchema,
  AppleAccountSchema,
  CryptoWalletSchema,
  CredentialSchema,
  FirebaseAccountSchema,
  UserPublicInfoSchema,
  ListOfCredentials,
};
