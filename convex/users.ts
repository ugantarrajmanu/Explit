import { mutation, query } from "./_generated/server";

export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", q =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    // ---- Username (stable & searchable) ----
    const username =
      (identity.username as string | undefined) ||
      identity.nickname ||
      identity.email?.split("@")[0] ||
      identity.tokenIdentifier.slice(0, 8);

    // ---- Display name (UI only) ----
    const name =
      identity.name ||
      identity.nickname ||
      username ||
      "Guest";

    if (existing) {
      await ctx.db.patch(existing._id, {
        name,
        email: identity.email!,
        username: username.toLowerCase(),
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      email: identity.email!,
      name,
      username: String(username).toLowerCase(),
    });
  },
});

export const getAll = query({
  handler: async (ctx) => ctx.db.query("users").collect(),
});
 