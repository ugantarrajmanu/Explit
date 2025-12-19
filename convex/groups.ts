import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
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

export const getGroupMembers = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) return [];
    
    const members = await Promise.all(
      group.members.map((userId) => ctx.db.get(userId))
    );
    return members.filter((m) => m !== null);
  },
});

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

    // 1. Try email
    let userToAdd = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", input))
      .unique();

    // 2. Try username
    if (!userToAdd) {
      userToAdd = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", input))
        .unique();
    }

    if (!userToAdd) {
      throw new Error("User not found");
    }

    if (group.members.includes(userToAdd._id)) {
      return; 
    }

    await ctx.db.patch(args.groupId, {
      members: [...group.members, userToAdd._id],
    });
  },
});

export const getMyGroups = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();

    if (!user) return [];

    const allGroups = await ctx.db.query("groups").collect();
    return allGroups.filter((g) => g.members.includes(user._id));
  },
});

export const deleteGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();

    if (!user || group.createdBy !== user._id) {
      throw new Error("Unauthorized: Only the admin can delete this group");
    }

    const balanceData = await ctx.runQuery(api.expenses.getGroupBalances, {
      groupId: args.groupId,
    });

    const unsettled = Object.values(balanceData).some(
      (bal) => Math.abs(bal) > 0.01
    );

    if (unsettled) {
      throw new Error("Cannot delete group: Not all expenses are settled.");
    }

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    for (const exp of expenses) {
      const splits = await ctx.db
        .query("splits")
        .withIndex("by_expense", (q) => q.eq("expenseId", exp._id))
        .collect();

      await Promise.all(splits.map((s) => ctx.db.delete(s._id)));
      await ctx.db.delete(exp._id);
    }

    await ctx.db.delete(args.groupId);
  },
});