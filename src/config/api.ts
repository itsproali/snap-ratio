/**
 * API Configuration for iLoveIMG
 *
 * To use this extension, you need to:
 * 1. Register at https://www.iloveapi.com/
 * 2. Get your Public Key and Secret Key from the API Keys section
 * 3. Add them to your environment variables or update this file
 */

export const iLoveIMGConfig = {
  // Your iLovePDF/iLoveIMG Public Key
  // Get it from: https://developer.ilovepdf.com/
  // Set it in .env file as: PLASMO_PUBLIC_ILOVEIMG_PUBLIC_KEY=your_key_here
  publicKey: process.env.PLASMO_PUBLIC_ILOVEIMG_PUBLIC_KEY || "",

  // Your iLovePDF/iLoveIMG Secret Key (for self-signing JWT tokens)
  // Get it from: https://developer.ilovepdf.com/
  // Set it in .env file as: PLASMO_PUBLIC_ILOVEIMG_SECRET_KEY=your_key_here
  // IMPORTANT: Never expose this in client-side code!
  secretKey: process.env.PLASMO_PUBLIC_ILOVEIMG_SECRET_KEY || "",

  // API Base URL
  baseUrl: "https://api.iloveimg.com",

  // Tool to use for compression
  tool: "compressimage",

  // Authentication endpoint
  authUrl: "https://api.iloveimg.com/v1/auth"
}
