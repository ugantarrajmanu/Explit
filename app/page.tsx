"use client";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UserButton, useUser } from "@clerk/nextjs";

export default function Home() {
  const storeUser = useMutation(api.users.store);
  const createGroup = useMutation(api.groups.create);
  const myGroups = useQuery(api.groups.getMyGroups);
  const globalDebts = useQuery(api.expenses.getGlobalBalances);
  
  const router = useRouter();
  const { user } = useUser();
  const [groupName, setGroupName] = useState("");

  useEffect(() => {
    if (user) {
      storeUser();
    }
  }, [user, storeUser]);

  const handleCreate = async () => {
    const groupId = await createGroup({ name: groupName });
    router.push(`/groups/${groupId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-10">
      <div className="w-full max-w-md space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Expense Share</h1>
          <UserButton afterSignOutUrl="/" />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Overall Status</h2>
          {globalDebts === undefined ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : globalDebts.length === 0 ? (
            <p className="text-gray-500 text-sm italic">You are all settled up!</p>
          ) : (
            <div className="space-y-3">
              {globalDebts.map((debt, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-900">{debt.friendName}</span>
                  <div className="text-right">
                    <span className={`block font-bold ${debt.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                      {debt.amount > 0 ? "owes you" : "you owe"}
                    </span>
                    <span className={`font-mono font-bold ${debt.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                      ${Math.abs(debt.amount).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Group Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Group</h2>
          <div className="space-y-4">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Trip to Goa"
              className="w-full border border-gray-300 p-2 rounded-md focus:ring-2 focus:ring-black outline-none text-gray-900 placeholder-gray-500"
            />
            <button
              onClick={handleCreate}
              disabled={!groupName}
              className="w-full bg-gray-900 text-white py-2 rounded-md hover:bg-black disabled:opacity-50 font-medium"
            >
              Create Group
            </button>
          </div>
        </div>

        {/* List of My Groups */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">My Groups</h2>
          
          {myGroups === undefined ? (
            <p className="text-gray-500">Loading...</p>
          ) : myGroups.length === 0 ? (
            <div className="text-center p-6 bg-white rounded-xl border border-dashed border-gray-300">
              <p className="text-gray-500">You are not in any groups yet.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {myGroups.map((group) => (
                <button
                  key={group._id}
                  onClick={() => router.push(`/groups/${group._id}`)}
                  className="w-full text-left bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:border-gray-400 transition-colors flex justify-between items-center group"
                >
                  <div>
                    <span className="font-semibold text-gray-900 block">{group.name}</span>
                    <span className="text-sm text-gray-500">{group.members.length} members</span>
                  </div>
                  <span className="text-gray-400 group-hover:text-gray-900">→</span>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}