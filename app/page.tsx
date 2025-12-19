"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useRouter } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { 
  Plus, 
  Users, 
  ArrowRight, 
  Sparkles,
  Search
} from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";

export default function Home() {
  const { user } = useUser();
  const router = useRouter();
  
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Queries & Mutations
  const storeUser = useMutation(api.users.store);
  const createGroup = useMutation(api.groups.create);
  const myGroups = useQuery(api.groups.getMyGroups);

  // Sync User with Convex
  if (user) {
    storeUser({});
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    
    setIsCreating(true);
    try {
      const groupId = await createGroup({ name: newGroupName });
      setNewGroupName("");
      router.push(`/groups/${groupId}`);
    } catch (error) {
      console.error(error);
      alert("Failed to create group");
    } finally {
      setIsCreating(false);
    }
  };

  const filteredGroups = myGroups?.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      
      {/* NAVBAR */}
      <nav className="sticky top-0 z-100 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-6xl px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* <div className="bg-neutral-900 dark:bg-white text-white dark:text-black p-2 rounded-xl">
              <Wallet className="h-6 w-6" />
            </div> */}
            <span className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">Explit</span>
          </div>
          <div className="flex items-center gap-4">
            <ModeToggle />
            <UserButton />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-12 space-y-12">
        
        {/* HERO / CREATE SECTION */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Welcome Card (THEME FIXED) */}
          <div className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white rounded-3xl p-8 shadow-sm border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between relative overflow-hidden group transition-colors">
            <div className="relative z-10">
              <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.firstName} 👋</h1>
              <p className="text-neutral-500 dark:text-neutral-400 max-w-md">
                Keep track of your shared expenses and settle up with friends and family easily.
              </p>
            </div>
            
            <div className="relative z-10 mt-8 flex gap-3">
              <div className="bg-neutral-50 dark:bg-neutral-800 px-4 py-3 rounded-2xl border border-neutral-100 dark:border-neutral-700 flex items-center gap-3">
                <div className="bg-emerald-100 dark:bg-emerald-500/20 p-2 rounded-lg text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-neutral-400 uppercase font-bold">Total Groups</div>
                  <div className="text-xl font-bold">{myGroups?.length || 0}</div>
                </div>
              </div>
            </div>

            {/* Decor - Adapts to theme
            <div className="absolute right-0 bottom-0 opacity-5 dark:opacity-10 transform translate-x-10 translate-y-10 pointer-events-none">
              <CreditCard className="h-64 w-64 text-neutral-900 dark:text-white" />
            </div> */}
          </div>

          {/* Create Group Card */}
          <div className="bg-white dark:bg-neutral-900 rounded-3xl p-8 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-center">
             <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-neutral-900 dark:text-white">
               <Plus className="h-5 w-5 text-blue-500" /> Create a new group
             </h2>
             <form onSubmit={handleCreateGroup} className="space-y-4">
               <div>
                 <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">Group Name</label>
                 <input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. Goa Trip, Apartment 404"
                    className="w-full mt-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white px-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white transition-all placeholder:text-neutral-400"
                 />
               </div>
               <button 
                  disabled={isCreating || !newGroupName}
                  className="w-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-3.5 rounded-xl font-bold hover:opacity-90 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
               >
                  {isCreating ? (
                    <span className="animate-pulse">Creating...</span>
                  ) : (
                    <>Create Group <ArrowRight className="h-4 w-4" /></>
                  )}
               </button>
             </form>
          </div>
        </section>

        {/* GROUPS LIST */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center gap-2 text-neutral-900 dark:text-white">
              <Users className="h-5 w-5" /> Your Groups
            </h3>
            
            {/* Search Bar */}
            <div className="relative hidden md:block w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search groups..."
                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-full py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400"
              />
            </div>
          </div>

          {myGroups === undefined ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-40 bg-neutral-200 dark:bg-neutral-800 rounded-3xl animate-pulse" />
                ))}
             </div>
          ) : myGroups.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-neutral-900 rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800">
              <div className="mx-auto h-16 w-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-neutral-400" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">No groups yet</h3>
              <p className="text-neutral-500 max-w-sm mx-auto mt-2">
                Create your first group above to start splitting expenses with friends.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGroups?.map((g) => (
                <div
                  key={g._id}
                  onClick={() => router.push(`/groups/${g._id}`)}
                  className="group cursor-pointer bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-lg transition-all relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/20">
                      {g.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="bg-neutral-100 dark:bg-neutral-800 p-2 rounded-full group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700 transition-colors">
                      <ArrowRight className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-lg mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors text-neutral-900 dark:text-white">{g.name}</h4>
                    <p className="text-sm text-neutral-500 flex items-center gap-1.5">
                      <Users className="h-3 w-3" />
                      {g.members.length} member{g.members.length !== 1 && "s"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}