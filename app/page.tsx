"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { CheckCircle2 } from "lucide-react";
import { Id } from "../convex/_generated/dataModel";
import { ModeToggle } from "@/components/mode-toggle";

export default function Home() {
  const storeUser = useMutation(api.users.store);
  const createGroup = useMutation(api.groups.create);
  const myGroups = useQuery(api.groups.getMyGroups);
  const globalDebts = useQuery(api.expenses.getGlobalBalances);
  const settleGlobal = useMutation(api.expenses.settleGlobalDebt);

  const router = useRouter();
  const { user } = useUser();
  const [groupName, setGroupName] = useState("");

  useEffect(() => {
    if (user) storeUser();
  }, [user, storeUser]);

  const handleCreate = async () => {
    const groupId = await createGroup({ name: groupName });
    router.push(`/groups/${groupId}`);
  };

  const handleSettle = async (
    friendId: string,
    friendName: string,
    amount: number
  ) => {
    if (!confirm(`You paid ${friendName} $${amount.toFixed(2)}?`)) return;
    await settleGlobal({
      friendId: friendId as Id<"users">,
      amount,
    });
  };

  return (
    <main className="mx-auto max-w-xl px-6 py-10 space-y-8">
      {/* HEADER */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Expense Share
          </h1>
          <p className="text-sm text-neutral-500">
            Split expenses effortlessly
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ModeToggle />
          <UserButton />
        </div>
      </header>

      {/* OVERALL STATUS */}
      <section className="rounded-2xl bg-white dark:bg-neutral-900 p-6 ring-1 ring-neutral-200 dark:ring-neutral-800 space-y-4">
        <h2 className="text-sm font-medium text-neutral-500">
          Overall balances
        </h2>

        {globalDebts === undefined ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : globalDebts.length === 0 ? (
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 p-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="font-medium">You’re fully settled</span>
          </div>
        ) : (
          <div className="space-y-3">
            {globalDebts.map((debt) => {
              const youAreOwed = debt.amount > 0;
              const amount = Math.abs(debt.amount);

              return (
                <div
                  key={debt.friendId}
                  className="flex items-center justify-between rounded-xl bg-neutral-50 dark:bg-neutral-800 px-4 py-3"
                >
                  {/* LEFT: NAME + CONTEXT */}
                  <div className="space-y-0.5">
                    <p className="font-medium">{debt.friendName}</p>
                    <p
                      className={`text-xs ${
                        youAreOwed
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {youAreOwed ? "owes you" : "you owe"}
                    </p>
                  </div>

                  {/* RIGHT: AMOUNT + ACTION */}
                  <div className="text-right space-y-1">
                    <p
                      className={`font-mono font-semibold ${
                        youAreOwed
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      ${amount.toFixed(2)}
                    </p>

                    {!youAreOwed && (
                      <button
                        onClick={() =>
                          handleSettle(debt.friendId, debt.friendName, amount)
                        }
                        className="
                    inline-flex items-center gap-1
                    text-xs font-medium
                    text-neutral-600 dark:text-neutral-300
                    hover:text-neutral-900 dark:hover:text-white
                    transition
                  "
                      >
                        Settle up →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* CREATE GROUP */}
      <section className="rounded-2xl bg-white dark:bg-neutral-900 p-6 ring-1 ring-neutral-200 dark:ring-neutral-800 space-y-4">
        <h2 className="text-sm font-medium text-neutral-500">Create group</h2>

        <input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Trip to Goa"
          className="w-full rounded-xl bg-neutral-100 dark:bg-neutral-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
        />

        <button
          onClick={handleCreate}
          disabled={!groupName}
          className="w-full rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
        >
          Create Group
        </button>
      </section>

      {/* MY GROUPS */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-500">Your groups</h2>

        {myGroups?.map((group) => (
          <button
            key={group._id}
            onClick={() => router.push(`/groups/${group._id}`)}
            className="w-full rounded-2xl bg-white dark:bg-neutral-900 p-4 ring-1 ring-neutral-200 dark:ring-neutral-800 hover:ring-neutral-400 dark:hover:ring-neutral-600 transition flex justify-between items-center"
          >
            <div className="text-left">
              <p className="font-medium">{group.name}</p>
              <p className="text-xs text-neutral-500">
                {group.members.length} members
              </p>
            </div>
            <span className="text-neutral-400">→</span>
          </button>
        ))}
      </section>
    </main>
  );
}
