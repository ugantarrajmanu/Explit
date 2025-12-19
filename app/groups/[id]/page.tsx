"use client";
import { useState, use } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";

export default function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useUser();
  const groupId = id as Id<"groups">;
  const router = useRouter();

  // --- STATE ---
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [splitType, setSplitType] = useState<"EQUAL" | "EXACT" | "PERCENT">("EQUAL");
  const [inputValue, setInputValue] = useState("");
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});

  // --- QUERIES & MUTATIONS ---
  const createExpense = useMutation(api.expenses.createExpense);
  const addMember = useMutation(api.groups.addMember);
  const deleteGroup = useMutation(api.groups.deleteGroup);
  
  // Fetch everything we need
  const group = useQuery(api.groups.get, { id: groupId });
  const users = useQuery(api.users.getAll);
  const groupAdmin = useQuery(api.groups.getGroupAdmin, { groupId });
  const expensesList = useQuery(api.expenses.getExpenses, { groupId });
  const balanceData = useQuery(api.expenses.getGroupBalance, { groupId });

  // Unpack balance data safely
  const balances = balanceData?.balances || {};
  const localSettlements = balanceData?.localSettlements || [];
  const globalSettlements = balanceData?.globalSettlements || [];

  const isAdmin = groupAdmin?.tokenIdentifier.includes(user?.id || "");

  // --- HELPERS ---
  const getUserName = (id: string) => users?.find((u) => u._id === id)?.name || "Unknown";
  
  const getGlobalContext = (fromId: string, toId: string) => {
    return globalSettlements.find(s => s.from === fromId && s.to === toId);
  };

  // --- HANDLERS ---
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addMember({ groupId, usernameOrEmail: inputValue });
      setInputValue("");
    } catch (err) {
      alert("Failed to add user. Check username/email.");
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm("Are you sure you want to delete this group? This cannot be undone.")) return;
    
    try {
      await deleteGroup({ groupId });
      router.push("/"); // Redirect to dashboard
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    
    const splitData = group?.members.map(memberId => ({
        userId: memberId,
        value: parseFloat(splitValues[memberId] || "0"),
    })) || [];

    try {
      await createExpense({
        groupId,
        amount: numAmount,
        description: desc,
        splitType,
        splitData: splitType === "EQUAL" ? undefined : splitData,
      });
      setDesc("");
      setAmount("");
      setSplitValues({});
      setSplitType("EQUAL");
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  if (!group || !users || !balanceData) return <div className="p-10">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* 1. HEADER */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{group.name}</h1>
              <div className="flex gap-2 text-sm text-gray-500">
                <span>{group.members.length} members</span>
                <span>•</span>
                <span className="text-indigo-600 font-medium">
                  Admin: {groupAdmin?.name || "Loading..."}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* ONLY SHOW DELETE BUTTON IF ADMIN */}
            {isAdmin && (
              <button
                onClick={handleDeleteGroup}
                className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                title="Delete Group (Admin Only)"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <UserButton />
          </div>
        </div>


        {/* 2. ADD MEMBER */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">Add Member</h2>
          <form onSubmit={handleAddMember} className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Username or Email"
              className="flex-1 border border-gray-300 p-2 rounded-md text-sm text-gray-900"
              required
            />
            <button type="submit" className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm hover:bg-black">
              Add
            </button>
          </form>
        </div>

        {/* 3. NET BALANCES (Overview) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-h-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Member Balances</h2>
          </div>
          
          <div className="space-y-3">
            {group.members.map((memberId) => {
               // 1. Calculate Effective Balance from Global Settlements
               let effectiveBalance = 0;
               globalSettlements.forEach(s => {
                 if (s.from === memberId) effectiveBalance -= s.amount; 
                 if (s.to === memberId) effectiveBalance += s.amount;   
               });

               const localBal = balances[memberId] || 0;
               const isSettledGlobally = Math.abs(effectiveBalance) < 0.01;
               const hasLocalDebt = Math.abs(localBal) > 0.01;

               // Hide if they have $0 balance globally AND locally
               if (isSettledGlobally && !hasLocalDebt) return null;

               const isPositive = effectiveBalance > 0;
               const isNegative = effectiveBalance < -0.01;
               
               return (
                 <div key={memberId} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                   <div className="flex items-center gap-2">
                     <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-xs font-bold text-gray-700">
                        {getUserName(memberId).charAt(0).toUpperCase()}
                     </div>
                     <span className="font-medium text-gray-900">{getUserName(memberId)}</span>
                   </div>

                   <div className="text-right">
                     {/* MAIN BALANCE: +/- Value */}
                     <span className={`block font-mono font-bold text-lg ${
                       isSettledGlobally ? "text-gray-400" : (isPositive ? "text-green-600" : "text-red-600")
                     }`}>
                       {isSettledGlobally 
                         ? "Settled" 
                         : `${isPositive ? "+" : ""}${effectiveBalance.toFixed(2)}`
                       }
                     </span>
                     
                     {/* Local Context (Crossed out if different) */}
                     {Math.abs(effectiveBalance - localBal) > 0.01 && (
                       <span className="text-xs text-gray-400 line-through block">
                         Local: {localBal > 0 ? "+" : ""}{localBal.toFixed(2)}
                       </span>
                     )}
                   </div>
                 </div>
               )
            })}
          </div>
        </div>

        
        {/* 5. EXPENSE HISTORY */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">History</h2>
          {expensesList && expensesList.length > 0 ? (
            <div className="space-y-2">
              {expensesList.map((exp) => (
                <div key={exp._id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                   <div>
                     <p className="font-medium text-gray-900 text-sm">{exp.description}</p>
                     <p className="text-xs text-gray-500">{exp.payerName} paid</p>
                   </div>
                   <span className="font-bold text-gray-900 text-sm">${exp.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm italic">No expenses yet.</p>
          )}
        </div>

        {/* 6. ADD EXPENSE FORM */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">Add Shared Expense</h2>
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input 
                type="text" 
                placeholder="Description" 
                value={desc} 
                onChange={e => setDesc(e.target.value)}
                className="border border-gray-300 p-2 rounded text-sm w-full text-gray-900"
              />
              <input 
                type="number" 
                placeholder="Amount ($)" 
                value={amount} 
                onChange={e => setAmount(e.target.value)}
                className="border border-gray-300 p-2 rounded text-sm w-full text-gray-900"
                required
                min="0.01"
                step="0.01"
              />
            </div>

            {/* Split Type Selector */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
              {(["EQUAL", "EXACT", "PERCENT"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSplitType(type)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    splitType === type ? "bg-white shadow text-black" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Split Inputs */}
            <div className="space-y-2 max-h-48 overflow-y-auto border-t pt-2">
              {splitType === "EQUAL" && (
                <p className="text-xs text-gray-500 text-center italic py-2">
                  Split equally: ${(parseFloat(amount || "0") / group.members.length).toFixed(2)} / person
                </p>
              )}

              {splitType !== "EQUAL" && group.members.map(memberId => {
                const member = users.find(u => u._id === memberId);
                return (
                  <div key={memberId} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{member?.name}</span>
                    <div className="relative w-24">
                        <input
                            type="number"
                            value={splitValues[memberId] || ""}
                            onChange={(e) => setSplitValues({...splitValues, [memberId]: e.target.value})}
                            placeholder="0"
                            className="w-full border p-1 rounded text-right pr-6"
                        />
                        <span className="absolute right-2 top-1 text-gray-400 text-xs">
                            {splitType === "EXACT" ? "$" : "%"}
                        </span>
                    </div>
                  </div>
                )
              })}
            </div>

            <button type="submit" className="w-full bg-gray-900 text-white py-2 rounded-md hover:bg-black">
              Save Expense
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}