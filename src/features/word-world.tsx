// Word -> world, in the app: a text box in the dice's Keep popover, a Modes item that asks for a
// word, and ?seed=<word> in the address.
import * as React from "react"
import { Sprout } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { replaceWorld } from "@/store"

import type { Feature } from "./index"
import { normalWord, wordSeed, wordWorld } from "./words"

/** Grow the world a word makes and show it. */
export function growWord(word: string) { if (!normalWord(word)) return false; replaceWorld(wordWorld(word), "word"); return true }

const IDEAS = ["Velvet", "Harbour", "Tokyo", "Marigold", "Static", "Lighthouse", "Juniper", "Neptune"]

/** A one-line box: type a word, press Enter, a world grows. */
export function WordBox({ onDone, className, autoFocus }: { onDone?: () => void; className?: string; autoFocus?: boolean }) {
  const [word, setWord] = React.useState(""); const [hint] = React.useState(() => IDEAS[Math.floor(Math.random() * IDEAS.length)])
  const go = () => { if (growWord(word)) { setWord(""); onDone?.() } }
  return (
    <form className={cn("flex items-center gap-1", className)} onSubmit={(e) => { e.preventDefault(); go() }}>
      <input value={word} onChange={(e) => setWord(e.target.value.slice(0, 60))} placeholder={`A word, e.g. ${hint}`} aria-label="A word to grow a world from" spellCheck={false} autoFocus={autoFocus}
        onKeyDown={(e) => e.stopPropagation()} data-testid="word-input"
        className="h-7 min-w-0 flex-1 rounded-md bg-muted/60 px-2 text-[12.5px] outline-none placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-ring" />
      <Button type="submit" variant="glass" size="sm" disabled={!normalWord(word)} data-testid="word-go"><Sprout /> Grow</Button>
    </form>
  )
}

let openAsk: (v: boolean) => void = () => {}
function AskForWord() {
  const [open, setOpen] = React.useState(false); React.useEffect(() => { openAsk = setOpen; return () => { openAsk = () => {} } }, [])
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[min(420px,94vw)]">
        <DialogHeader><DialogTitle>World from a word</DialogTitle>
          <DialogDescription>Type a name, a band, a city, anything. The same word grows the same world on any computer.</DialogDescription></DialogHeader>
        <WordBox autoFocus onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

if (typeof window !== "undefined") (window as any).__words = { wordWorld, wordSeed, normalWord, growWord }

export const wordWorldFeature: Feature = {
  id: "word", label: "World from a word", about: "Type any word and a world grows from it. Same word, same world.", icon: Sprout,
  run: () => openAsk(true), Overlay: AskForWord,
  boot: (q) => { const w = q.get("seed"); if (w) growWord(w) },
}
