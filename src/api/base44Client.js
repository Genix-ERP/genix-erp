import { createClient } from '@base44/sdk';

// Create a client without authentication requirement (using local auth)
export const base44 = createClient({
  appId: "68d244cb8a392237a5acfbd9",
  requiresAuth: false
});
