"use client";
import { useState, use } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { UserButton, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, CheckCircle2 } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle"; // <--- Import

export default function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const groupId = id as Id<"groups">;
  const router = useRouter();
  const { user } = useUser();

  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [splitType, setSplitType] = useState<"EQUAL" | "EXACT" | "PERCENT">("EQUAL");
  const [inputValue, setInputValue] = useState("");
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});

  const createExpense = useMutation(api.expenses.createExpense);
  const addMember = useMutation(api.groups.addMember);
  const deleteGroup = useMutation(api.groups.deleteGroup);
  const recordSettlement = useMutation(api.expenses.recordSettlement);

  const group = useQuery(api.groups.get, { id: groupId });
  const users = useQuery(api.users.getAll);
  const groupAdmin = useQuery(api.groups.getGroupAdmin, { groupId });
  const expensesList = useQuery(api.expenses.getExpenses, { groupId });
  const balanceData = useQuery(api.expenses.getGroupBalance, { groupId });

  const balances = balanceData?.balances || {};
  const localSettlements = balanceData?.localSettlements || [];
  const globalSettlements = balanceData?.globalSettlements || [];

  const getUserName = (id: string) => users?.find((u) => u._id === id)?.name || "Unknown";
  const myDbId = users?.find(u => user?.id && u.tokenIdentifier.includes(user.id))?._id;
  const getGlobalContext = (fromId: string, toId: string) => globalSettlements.find(s => s.from === fromId && s.to === toId);
  const isAdmin = groupAdmin?.tokenIdentifier.includes(user?.id || "");

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await addMember({ groupId, usernameOrEmail: inputValue }); setInputValue(""); } catch (err) { alert("Failed to add user."); }
  };

  const handleSettle = async (toUserId: Id<"users">, amount: number) => {
    if(!confirm(`Mark that you paid ${getUserName(toUserId)} $${amount.toFixed(2)}?`)) return;
    try { await recordSettlement({ groupId, toUserId, amount }); } catch(err: any) { alert("Error: " + err.message); }
  };

  const handleDeleteGroup = async () => {
    if (!confirm("Delete this group? This cannot be undone.")) return;
    try { await deleteGroup({ groupId }); router.push("/"); } catch (err: any) { alert("Error: " + err.message); }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    const splitData = group?.members.map(memberId => ({ userId: memberId, value: parseFloat(splitValues[memberId] || "0") })) || [];
    try {
      await createExpense({ groupId, amount: numAmount, description: desc, splitType, splitData: splitType === "EQUAL" ? undefined : splitData });
      setDesc(""); setAmount(""); setSplitValues({}); setSplitType("EQUAL");
    } catch (err: any) { alert("Error: " + err.message); }
  };

  if (!group || !users || !balanceData) return <div className="p-10 dark:text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 transition-colors duration-300">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* 1. HEADER */}
        <div className="flex justify-between items-center bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{group.name}</h1>
              <div className="flex gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span>{group.members.length} members</span>
                <span>•</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">Admin: {groupAdmin?.name || "..."}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <ModeToggle />
            {isAdmin && (
              <button onClick={handleDeleteGroup} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <UserButton />
          </div>
        </div>

        {/* 2. ADD MEMBER */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Add Member</h2>
          <form onSubmit={handleAddMember} className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Username or Email"
              className="flex-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2 rounded-md text-sm"
              required
            />
            <button type="submit" className="bg-gray-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded-md text-sm hover:bg-black dark:hover:bg-gray-200">
              Add
            </button>
          </form>
        </div>

        {/* 3. MEMBER BALANCES */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Member Balances</h2>
            <span className="text-xs font-medium px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full">
              Global Context Active
            </span>
          </div>
          <div className="space-y-3">
            {group.members.map((memberId) => {
               let effectiveBalance = 0;
               globalSettlements.forEach(s => { if (s.from === memberId) effectiveBalance -= s.amount; if (s.to === memberId) effectiveBalance += s.amount; });
               const localBal = balances[memberId] || 0;
               const isSettledGlobally = Math.abs(effectiveBalance) < 0.01;
               const hasLocalDebt = Math.abs(localBal) > 0.01;
               if (isSettledGlobally && !hasLocalDebt) return null;
               const isPositive = effectiveBalance > 0;
               
               return (
                 <div key={memberId} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                   <div className="flex items-center gap-2">
                     <div className="w-8 h-8 bg-gray-300 dark:bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-gray-700 dark:text-gray-300">
                        {getUserName(memberId).charAt(0).toUpperCase()}
                     </div>
                     <span className="font-medium text-gray-900 dark:text-white">{getUserName(memberId)}</span>
                   </div>
                   <div className="text-right">
                     <span className={`block font-mono font-bold text-lg ${isSettledGlobally ? "text-gray-400 dark:text-gray-500" : (isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}`}>
                       {isSettledGlobally ? "Settled" : `${isPositive ? "+" : ""}${effectiveBalance.toFixed(2)}`}
                     </span>
                     {Math.abs(effectiveBalance - localBal) > 0.01 && (
                       <span className="text-xs text-gray-400 dark:text-gray-500 line-through block">Local: {localBal > 0 ? "+" : ""}{localBal.toFixed(2)}</span>
                     )}
                   </div>
                 </div>
               )
            })}
          </div>
        </div>

        {/* 4. SETTLEMENT PLAN */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Settlement Plan</h2>
          {localSettlements.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm italic">All debts are settled!</p>
          ) : (
            <div className="space-y-3">
              {localSettlements.map((payment, idx) => {
                const globalPay = getGlobalContext(payment.from, payment.to);
                const isFullySettled = !globalPay;
                const isPartiallySettled = globalPay && globalPay.amount < payment.amount;
                const isMyDebt = myDbId === payment.from;
                const amountToPay = globalPay ? globalPay.amount : 0;

                return (
                  <div key={idx} className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                        <span className="font-semibold text-red-600 dark:text-red-400">{getUserName(payment.from)}</span>
                        <span className="text-gray-400 text-sm">owes</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">{getUserName(payment.to)}</span>
                      </div>
                      <span className={`font-mono font-bold ${isFullySettled || isPartiallySettled ? "text-gray-400 line-through text-xs" : "text-gray-900 dark:text-white"}`}>
                        ${payment.amount.toFixed(2)}
                      </span>
                    </div>

                    {isFullySettled && (
                       <div className="flex items-center justify-between bg-green-100 dark:bg-green-900/30 p-2 rounded text-sm">
                        <span className="text-green-800 dark:text-green-300 font-medium text-xs flex items-center gap-1">✨ Fully Settled</span>
                        <span className="font-mono font-bold text-green-700 dark:text-green-400">$0.00</span>
                      </div>
                    )}
                    {isPartiallySettled && (
                      <div className="flex items-center justify-between bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded text-sm">
                        <span className="text-yellow-800 dark:text-yellow-300 font-medium text-xs">✨ Partial Settle</span>
                        <span className="font-mono font-bold text-yellow-700 dark:text-yellow-400">Pay ${amountToPay.toFixed(2)}</span>
                      </div>
                    )}
                    {isMyDebt && !isFullySettled && (
                      <button onClick={() => handleSettle(payment.to as Id<"users">, amountToPay || payment.amount)} className="mt-2 w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2 rounded-md text-sm font-medium transition-colors">
                        <CheckCircle2 className="w-4 h-4" />
                        Settle Up (${(amountToPay || payment.amount).toFixed(2)})
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. HISTORY */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">History</h2>
          {expensesList && expensesList.length > 0 ? (
            <div className="space-y-2">
              {expensesList.map((exp) => (
                <div key={exp._id} className="flex justify-between items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors">
                   <div>
                     <p className="font-medium text-gray-900 dark:text-white text-sm">{exp.description}</p>
                     <p className="text-xs text-gray-500 dark:text-gray-400">{exp.payerName} paid</p>
                   </div>
                   <span className="font-bold text-gray-900 dark:text-white text-sm">${exp.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm italic">No expenses yet.</p>
          )}
        </div>

        {/* 6. ADD EXPENSE FORM */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Add Shared Expense</h2>
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input type="text" placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2 rounded text-sm w-full" required />
              <input type="number" placeholder="Amount ($)" value={amount} onChange={e => setAmount(e.target.value)} className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-2 rounded text-sm w-full" required min="0.01" step="0.01" />
            </div>

            <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
              {(["EQUAL", "EXACT", "PERCENT"] as const).map((type) => (
                <button key={type} type="button" onClick={() => setSplitType(type)} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${splitType === type ? "bg-white dark:bg-gray-700 shadow text-black dark:text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"}`}>{type}</button>
              ))}
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto border-t dark:border-gray-700 pt-2">
              {splitType === "EQUAL" && (<p className="text-xs text-gray-500 dark:text-gray-400 text-center italic py-2">Split equally: ${(parseFloat(amount || "0") / group.members.length).toFixed(2)} / person</p>)}
              {splitType !== "EQUAL" && group.members.map(memberId => (
                  <div key={memberId} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{users?.find(u => u._id === memberId)?.name}</span>
                    <div className="relative w-24">
                        <input type="number" value={splitValues[memberId] || ""} onChange={(e) => setSplitValues({...splitValues, [memberId]: e.target.value})} placeholder="0" className="w-full border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-1 rounded text-right pr-6" />
                        <span className="absolute right-2 top-1 text-gray-400 text-xs">{splitType === "EXACT" ? "$" : "%"}</span>
                    </div>
                  </div>
              ))}
            </div>

            <button type="submit" className="w-full bg-gray-900 dark:bg-white text-white dark:text-black py-2 rounded-md hover:bg-black dark:hover:bg-gray-200 transition-colors">
              Save Expense
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}