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

export const addMember = mutation({
  args: {
    groupId: v.id("groups"),
    usernameOrEmail: v.string(), // Renamed argument
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    // 1. Try to find by Email
    let userToAdd = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.usernameOrEmail))
      .first();

    // 2. If not found, try to find by Name (Linear search, simplistic for this demo)
    if (!userToAdd) {
      const allUsers = await ctx.db.query("users").collect();
      userToAdd = allUsers.find(u => u.name === args.usernameOrEmail) || null;
    }

    if (!userToAdd) {
      throw new Error("User not found by email or username.");
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

    // 1. Get the Group
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    // 2. Get the Current User's ID from our DB
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    if (!user) throw new Error("User not found");

    // 3. SECURITY CHECK: Is the caller the group creator?
    if (group.createdBy !== user._id) {
      throw new Error("Unauthorized: Only the admin can delete this group");
    }

    // 4. Delete the group
    // (Note: In a production app, you might also want to delete all expenses/splits linked to this group here)
    await ctx.db.delete(args.groupId);
  },
});





