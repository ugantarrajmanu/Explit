import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "./ConvexClientProvider";
import { ThemeProvider } from "@/components/theme-provider"; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Expense Share",
  description: "Split expenses easily",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
  <body className="bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-50 antialiased transition-colors duration-300">
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ConvexClientProvider>
        {children}
      </ConvexClientProvider>
    </ThemeProvider>
  </body>
</html>
  );
}