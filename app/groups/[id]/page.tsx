"use client";

import { useState, use } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { UserButton, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Trash2, 
  Banknote, 
  Users, 
  Receipt, 
  Plus, 
  X,
  Percent,
  Divide
} from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";

type SplitType = "EQUAL" | "EXACT" | "PERCENT";

export default function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const groupId = id as Id<"groups">;
  const { user } = useUser();
  const router = useRouter();

  // Form State
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [splitType, setSplitType] = useState<SplitType>("EQUAL");
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});
  const [inputValue, setInputValue] = useState("");

  // API Hooks
  const createExpense = useMutation(api.expenses.createExpense);
  const addMember = useMutation(api.groups.addMember);
  const deleteGroup = useMutation(api.groups.deleteGroup);
  
  const expensesList = useQuery(api.expenses.getExpenses, { groupId });
  const group = useQuery(api.groups.get, { id: groupId });
  const users = useQuery(api.users.getAll);
  const balanceData = useQuery(api.expenses.getGroupBalances, { groupId });

  if (!group || !users || !balanceData) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-neutral-200 dark:bg-neutral-800"></div>
          <div className="h-4 w-32 rounded bg-neutral-200 dark:bg-neutral-800"></div>
        </div>
      </div>
    );
  }

  /* ---------------- HELPERS ---------------- */

  const getUserName = (id: string) =>
    users.find((u) => u._id === id)?.name || "Unknown";

  const myConvexUser = users.find(u => 
    user?.id && u.tokenIdentifier.includes(user.id)
  );
  const myBalance = myConvexUser ? (balanceData[myConvexUser._id] || 0) : 0;

  const getPercentTotal = () => {
    return group.members.reduce((sum, memberId) => {
      return sum + parseFloat(splitValues[memberId] || "0");
    }, 0);
  };

  const hasUnsettledBalances = () => {
    return Object.values(balanceData).some((bal) => Math.abs(bal) > 0.1);
  };

  // Helper to get theme colors based on active split type
  const getTheme = () => {
    switch (splitType) {
      case "EQUAL":
        return {
          color: "purple",
          border: "border-purple-500",
          ring: "ring-purple-500/10",
          text: "text-purple-600 dark:text-purple-400",
          bg: "bg-purple-600 hover:bg-purple-700",
          lightBg: "bg-purple-50 dark:bg-purple-900/20",
          focus: "focus:ring-purple-500/20",
          icon: <Divide className="h-4 w-4" />
        };
      case "PERCENT":
        return {
          color: "blue",
          border: "border-blue-500",
          ring: "ring-blue-500/10",
          text: "text-blue-600 dark:text-blue-400",
          bg: "bg-blue-600 hover:bg-blue-700",
          lightBg: "bg-blue-50 dark:bg-blue-900/20",
          focus: "focus:ring-blue-500/20",
          icon: <Percent className="h-4 w-4" />
        };
      case "EXACT":
        return {
          color: "emerald",
          border: "border-emerald-500",
          ring: "ring-emerald-500/10",
          text: "text-emerald-600 dark:text-emerald-400",
          bg: "bg-emerald-600 hover:bg-emerald-700",
          lightBg: "bg-emerald-50 dark:bg-emerald-900/20",
          focus: "focus:ring-emerald-500/20",
          icon: <Banknote className="h-4 w-4" />
        };
    }
  };

  const theme = getTheme();

  /* ---------------- ACTIONS ---------------- */

  const handleSettleUp = (toUserId: string, toUserName: string) => {
    const theyAreOwed = balanceData[toUserId] || 0;
    const iOwe = Math.abs(myBalance); 
    const suggestedAmount = Math.min(theyAreOwed, iOwe).toFixed(2);

    setDesc(`Settlement to ${toUserName}`);
    setAmount(suggestedAmount);
    setSplitType("EXACT");
    setSplitValues({ [toUserId]: suggestedAmount }); 
    
    // Reset others to 0
    const newSplits: Record<string, string> = {};
    group.members.forEach(m => newSplits[m] = "0");
    newSplits[toUserId] = suggestedAmount;
    setSplitValues(newSplits);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!inputValue.trim()) return;
    try {
      await addMember({ groupId, usernameOrEmail: inputValue.trim().toLowerCase() });
      setInputValue("");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteGroup = async () => {
    if (hasUnsettledBalances()) {
      alert("Please settle all balances before deleting the group.");
      return;
    }
    if (!confirm("Delete this group permanently?")) return;
    try {
      await deleteGroup({ groupId });
      router.push("/");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert("Enter a valid amount.");
      return;
    }

    if (splitType === "PERCENT" && Math.abs(getPercentTotal() - 100) > 0.1) {
      alert("Percent split must total 100%.");
      return;
    }

    const splitData = splitType === "EQUAL" 
      ? undefined 
      : group.members.map((memberId) => ({
          userId: memberId,
          value: parseFloat(splitValues[memberId] || "0"),
        }));

    try {
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
    } catch (err: any) {
      alert(err.message);
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 pb-20">
      
      {/* TOP NAVIGATION */}
      <nav className="sticky top-0 z-10 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push("/")}
              className="p-2 -ml-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-600 dark:text-neutral-400"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-neutral-900 dark:text-white leading-tight">
                {group.name}
              </h1>
              <p className="text-xs text-neutral-500 font-medium">
                {group.members.length} members
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ModeToggle />
            <UserButton />
            <button 
              onClick={handleDeleteGroup} 
              title="Delete Group"
              className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* === LEFT COLUMN (Form & Balances) === */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* ADD MEMBER CARD */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow-sm border border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2 mb-4 text-neutral-900 dark:text-white font-semibold text-sm">
              <Users className="h-4 w-4 text-neutral-500" />
              <span>Add people</span>
            </div>
            <form onSubmit={handleAddMember} className="relative">
              <input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Email address..."
                className="w-full bg-neutral-100 dark:bg-neutral-800 text-sm px-4 py-3 pr-12 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 transition-all placeholder:text-neutral-400"
              />
              <button 
                type="submit"
                disabled={!inputValue}
                className="absolute right-2 top-2 p-1.5 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </form>
          </div>

          {/* DYNAMIC EXPENSE FORM CARD */}
          <div className={`bg-white dark:bg-neutral-900 rounded-2xl p-6 shadow-sm border transition-all duration-300 ring-4 ${theme.border} ${theme.ring}`}>
            
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-sm font-bold flex items-center gap-2 ${theme.text}`}>
                {theme.icon}
                {splitType === 'EQUAL' ? 'Split Equally' : splitType === 'PERCENT' ? 'Split by %' : 'Split Exact'}
              </h2>
              {(amount || desc) && (
                <button 
                  onClick={() => { setSplitType("EQUAL"); setDesc(""); setAmount(""); setSplitValues({}); }}
                  className="text-xs font-medium text-neutral-400 hover:text-neutral-600 flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-md transition-colors"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>

            <form onSubmit={handleAddExpense} className="space-y-5">
              <div className="space-y-3">
                <input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="What is this for?"
                  className={`w-full text-lg font-medium bg-transparent border-b border-neutral-200 dark:border-neutral-800 px-1 py-2 focus:outline-none ${theme.focus} focus:border-transparent transition-colors placeholder:text-neutral-300`}
                  required
                />
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-light text-neutral-400">₹</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-3xl font-bold bg-transparent border-none p-0 focus:outline-none placeholder:text-neutral-200"
                    required
                  />
                </div>
              </div>

              {/* SPLIT TABS */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                {(["EQUAL", "EXACT", "PERCENT"] as SplitType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSplitType(type)}
                    className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                      splitType === type 
                        ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm" 
                        : "text-neutral-500 hover:text-neutral-700"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* DYNAMIC SPLIT FIELDS */}
              {splitType !== "EQUAL" && (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {group.members.map((memberId) => (
                    <div key={memberId} className="flex justify-between items-center p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[10px] font-bold text-neutral-600 dark:text-neutral-300">
                          {getUserName(memberId).charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate w-24">
                          {getUserName(memberId)}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          value={splitValues[memberId] || ""}
                          onChange={(e) => setSplitValues({ ...splitValues, [memberId]: e.target.value })}
                          className={`w-20 text-right text-sm font-medium bg-neutral-100 dark:bg-neutral-800 rounded-md py-1 px-2 focus:outline-none focus:ring-2 ${
                            splitType === 'EXACT' ? 'focus:ring-emerald-500/20' : 'focus:ring-purple-500/20'
                          }`}
                          placeholder="0"
                        />
                         <span className="absolute right-8 top-1.5 text-xs text-neutral-400 pointer-events-none">
                            {splitType === 'EXACT' ? '' : '%'}
                         </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button 
                type="submit"
                className={`w-full py-3.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all active:scale-[0.98] ${theme.bg}`}
              >
                Record Transaction
              </button>
            </form>
          </div>

          {/* BALANCES LIST */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider px-2">Group Balances</h3>
            <div className="grid gap-3">
              {group.members.map((memberId) => {
                const balance = balanceData[memberId] || 0;
                const isSettled = Math.abs(balance) < 0.1;
                const name = getUserName(memberId);
                const isMe = memberId === myConvexUser?._id;
                const showPayButton = !isMe && myBalance < -0.1 && balance > 0.1;

                return (
                  <div key={memberId} className="group bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
                    <div className="flex items-center gap-4">
                       <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm shadow-inner ${
                         isSettled ? 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800' :
                         balance > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                         'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                       }`}>
                          {name.charAt(0).toUpperCase()}
                       </div>
                       <div>
                         <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                           {isMe ? "You" : name}
                         </div>
                         <div className={`text-xs font-medium mt-0.5 ${
                           isSettled ? "text-neutral-400" :
                           balance > 0 ? "text-emerald-600 dark:text-emerald-400" :
                           "text-red-600 dark:text-red-400"
                         }`}>
                           {isSettled ? "Settled up" : 
                            balance > 0 ? `gets ₹${balance.toFixed(2)}` : 
                            `owes ₹${Math.abs(balance).toFixed(2)}`
                           }
                         </div>
                       </div>
                    </div>
                    
                    {showPayButton && (
                      <button 
                        onClick={() => handleSettleUp(memberId, name)}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md shadow-emerald-500/20 hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-500/30 transition-all active:scale-95 flex items-center gap-2"
                      >
                        <Banknote className="h-3.5 w-3.5" /> Pay
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* === RIGHT COLUMN (Activity Feed) === */}
        <div className="lg:col-span-7">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm h-full min-h-[600px] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900">
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Receipt className="h-4 w-4 text-neutral-500" /> Recent Activity
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {expensesList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-neutral-400 space-y-4 opacity-60">
                  <div className="h-16 w-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center">
                    <Receipt className="h-8 w-8" />
                  </div>
                  <p className="text-sm">No expenses yet. Add the first one!</p>
                </div>
              ) : (
                expensesList.map((exp) => (
                  <div 
                    key={exp._id} 
                    className="group flex items-start gap-4 p-4 rounded-2xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors border border-transparent hover:border-neutral-100 dark:hover:border-neutral-700"
                  >
                    <div className={`mt-1 h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-lg ${
                       exp.splitType === 'EQUAL' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' :
                       exp.splitType === 'PERCENT' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/20' :
                       'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20'
                    }`}>
                      {exp.splitType === 'EQUAL' ? <Divide className="h-5 w-5"/> : 
                       exp.splitType === 'PERCENT' ? <Percent className="h-5 w-5"/> : 
                       <Banknote className="h-5 w-5"/>}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm truncate pr-4">
                          {exp.description}
                        </h4>
                        <span className="font-mono font-bold text-neutral-900 dark:text-white text-sm">
                          ₹{exp.amount.toFixed(2)}
                        </span>
                      </div>
                      
                      <p className="text-xs text-neutral-500 mt-1">
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">{exp.payerName}</span> paid
                      </p>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide ${
                        exp.splitType === 'EQUAL' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                        exp.splitType === 'EXACT' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' :
                        'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'
                      }`}>
                        {exp.splitType}
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        {new Date(exp._creationTime).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}