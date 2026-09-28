"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import ShinyText from "@/components/bits/ShinyText";

// Shown while an answer is on its way. A new word every couple of seconds, in random order.
const WORDS = [
  "Thinking",
  "Remembering",
  "Lawyering",
  "Procrastinating",
  "Reading the diary",
  "Checking the order sheet",
  "Seeking an adjournment",
  "Consulting the junior",
  "Citing precedent",
  "Cross-examining the notes",
  "Filing a memo",
  "Waiting for the court master",
  "Hunting for the certified copy",
  "Marking exhibits",
  "Reading between the lines",
  "Deciphering the handwriting",
  "Framing issues",
  "Drafting objections",
  "Arguing with myself",
  "Pleading",
];

const pick = (not?: string) => {
  let w = WORDS[Math.floor(Math.random() * WORDS.length)];
  while (w === not) w = WORDS[Math.floor(Math.random() * WORDS.length)];
  return w;
};

export function ThinkingWords() {
  const [word, setWord] = useState(WORDS[0]);

  useEffect(() => {
    setWord(pick());
    const t = setInterval(() => setWord((w) => pick(w)), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <span role="status" aria-label="Working on the answer" className="text-muted-foreground inline-flex items-center gap-2 text-[15px]">
      <Sparkles className="text-tape size-4 animate-spin [animation-duration:2.4s] motion-reduce:animate-none" aria-hidden />
      <span key={word} className="animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
        <ShinyText text={`${word}…`} color="var(--muted-foreground)" shineColor="var(--foreground)" speed={1.8} />
      </span>
    </span>
  );
}
