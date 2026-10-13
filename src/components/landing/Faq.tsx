import { Plus } from "lucide-react";
import type React from "react";

const QUESTIONS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Do I need to install anything?",
    a: "No. ovrly runs in the browser. Every overlay has its own URL that you add to OBS (or any streaming software with browser sources) once, and from then on every change shows up there live.",
  },
  {
    q: "Why can I only sign in with Twitch?",
    a: "Overlays are shared by Twitch name, so your mods and teammates can find you without swapping emails. Signing in with Twitch also lets ovrly read your channel's stats for variables like followers and viewers.",
  },
  {
    q: "Can my mods update the overlay without access to my account?",
    a: "Yes. Share one overlay or all of them with someone's Twitch name and pick a role: viewers can watch, controllers change the content (counters, timers, text) and editors change the design too. Only you can share or delete.",
  },
  {
    q: "What are variables?",
    a: "Named values that fields are bound to, like a title's text, a counter's value or a colour. ovrly keeps Twitch stats and your Spotify player up to date by itself, and your own apps can send variables through the public API. Whatever is bound to one updates everywhere at once.",
  },
  {
    q: "Can I show the song I'm listening to?",
    a: "Connect Spotify under Settings and bind any text, image or progress bar to the track, artist, cover or progress. The colours even follow the album cover.",
  },
  {
    q: "Which elements are there?",
    a: "Titles, counters, timers, countdowns, subathon timers, progress bars, icons, images, videos (with transparency), bingo cards, Twitch chat, rectangles, groups, scrollers and cycle stacks. Start from an empty canvas or a template.",
  },
  {
    q: "Can I reuse elements across overlays?",
    a: "Save any element or group as a component, insert copies into any overlay, and share it with others as a file or a link.",
  },
  {
    q: "Is my overlay URL public?",
    a: "The browser source URL has to work in OBS without signing in, so anyone who has it can see the overlay, never edit it. It only carries the variables the overlay actually shows.",
  },
];

// Native <details> so it works without JavaScript; the open state rotates the plus.
export const Faq: React.FC = () => (
  <div className="divide-y rounded-2xl border bg-card/60">
    {QUESTIONS.map(({ q, a }) => (
      <details key={q} className="group px-6 [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 font-medium outline-none select-none focus-visible:text-primary">
          {q}
          <Plus className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-45" />
        </summary>
        <p className="faq-answer pb-5 leading-relaxed text-muted-foreground">{a}</p>
      </details>
    ))}
  </div>
);
