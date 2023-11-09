import { z } from 'zod';

const AccountType = z.enum(['auth0', 'apple', 'crypto']);
const Web3AuthProvider = z.enum(['metamask', 'walletconnect']);
const ethAddressPattern = /^0x[a-fA-F0-9]{40}$/;

const UserSchema = z.object({
  accountIds: z.array(z.string()),
  email: z.string().email().optional(),
});

const AccountSchema = z.object({
  userId: z.string(),
  type: AccountType,
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
  provider: Web3AuthProvider,
  namespace: z.string(),
  reference: z.string(),
});

const CredentialSchema = z.object({
  credentialId: z.string(),
  userId: z.string(),
  label: z.string(),
});

export {
  AccountSchema,
  UserSchema,
  Auth0AccountSchema,
  AppleAccountSchema,
  CryptoWalletSchema,
  CredentialSchema,
};
