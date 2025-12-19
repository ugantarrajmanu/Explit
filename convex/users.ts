import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    // Check if we've already stored this user
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    // --- NEW LOGIC: SMART NAME GENERATION ---
    // 1. Use their real name if available
    // 2. Use their nickname/username if available
    // 3. Fallback to the part of email before '@' (e.g. "bob" from "bob@gmail.com")
    // 4. Fallback to "Guest"
    const displayName = 
      identity.name || 
      identity.nickname || 
      identity.email?.split("@")[0] || 
      "Guest";

    if (user !== null) {
      // If the user exists but their name in our DB is "User" or outdated, update it now.
      if (user.name !== displayName) {
        await ctx.db.patch(user._id, { name: displayName, email: identity.email! });
      }
      return user._id;
    }

    // New user
    return await ctx.db.insert("users", {
      name: displayName,
      tokenIdentifier: identity.tokenIdentifier,
      email: identity.email!,
    });
  },
});

export const getAll = query({
  handler: async (ctx) => await ctx.db.query("users").collect(),
});