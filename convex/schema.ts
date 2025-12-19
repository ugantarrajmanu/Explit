import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
  tokenIdentifier: v.string(),
  name: v.string(),
  email: v.string(),
  username: v.string(),
})
  .index("by_token", ["tokenIdentifier"])
  .index("by_email", ["email"])
  .index("by_username", ["username"]),

  groups: defineTable({
    name: v.string(),
    createdBy: v.id("users"),
    members: v.array(v.id("users")),
  }),

  expenses: defineTable({
    groupId: v.id("groups"),
    payerId: v.id("users"),
    amount: v.number(),
    description: v.string(),
    splitType: v.string(), 
  }),

  splits: defineTable({
    expenseId: v.id("expenses"),
    userId: v.id("users"),
    amount: v.number(),
  }).index("by_expense", ["expenseId"]).index("by_user", ["userId"]),
});