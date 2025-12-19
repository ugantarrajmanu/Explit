import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) throw new Error("User not found");

    return await ctx.db.insert("groups", {
      name: args.name,
      createdBy: user._id,
      members: [user._id],
    });
  },
});

export const get = query({
  args: { id: v.id("groups") },
  handler: async (ctx, args) => await ctx.db.get(args.id),
});


// ========= Adding member logic =========
export const addMember = mutation({
  args: {
    groupId: v.id("groups"),
    usernameOrEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    const input = args.usernameOrEmail.trim().toLowerCase();

    // 1️⃣ Try email (fast, indexed)
    let userToAdd = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", input))
      .unique();

    // 2️⃣ Try username (fast, indexed)
    if (!userToAdd) {
      userToAdd = await ctx.db
        .query("users")
        .withIndex("by_username", (q) =>
          q.eq("username", input)
        )
        .unique();
    }

    if (!userToAdd) {
      throw new Error(
        "User not found. Ask them to sign in once."
      );
    }

    if (group.members.includes(userToAdd._id)) {
      throw new Error("User is already in this group");
    }

    await ctx.db.patch(args.groupId, {
      members: [...group.members, userToAdd._id],
    });
  },
});

// convex/groups.ts
// ... keep your existing imports and create/addMember functions ...

export const getMyGroups = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) return [];

    // Fetch all groups and filter where user is a member
    const allGroups = await ctx.db.query("groups").collect();
    return allGroups.filter((g) => g.members.includes(user._id));
  },
});

export const getGroupAdmin = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) return null;
    
    // Fetch the user who created the group
    const adminUser = await ctx.db.get(group.createdBy);
    return adminUser;
  },
});

export const deleteGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // 1. Validate Admin Access
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user || group.createdBy !== user._id) {
      throw new Error("Unauthorized: Only the admin can delete this group");
    }

    // --- NEW: CHECK IF SETTLED ---
    
    // Fetch all expenses and splits for this group
    const expenses = await ctx.db
      .query("expenses")
      .filter((q) => q.eq(q.field("groupId"), args.groupId))
      .collect();

    const balances: Record<string, number> = {};

    for (const exp of expenses) {
      const splits = await ctx.db
        .query("splits")
        .withIndex("by_expense", (q) => q.eq("expenseId", exp._id))
        .collect();

      // Payer gets positive (owed money)
      balances[exp.payerId] = (balances[exp.payerId] || 0) + exp.amount;

      // Splitters get negative (owe money)
      for (const split of splits) {
        balances[split.userId] = (balances[split.userId] || 0) - split.amount;
      }
    }

    // Check if any single person has a non-zero balance
    const isSettled = Object.values(balances).every((bal) => Math.abs(bal) < 0.01);

    if (!isSettled) {
      throw new Error("Cannot delete group: Not all expenses are settled. Balances must be zero.");
    }

    // --- IF SETTLED, PROCEED WITH DELETE ---

    // Clean up expenses and splits (Clean database)
    for (const exp of expenses) {
      const splits = await ctx.db
        .query("splits")
        .withIndex("by_expense", (q) => q.eq("expenseId", exp._id))
        .collect();
      
      await Promise.all(splits.map((s) => ctx.db.delete(s._id)));
      await ctx.db.delete(exp._id);
    }

    // Delete the group
    await ctx.db.delete(args.groupId);
  },
});




