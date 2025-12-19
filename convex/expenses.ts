import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
    // Optional: Only needed for EXACT or PERCENT
    splitData: v.optional(
      v.array(
        v.object({
          userId: v.id("users"),
          value: v.number(), // Amount for EXACT, Percentage (0-100) for PERCENT
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

    // 1. Create the Expense Record
    const expenseId = await ctx.db.insert("expenses", {
      groupId: args.groupId,
      payerId: user._id,
      amount: args.amount,
      description: args.description,
      splitType: args.splitType,
    });

    // 2. Calculate Splits
    let splitsToInsert: { expenseId: any; userId: any; amount: number }[] = [];

    if (args.splitType === "EQUAL") {
      const splitAmount = args.amount / group.members.length;
      splitsToInsert = group.members.map((memberId) => ({
        expenseId,
        userId: memberId,
        amount: splitAmount,
      }));
    } else {
      // Handle EXACT or PERCENT
      if (!args.splitData) throw new Error("Missing split data");

      // Validate total matches
      if (args.splitType === "EXACT") {
        const total = args.splitData.reduce((sum, item) => sum + item.value, 0);
        if (Math.abs(total - args.amount) > 0.01) {
          throw new Error(
            `Splits sum to ${total}, but expense is ${args.amount}`
          );
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
        if (Math.abs(totalPercent - 100) > 0.01) {
          throw new Error(`Percentages sum to ${totalPercent}%, must be 100%`);
        }
        splitsToInsert = args.splitData.map((item) => ({
          expenseId,
          userId: item.userId,
          amount: (args.amount * item.value) / 100,
        }));
      }
    }

    // 3. Batch Insert
    await Promise.all(
      splitsToInsert.map((split) => ctx.db.insert("splits", split))
    );
  },
});

export const getGroupBalance = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);

    // --- FIX START: Handle missing group gracefully ---
    if (!group) {
      // Return empty structure instead of throwing an error
      return {
        balances: {},
        localSettlements: [],
        globalSettlements: [],
      };
    }
    // --- FIX END ---

    // ... (Rest of the logic remains exactly the same) ...

    // 1. LOCAL GROUP CALCULATION
    const localExpenses = await ctx.db
      .query("expenses")
      .filter((q) => q.eq(q.field("groupId"), args.groupId))
      .collect();

    const balances: Record<string, number> = {};

    for (const exp of localExpenses) {
      const splits = await ctx.db
        .query("splits")
        .withIndex("by_expense", (q) => q.eq("expenseId", exp._id))
        .collect();

      balances[exp.payerId] = (balances[exp.payerId] || 0) + exp.amount;
      for (const split of splits) {
        balances[split.userId] = (balances[split.userId] || 0) - split.amount;
      }
    }

    // 2. GLOBAL CONTEXT CALCULATION
    const globalBalances: Record<string, number> = {};
    const allExpenses = await ctx.db.query("expenses").collect();

    for (const exp of allExpenses) {
      if (!group.members.includes(exp.payerId)) continue;

      const splits = await ctx.db
        .query("splits")
        .withIndex("by_expense", (q) => q.eq("expenseId", exp._id))
        .collect();

      globalBalances[exp.payerId] =
        (globalBalances[exp.payerId] || 0) + exp.amount;

      for (const split of splits) {
        if (group.members.includes(split.userId)) {
          globalBalances[split.userId] =
            (globalBalances[split.userId] || 0) - split.amount;
        }
      }
    }

    // 3. HELPER: Calculate Settlements
    const calculateSettlements = (balanceMap: Record<string, number>) => {
      const debtors: { id: string; amount: number }[] = [];
      const creditors: { id: string; amount: number }[] = [];

      for (const [userId, amount] of Object.entries(balanceMap)) {
        if (amount < -0.01) debtors.push({ id: userId, amount: -amount });
        if (amount > 0.01) creditors.push({ id: userId, amount: amount });
      }

      const results = [];
      let i = 0,
        j = 0;

      while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];
        const amount = Math.min(debtor.amount, creditor.amount);

        if (amount > 0.01) {
          results.push({ from: debtor.id, to: creditor.id, amount });
        }

        debtor.amount -= amount;
        creditor.amount -= amount;

        if (debtor.amount < 0.01) i++;
        if (creditor.amount < 0.01) j++;
      }
      return results;
    };

    return {
      balances,
      localSettlements: calculateSettlements(balances),
      globalSettlements: calculateSettlements(globalBalances),
    };
  },
});

export const getExpenses = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const expenses = await ctx.db
      .query("expenses")
      .filter((q) => q.eq(q.field("groupId"), args.groupId))
      .order("desc") // Newest first
      .collect();

    // Get the names of the payers for display
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

export const getGlobalBalances = query({
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

    // 1. Get ALL expenses where I paid (Others owe me)
    const iPaid = await ctx.db
      .query("expenses")
      .filter((q) => q.eq(q.field("payerId"), user._id))
      .collect();

    // 2. Get ALL splits where I owe (I owe others)
    const iOwe = await ctx.db
      .query("splits")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const netMap: Record<string, number> = {};

    // Process money coming IN (I paid, they owe me)
    for (const expense of iPaid) {
      const splits = await ctx.db
        .query("splits")
        .withIndex("by_expense", (q) => q.eq("expenseId", expense._id))
        .collect();

      for (const split of splits) {
        if (split.userId === user._id) continue; // Skip my own split
        netMap[split.userId] = (netMap[split.userId] || 0) + split.amount;
      }
    }

    // Process money going OUT (They paid, I owe them)
    for (const split of iOwe) {
      const expense = await ctx.db.get(split.expenseId);
      if (!expense || expense.payerId === user._id) continue; // Skip if I paid myself
      netMap[expense.payerId] = (netMap[expense.payerId] || 0) - split.amount;
    }

    // 3. Format result
    const results = [];
    for (const [friendId, amount] of Object.entries(netMap)) {
      if (Math.abs(amount) < 0.01) continue; // Skip settled debts
      const friend = await ctx.db.get(friendId as any);
      results.push({
        friendId: friendId, // <--- ADD THIS LINE
        friendName: friend?.name || "Unknown",
        amount,
      });
    }

    return results;
  },
});

export const settleGlobalDebt = mutation({
  args: {
    friendId: v.id("users"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first();

    if (!currentUser) throw new Error("User not found");

    // 1. Find a common group to record this transaction in
    // We just need ANY valid group where both users are members.
    const allGroups = await ctx.db.query("groups").collect();

    const commonGroup = allGroups.find(
      (g) =>
        g.members.includes(currentUser._id) && g.members.includes(args.friendId)
    );

    if (!commonGroup) {
      throw new Error(
        "No common group found with this friend to record the settlement."
      );
    }

    // 2. Record the Settlement in that group
    // (This effectively clears the global debt because our math checks all groups)
    const expenseId = await ctx.db.insert("expenses", {
      groupId: commonGroup._id,
      payerId: currentUser._id,
      amount: args.amount,
      description: "Global Settlement (Dashboard)",
      splitType: "EXACT",
    });

    await ctx.db.insert("splits", {
      expenseId,
      userId: args.friendId,
      amount: args.amount,
    });

    return commonGroup.name; // Return name to show in alert
  },
});
