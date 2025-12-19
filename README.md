# Explit - Expense Splitter

A modern, full-stack expense sharing application built with **Next.js 14**, **Convex**, and **Clerk**. This app simplifies sharing expenses with friends, tracking balances, and calculating the most efficient way to settle debts ("Smart Settlements") across different groups.

## 🚀 Features

- **Authentication:** Secure Sign-in/Sign-up using Clerk (Google, Email, Phone number).
- **Group Management:** Create groups and add members by Username or Email.
- **Expense Splitting:** - **Equal Split:** Divide equally among all members.
  - **Exact Amount:** Specify exactly how much each person owes.
  - **Percentage:** Split based on specific percentages.
- **Smart Settlements:** - **Local Context:** See balances within a specific group.
  - **Global Context:** The app automatically offsets debts across *different* groups. (e.g., If you owe Bob $50 in "Trip" but he owes you $50 in "Dinner", your total debt is $0).
- **Settle Up:** Record payments to clear debts directly from the Dashboard or Group page.
- **Expense History:** Audit trail of all expenses and payments.
- **Admin Controls:** Only the group creator can delete a group (with cascade delete protection).
- **Responsive UI:** Clean, mobile-friendly interface built with Tailwind CSS.

## 🛠️ Tech Stack

- **Frontend:** [Next.js 14](https://nextjs.org/) (App Router), React, Tailwind CSS
- **Backend & Database:** [Convex](https://www.convex.dev/) (Real-time, Serverless)
- **Authentication:** [Clerk](https://clerk.com/)
- **Icons:** [Lucide React](https://lucide.dev/)

## ⚙️ Prerequisites

- Node.js (v18 or higher)
- npm or pnpm

## 📦 Installation & Setup

1. **Clone the repository**
   ```bash
   git clone [https://github.com/your-username/expense-share.git](https://github.com/your-username/expense-share.git)
   cd expense-share
   ```

2. **Install dependencies**
    ```bash
    npm install
    # or
    pnpm install
    ```

3. **Setup Environment Variables** Create a ```.env.local``` file in the root directory:
    ```bash
    touch .env.local
    ```

Add the following keys (get these from your Clerk and Convex dashboards):

    ```Code Snippet
    # Convex
    CONVEX_DEPLOYMENT=your_convex_deployment_name
    NEXT_PUBLIC_CONVEX_URL=your_convex_url

    # Clerk
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
    CLERK_SECRET_KEY=your_clerk_secret_key
    CLERK_ISSUER_URL=your_secret_issuer_url

    # Clerk URLs
    NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
    NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
    ```
4. **Initialize Convex** Login to Convex and set up your project:
    ```bash
    npx convex dev
    ```

5. **Configure Clerk JWT**
    - Go to your [Clerk Dashboard](https://www.bing.com/ck/a?!&&p=9d816ceab13beb7be197d9daa475112d8bedbff90f27c26dd69e5723b8b4a92dJmltdHM9MTc2NjAxNjAwMA&ptn=3&ver=2&hsh=4&fclid=188c6fab-ec06-6cbf-0a66-792ded4e6d02&psq=clerk+authentication&u=a1aHR0cHM6Ly9kYXNoYm9hcmQuY2xlcmsuY29tL3NpZ24tdXA) > JWT Templates.
    - Create a new template named convex.
    - Copy the Issuer URL and update convex/auth.config.ts if necessary.

6. **Run the Development Server** Open a new terminal (leave ```npx convex dev``` running in the first one):
    ```bash
    npm run dev
    ```
7. **Open the App** Visit http://localhost:3000 in your browser.

## Project Structure
```
├── app/
│   ├── groups/[id]/page.tsx  # Dynamic Group Page (Balances, Expenses)
│   ├── sign-in/              # Clerk Sign In Page
│   ├── sign-up/              # Clerk Sign Up Page
│   ├── layout.tsx            # Root Layout & Providers
│   └── page.tsx              # Dashboard (Global Debts, My Groups)
├── convex/
│   ├── schema.ts             # Database Schema (Users, Groups, Expenses, Splits)
│   ├── users.ts              # User logic (Store, Get)
│   ├── groups.ts             # Group logic (Create, Add Member, Delete)
│   ├── expenses.ts           # Complex Debt Logic & Queries
│   └── auth.config.ts        # Clerk Integration config
├── middleware.ts             # Route protection
└── components/               # (Optional) Reusable UI components
```

## How the Algorithm Works
The app uses a **Net Balance** approach rather than a direct graph simplification:

**Calculate Net Balance**: For every user, calculate **Total Paid - Total Owed**.

**Global Aggregation:** Sum these balances across all groups the user is part of.

**Settlement Matching:** - Separate users into Debtors (Negative balance) and Creditors (Positive balance).
    
- Match them greedily to generate the minimum number of transactions required to settle the total debt.