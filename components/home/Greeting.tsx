"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function compute() {
  const now = new Date();
  const day = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;
  const hour = now.getHours();
  let greet = "good evening";
  if (hour < 5) greet = "still up";
  else if (hour < 12) greet = "good morning";
  else if (hour < 17) greet = "good afternoon";
  return { day, greet };
}

function firstName(value: string | null | undefined): string {
  if (!value) return "there";
  const trimmed = value.trim();
  const parts = trimmed.split(/\s+/);
  if (parts[0]) return parts[0];
  return trimmed.split("@")[0] ?? "there";
}

export default function Greeting() {
  const [{ day, greet }, setVal] = useState(() => compute());
  const { data: session } = useSession();
  const name = firstName(session?.user?.name ?? session?.user?.email);

  useEffect(() => {
    const id = setInterval(() => setVal(compute()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <h1 className="greeting">
      <span>{day}</span>
      <br />
      <span className="it">{greet}, {name}.</span>
    </h1>
  );
}
