"use client";

import { useState, use } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { UserButton, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, CheckCircle2 } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";

type SplitType = "EQUAL" | "EXACT" | "PERCENT";

export default function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const groupId = id as Id<"groups">;

  const router = useRouter();

  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [splitType, setSplitType] = useState<SplitType>("EQUAL");
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});
  const [inputValue, setInputValue] = useState("");

  const createExpense = useMutation(api.expenses.createExpense);
  const addMember = useMutation(api.groups.addMember);
  const deleteGroup = useMutation(api.groups.deleteGroup);

  const group = useQuery(api.groups.get, { id: groupId });
  const users = useQuery(api.users.getAll);
  const balanceData = useQuery(api.expenses.getGroupBalance, { groupId });

  if (!group || !users || !balanceData) {
    return <div className="p-10 text-neutral-500">Loading…</div>;
  }

  const getUserName = (id: string) =>
    users.find((u) => u._id === id)?.name || "Unknown";

  /* ---------------- ACTIONS ---------------- */

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await addMember({
        groupId,
        usernameOrEmail: inputValue.trim().toLowerCase(),
      });
      setInputValue("");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm("Delete this group permanently?")) return;
    await deleteGroup({ groupId });
    router.push("/");
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    const numAmount = parseFloat(amount);

    const splitData =
      splitType === "EQUAL"
        ? undefined
        : group.members.map((memberId) => ({
            userId: memberId,
            value: parseFloat(splitValues[memberId] || "0"),
          }));

    await createExpense({
      groupId,
      amount: numAmount,
      description: desc,
      splitType,
      splitData,
    });

    setDesc("");
    setAmount("");
    setSplitValues({});
    setSplitType("EQUAL");
  };

  /* ---------------- UI ---------------- */

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 space-y-8">
      {/* HEADER */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="rounded-xl p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {group.name}
            </h1>
            <p className="text-xs text-neutral-500">
              {group.members.length} members
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ModeToggle />
          <UserButton />
          <button
            onClick={handleDeleteGroup}
            className="rounded-xl p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 transition"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ADD MEMBER */}
      <section className="rounded-2xl bg-white dark:bg-neutral-900 p-6 ring-1 ring-neutral-200 dark:ring-neutral-800 space-y-4">
        <h2 className="text-sm font-medium text-neutral-500">Add member</h2>

        <form onSubmit={handleAddMember} className="flex gap-2">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Email or username"
            className="flex-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
            required
          />
          <button className="rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-4 text-sm font-medium">
            Add
          </button>
        </form>
      </section>

      {/* MEMBER BALANCES */}
      <section className="rounded-2xl bg-white dark:bg-neutral-900 p-6 ring-1 ring-neutral-200 dark:ring-neutral-800 space-y-4">
        <h2 className="text-sm font-medium text-neutral-500">
          Member balances
        </h2>

        {Object.entries(balanceData.balances).map(([userId, bal]) => (
          <div
            key={userId}
            className="flex justify-between items-center rounded-xl bg-neutral-50 dark:bg-neutral-800 px-4 py-3"
          >
            <span className="font-medium">{getUserName(userId)}</span>
            <span
              className={`font-mono text-sm ${
                bal > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {bal > 0 ? "+" : ""}
              {bal.toFixed(2)}
            </span>
          </div>
        ))}
      </section>

      {/* ADD EXPENSE */}
      <section className="rounded-2xl bg-white dark:bg-neutral-900 p-6 ring-1 ring-neutral-200 dark:ring-neutral-800 space-y-5">
        <h2 className="text-sm font-medium text-neutral-500">Add expense</h2>

        <form onSubmit={handleAddExpense} className="space-y-4">
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description"
            className="w-full rounded-xl bg-neutral-100 dark:bg-neutral-800 px-3 py-2.5 text-sm"
            required
          />

          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="w-full rounded-xl bg-neutral-100 dark:bg-neutral-800 px-3 py-2.5 text-sm"
            required
          />

          {/* SPLIT TYPE TOGGLE */}
          <div className="flex gap-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1">
            {(["EQUAL", "EXACT", "PERCENT"] as SplitType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSplitType(type)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
                  splitType === type
                    ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow"
                    : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* SPLIT INPUTS */}
          {splitType !== "EQUAL" && (
            <div className="space-y-2">
              {group.members.map((memberId) => (
                <div
                  key={memberId}
                  className="flex justify-between items-center text-sm"
                >
                  <span className="text-neutral-600 dark:text-neutral-300">
                    {getUserName(memberId)}
                  </span>

                  <div className="relative w-24">
                    <input
                      type="number"
                      value={splitValues[memberId] || ""}
                      onChange={(e) =>
                        setSplitValues({
                          ...splitValues,
                          [memberId]: e.target.value,
                        })
                      }
                      className="w-full rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2 py-1.5 text-right text-sm"
                    />
                    <span className="absolute right-2 top-1.5 text-xs text-neutral-400">
                      {splitType === "EXACT" ? "$" : "%"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {splitType === "EQUAL" && amount && (
            <p className="text-xs text-neutral-500 text-center">
              Split equally: $
              {(parseFloat(amount) / group.members.length).toFixed(2)} per
              person
            </p>
          )}

          <button className="w-full rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-2.5 text-sm font-medium">
            Save expense
          </button>
        </form>
      </section>
    </main>
  );
}
