import { createClient } from '@base44/sdk';

// Create a client with authentication
export const base44 = createClient({
  appId: "68d244cb8a392237a5acfbd9",
  requiresAuth: true
});

// Function to check if base44 is authenticated
export const isBase44Authenticated = () => {
  try {
    return base44.auth?.isSignedIn?.() || false;
  } catch {
    return false;
  }
};

// Function to login to base44
export const loginToBase44 = async () => {
  try {
    if (!isBase44Authenticated()) {
      await base44.auth?.signIn?.();
    }
    return true;
  } catch (error) {
    console.error('Base44 auth error:', error);
    return false;
  }
};
