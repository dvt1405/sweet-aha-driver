"use client";

import dynamic from "next/dynamic";

// Dynamically import to avoid SSR issues in certain environments
const BikeGame = dynamic(() => import("@/components/BikeGame"), { ssr: false });

export default function Home() {
  return (
    <div className="flex h-full items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-5xl flex-col items-center justify-center bg-white dark:bg-black">
        <BikeGame />
      </main>
    </div>
  );
}
