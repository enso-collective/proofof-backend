import { z } from 'zod';

const farcasterWebhookInput = z.object({
  fid: z.coerce.string(),
  username: z.string(),
  displayName: z.string(),
  message: z.string(),
  embedUrl: z.string().optional(),
  hash: z.string(),
  wallet: z.string().optional(),
});

const attestationInput = z.object({
  key: z.string(),
  quest: z.string(),
  data: z.array(z.string()),
  userWallet: z.string()
});

const farcasterFrameInput = z.object({
  key: z.string(),
  username: z.string(),
  imageUrl: z.string(),
  message: z.string(),
  castHash: z.string(),
  wallet: z.string().optional()
});

const validationInput = z.object({
  key: z.string(),
  username: z.string(),
  imageUrl: z.string(),
  message: z.string(),
});

const internalMintInput = z.object({
  key: z.string(),
  username: z.string(), 
  attestWallet: z.string(), 
  postUrl: z.string(), 
  postImageLink: z.string(), 
  postContent: z.string(), 
  questId: z.string()
});

const internalMintNotesInput = z.object({
  key: z.string(),
  username: z.string(), 
  attestWallet: z.string(), 
  postUrl: z.string(), 
  noteText: z.string(), 
  sentiment: z.string(),
});

const poapInput = z.object({
  key: z.string(),
  poap_id: z.string(),
  poap_name: z.string()
});

export {
  farcasterWebhookInput,
  farcasterFrameInput,
  attestationInput,
  poapInput,
  validationInput,
  internalMintInput,
  internalMintNotesInput
};
