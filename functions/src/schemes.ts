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
});

export {
  farcasterWebhookInput,
  attestationInput,
};
