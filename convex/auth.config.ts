export default {
  providers: [
    {
      domain: process.env.CLERK_ISSUER_URL,
      // domain: "https://more-dassie-49.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};