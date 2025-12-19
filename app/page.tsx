"use client";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import { CheckCircle2 } from "lucide-react";
import { Id } from "../convex/_generated/dataModel";
import { ModeToggle } from "@/components/mode-toggle"; // <--- Import Toggle

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

  const handleSettle = async (friendId: string, friendName: string, amount: number) => {
    if (!confirm(`Mark that you paid ${friendName} $${amount.toFixed(2)}?`)) return;
    try {
      const groupName = await settleGlobal({ 
        friendId: friendId as Id<"users">, 
        amount 
      });
      alert(`Settlement recorded in group: "${groupName}"`);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center p-10 transition-colors duration-300">
      <div className="w-full max-w-md space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expense Share</h1>
          <div className="flex items-center gap-4">
            <ModeToggle />
            <UserButton  />
          </div>
        </div>

        {/* --- GLOBAL STATUS CARD --- */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Overall Status</h2>
          {globalDebts === undefined ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">Loading...</p>
          ) : globalDebts.length === 0 ? (
            <div className="flex flex-col items-center text-center p-4">
               <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-2">
                 <CheckCircle2 className="text-green-600 dark:text-green-400 w-6 h-6" />
               </div>
               <p className="text-gray-900 dark:text-white font-medium">You are all settled up!</p>
               <p className="text-gray-500 dark:text-gray-400 text-xs">No debts found across any groups.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {globalDebts.map((debt, idx) => (
                <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-900 dark:text-white">{debt.friendName}</span>
                    <div className="text-right">
                      <span className={`block text-xs font-bold uppercase ${debt.amount > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {debt.amount > 0 ? "owes you" : "you owe"}
                      </span>
                      <span className={`font-mono font-bold text-lg ${debt.amount > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        ${Math.abs(debt.amount).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* SETTLE BUTTON */}
                  {debt.amount < -0.01 && (
                    <button
                      onClick={() => handleSettle(debt.friendId, debt.friendName, Math.abs(debt.amount))}
                      className="w-full mt-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 rounded shadow-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Settle Up
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Group Card */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New Group</h2>
          <div className="space-y-4">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Trip to Goa"
              className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 rounded-md focus:ring-2 focus:ring-black dark:focus:ring-white outline-none text-gray-900 dark:text-white placeholder-gray-500"
            />
            <button
              onClick={handleCreate}
              disabled={!groupName}
              className="w-full bg-gray-900 dark:bg-white text-white dark:text-black py-2 rounded-md hover:bg-black dark:hover:bg-gray-200 disabled:opacity-50 font-medium transition-colors"
            >
              Create Group
            </button>
          </div>
        </div>

        {/* List of My Groups */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">My Groups</h2>
          {myGroups?.map((group) => (
            <button
              key={group._id}
              onClick={() => router.push(`/groups/${group._id}`)}
              className="w-full text-left bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600 transition-colors flex justify-between items-center group"
            >
              <div>
                <span className="font-semibold text-gray-900 dark:text-white block">{group.name}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{group.members.length} members</span>
              </div>
              <span className="text-gray-400 dark:text-gray-600 group-hover:text-gray-900 dark:group-hover:text-white">→</span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}