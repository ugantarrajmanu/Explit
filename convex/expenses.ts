import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// 1. Create an Expense (Includes Logic for Splits)
export const createExpense = mutation({
  args: {
    groupId: v.id("groups"),
    amount: v.number(),
    description: v.string(),
    splitType: v.union(
      v.literal("EQUAL"),
      v.literal("EXACT"),
      v.literal("PERCENT")
    ),
    splitData: v.optional(
      v.array(
        v.object({
          userId: v.id("users"),
          value: v.number(),
        })
      )
    ),
  },
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

    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    // Insert the Expense Record
    const expenseId = await ctx.db.insert("expenses", {
      groupId: args.groupId,
      payerId: user._id,
      amount: args.amount,
      description: args.description,
      splitType: args.splitType,
    });

    // Calculate Splits
    let splitsToInsert: { expenseId: any; userId: any; amount: number }[] = [];

    if (args.splitType === "EQUAL") {
      const splitAmount = args.amount / group.members.length;
      splitsToInsert = group.members.map((memberId) => ({
        expenseId,
        userId: memberId,
        amount: splitAmount,
      }));
    } else {
      if (!args.splitData) throw new Error("Missing split data");

      if (args.splitType === "EXACT") {
        const total = args.splitData.reduce((sum, item) => sum + item.value, 0);
        if (Math.abs(total - args.amount) > 0.01) {
          throw new Error(`Splits sum to ${total}, but expense is ${args.amount}`);
        }
        splitsToInsert = args.splitData.map((item) => ({
          expenseId,
          userId: item.userId,
          amount: item.value,
        }));
      } else if (args.splitType === "PERCENT") {
        const totalPercent = args.splitData.reduce(
          (sum, item) => sum + item.value,
          0
        );
        if (Math.abs(totalPercent - 100) > 0.1) {
          throw new Error(`Percentages sum to ${totalPercent}%, must be 100%`);
        }
        splitsToInsert = args.splitData.map((item) => ({
          expenseId,
          userId: item.userId,
          amount: (args.amount * item.value) / 100,
        }));
      }
    }

    // Batch Insert Splits
    await Promise.all(
      splitsToInsert.map((split) => ctx.db.insert("splits", split))
    );
  },
});

// 2. Get Balances (Strictly Group-Wise)
export const getGroupBalances = query({
  args: {
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    const balances: Record<string, number> = {};
    for (const memberId of group.members) {
      balances[memberId] = 0;
    }

    // Get all expenses for this group
    // Note: Requires .index("by_group", ["groupId"]) in schema.ts
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    for (const expense of expenses) {
      // Payer gets positive balance (they are owed money)
      if (balances[expense.payerId] !== undefined) {
        balances[expense.payerId] += expense.amount;
      }

      // Get splits for this expense
      const splits = await ctx.db
        .query("splits")
        .withIndex("by_expense", (q) => q.eq("expenseId", expense._id))
        .collect();

      // Splitters get negative balance (they owe money)
      for (const split of splits) {
        if (balances[split.userId] !== undefined) {
          balances[split.userId] -= split.amount;
        }
      }
    }

    return balances;
  },
});

// 3. Get Expense History
export const getExpenses = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .order("desc")
      .collect();

    // Attach payer names
    const expensesWithNames = await Promise.all(
      expenses.map(async (exp) => {
        const payer = await ctx.db.get(exp.payerId);
        return {
          ...exp,
          payerName: payer?.name || "Unknown",
        };
      })
    );

    return expensesWithNames;
  },
});