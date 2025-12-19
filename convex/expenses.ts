import { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// 1. Create Expense
export const createExpense = mutation({
  args: {
    groupId: v.id("groups"),
    amount: v.number(),
    description: v.string(),
    splitType: v.union(v.literal("EQUAL"), v.literal("EXACT"), v.literal("PERCENT")),
    splitData: v.optional(
      v.array(
        v.object({
          userId: v.id("users"),
          value: v.number(),
        })
      )
    ),
    // Allow specifying who paid (defaults to user if null)
    paidBy: v.optional(v.id("users")), 
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();
    if (!user) throw new Error("User not found");

    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    // Create Expense Record
    const expenseId = await ctx.db.insert("expenses", {
      groupId: args.groupId,
      payerId: args.paidBy || user._id, // Use the provided payer OR the current user
      amount: args.amount,
      description: args.description,
      splitType: args.splitType,
    });

    // Calculate Splits
    let splitsToInsert: { expenseId: Id<"expenses">; userId: Id<"users">; amount: number }[] = [];

    if (args.splitType === "EQUAL") {
      const splitAmount = args.amount / group.members.length;
      splitsToInsert = group.members.map((memberId) => ({
        expenseId,
        userId: memberId,
        amount: splitAmount,
      }));
    } else {
      if (!args.splitData) throw new Error("Missing split data");
      
      // Validation Logic
      if (args.splitType === "EXACT") {
        const total = args.splitData.reduce((sum, item) => sum + item.value, 0);
        if (Math.abs(total - args.amount) > 0.01) throw new Error("Splits don't match total");
        splitsToInsert = args.splitData.map((item) => ({ expenseId, userId: item.userId, amount: item.value }));
      } 
      else if (args.splitType === "PERCENT") {
        const total = args.splitData.reduce((sum, item) => sum + item.value, 0);
        if (Math.abs(total - 100) > 0.1) throw new Error("Percentages must equal 100");
        splitsToInsert = args.splitData.map((item) => ({ expenseId, userId: item.userId, amount: (args.amount * item.value) / 100 }));
      }
    }

    await Promise.all(splitsToInsert.map((split) => ctx.db.insert("splits", split)));
  },
});

// 2. Get Balances (Fixed to handle deletion gracefully)
export const getGroupBalances = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    
    // FIX: If group is missing (deleted), return empty object instead of crashing
    if (!group) return {}; 

    const balances: Record<string, number> = {};
    group.members.forEach(id => balances[id] = 0);

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    for (const expense of expenses) {
      // Payer gets credit (+)
      if (balances[expense.payerId] !== undefined) {
        balances[expense.payerId] += expense.amount;
      }

      const splits = await ctx.db
        .query("splits")
        .withIndex("by_expense", (q) => q.eq("expenseId", expense._id))
        .collect();

      // Consumer gets debt (-)
      for (const split of splits) {
        if (balances[split.userId] !== undefined) {
          balances[split.userId] -= split.amount;
        }
      }
    }
    return balances;
  },
});

// 3. Get History
export const getExpenses = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .order("desc")
      .collect();

    return Promise.all(
      expenses.map(async (exp) => {
        const payer = await ctx.db.get(exp.payerId);
        return { ...exp, payerName: payer?.name || "Unknown" };
      })
    );
  },
});