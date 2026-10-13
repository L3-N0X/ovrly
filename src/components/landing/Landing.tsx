import { TwitchIcon } from "@/components/icons/TwitchIcon";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Blocks,
  Clock,
  Eye,
  Gamepad2,
  Grid3x3,
  Hash,
  Hourglass,
  Image,
  Layers,
  ListVideo,
  MessageSquare,
  MonitorPlay,
  MousePointer2,
  Music,
  PenTool,
  Shapes,
  SlidersHorizontal,
  Smile,
  Square,
  Timer,
  Type,
  Users,
  Variable,
  Video,
  Zap,
  type LucideIcon,
} from "lucide-react";
import React from "react";
import { Faq } from "./Faq";
import { HeroPreview } from "./HeroPreview";
import { Reveal, SpotlightCard } from "./Reveal";
import { TwitchSignInButton } from "./TwitchSignInButton";

const ELEMENTS: { icon: LucideIcon; name: string }[] = [
  { icon: Type, name: "Titles" },
  { icon: Hash, name: "Counters" },
  { icon: Timer, name: "Timers" },
  { icon: Hourglass, name: "Countdowns" },
  { icon: Clock, name: "Subathons" },
  { icon: SlidersHorizontal, name: "Progress bars" },
  { icon: MessageSquare, name: "Twitch chat" },
  { icon: Grid3x3, name: "Bingo cards" },
  { icon: Smile, name: "Icons" },
  { icon: Image, name: "Images" },
  { icon: Video, name: "Videos" },
  { icon: Square, name: "Rectangles" },
  { icon: Layers, name: "Groups" },
  { icon: ListVideo, name: "Scrollers" },
  { icon: Shapes, name: "Cycle stacks" },
];

const STEPS = [
  {
    title: "Sign in with Twitch",
    text: "One click, no passwords. Your Twitch name is how teammates find you.",
  },
  {
    title: "Design your scene",
    text: "Start from a template or an empty canvas, then drag, snap and style elements.",
  },
  {
    title: "Add it to OBS",
    text: "Paste the overlay's URL as a browser source. Every change after that is live.",
  },
];

const ROLES = [
  {
    icon: Eye,
    role: "Viewer",
    text: "Sees the overlay and its controls, changes nothing.",
  },
  {
    icon: Gamepad2,
    role: "Controller",
    text: "Runs the show: counters, timers, text and which layer is up.",
  },
  {
    icon: PenTool,
    role: "Editor",
    text: "Changes the design too: elements, layout, fonts and colours.",
  },
];

const Landing: React.FC = () => (
  <div data-full-bleed className="relative overflow-x-clip">
    <Hero />
    <ElementMarquee />
    <Features />
    <HowItWorks />
    <Integrations />
    <Roles />
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-6 py-24 sm:py-32">
      <SectionHeading
        eyebrow="FAQ"
        title="Questions, answered"
        text="Everything you might want to know before your first overlay."
      />
      <Reveal className="mt-12">
        <Faq />
      </Reveal>
    </section>
    <FinalCta />
    <Footer />
  </div>
);

const Hero = () => (
  <section className="relative isolate overflow-hidden px-6 pt-20 pb-24 sm:pt-28">
    <div className="landing-grid pointer-events-none absolute inset-0 -z-10" />
    <div className="pointer-events-none absolute top-0 left-1/2 -z-10 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-primary/25 blur-[140px] dark:bg-primary/20" />

    <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
      <div className="hero-in" style={{ animationDelay: "0ms" }}>
        <a
          href="#integrations"
          className="group inline-flex items-center gap-2 rounded-full border bg-background/60 py-1 pr-3 pl-1 text-xs font-medium backdrop-blur transition-colors hover:border-primary/40"
        >
          <span className="rounded-full bg-brand-spotify px-2 py-0.5 text-brand-spotify-foreground">
            New
          </span>
          <span className="text-muted-foreground group-hover:text-foreground">
            Show what's playing on Spotify
          </span>
          <ArrowRight className="size-3 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </a>
      </div>

      <h1
        className="hero-in mt-8 font-display text-5xl font-bold tracking-tighter text-balance sm:text-7xl"
        style={{ animationDelay: "80ms" }}
      >
        Stream overlays your whole team can{" "}
        <span className="bg-gradient-to-r from-primary via-chart-5 to-chart-4 bg-clip-text text-transparent">
          update live
        </span>
      </h1>

      <p
        className="hero-in mt-6 max-w-2xl text-lg text-balance text-muted-foreground sm:text-xl"
        style={{ animationDelay: "160ms" }}
      >
        Design scenes in a Figma-style editor, bind them to Twitch, Spotify or your own apps, and
        let your mods run them from anywhere while you stream.
      </p>

      <div
        className="hero-in mt-10 flex flex-col items-center gap-3 sm:flex-row"
        style={{ animationDelay: "240ms" }}
      >
        <TwitchSignInButton className="h-11 min-w-56 px-6 text-base" />
        <a
          href="#features"
          className="inline-flex h-11 items-center gap-2 rounded-md border bg-background/60 px-6 text-base font-medium backdrop-blur transition-colors hover:bg-accent"
        >
          See what it can do
          <ArrowRight className="size-4" />
        </a>
      </div>
      <p className="hero-in mt-4 text-xs text-muted-foreground" style={{ animationDelay: "320ms" }}>
        Works with OBS, Streamlabs and anything else that takes a browser source.
      </p>
    </div>

    <div
      className="hero-in relative mx-auto mt-16 max-w-6xl sm:mt-20"
      style={{ animationDelay: "400ms" }}
    >
      <div className="pointer-events-none absolute -inset-x-10 -inset-y-6 -z-10 rounded-[2rem] bg-gradient-to-b from-primary/20 via-chart-5/10 to-transparent blur-2xl" />
      <div className="hero-tilt">
        <HeroPreview />
      </div>
    </div>
  </section>
);

const ElementMarquee = () => (
  <section className="border-y bg-card/40 py-10">
    <p className="mb-6 text-center text-sm text-muted-foreground">
      Fifteen building blocks, from a single counter to a full subathon
    </p>
    <div className="marquee-mask flex overflow-hidden">
      {/* Two copies, so the strip loops without a seam. */}
      {[0, 1].map((copy) => (
        <ul key={copy} aria-hidden={copy === 1} className="marquee flex shrink-0 gap-3 pr-3">
          {ELEMENTS.map(({ icon: Icon, name }) => (
            <li
              key={name}
              className="flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm whitespace-nowrap"
            >
              <Icon className="size-4 text-primary" />
              {name}
            </li>
          ))}
        </ul>
      ))}
    </div>
  </section>
);

const Features = () => (
  <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24 sm:py-32">
    <SectionHeading
      eyebrow="Features"
      title="Everything a live scene needs"
      text="A real design tool for overlays, with live control built in rather than bolted on."
    />

    <div className="mt-16 grid gap-4 md:grid-cols-6">
      <Reveal className="md:col-span-4">
        <SpotlightCard>
          <FeatureText
            icon={MousePointer2}
            title="An editor that feels like Figma"
            text="Snap to edges and centres, resize from any side, hug or fill with auto layout, group, copy and paste across overlays."
          />
          <EditorIllustration />
        </SpotlightCard>
      </Reveal>
      <Reveal className="md:col-span-2" delay={100}>
        <SpotlightCard>
          <FeatureText
            icon={Zap}
            title="Live control"
            text="Bump counters, start timers and swap layers mid-stream. OBS shows it instantly."
          />
          <CounterIllustration />
        </SpotlightCard>
      </Reveal>
      <Reveal className="md:col-span-2">
        <SpotlightCard>
          <FeatureText
            icon={Variable}
            title="Variables"
            text="Bind any text, number, colour or image to a value that updates itself."
          />
          <VariablesIllustration />
        </SpotlightCard>
      </Reveal>
      <Reveal className="md:col-span-2" delay={100}>
        <SpotlightCard>
          <FeatureText
            icon={Users}
            title="Built for teams"
            text="Share by Twitch name. Mods control content, designers edit the look."
          />
          <AvatarsIllustration />
        </SpotlightCard>
      </Reveal>
      <Reveal className="md:col-span-2" delay={200}>
        <SpotlightCard>
          <FeatureText
            icon={Blocks}
            title="Reusable components"
            text="Save an element once, drop copies anywhere, share it as a file or a link."
          />
          <ComponentsIllustration />
        </SpotlightCard>
      </Reveal>
    </div>
  </section>
);

const HowItWorks = () => (
  <section className="relative border-y bg-card/40">
    <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
      <SectionHeading
        eyebrow="How it works"
        title="Live in three steps"
        text="From sign in to on stream in a couple of minutes."
      />
      <div className="relative mt-16 grid gap-10 md:grid-cols-3 md:gap-6">
        <div className="pointer-events-none absolute top-5 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" />
        {STEPS.map(({ title, text }, i) => (
          <Reveal key={title} delay={i * 120}>
            <div className="relative flex flex-col items-center text-center">
              <span className="flex size-10 items-center justify-center rounded-full border bg-background font-display text-sm font-semibold shadow-sm">
                {i + 1}
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-2 max-w-xs text-muted-foreground">{text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

const Integrations = () => (
  <section id="integrations" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24 sm:py-32">
    <div className="grid items-center gap-12 lg:grid-cols-2">
      <div>
        <Reveal>
          <p className="text-sm font-medium text-primary">Integrations</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-balance sm:text-5xl">
            Data in, overlay updated
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Variables keep themselves up to date. Bind a field once and forget about it.
          </p>
        </Reveal>
        <div className="mt-10 space-y-3">
          <Reveal delay={80}>
            <IntegrationRow
              icon={<TwitchIcon className="size-5" />}
              iconClass="bg-brand-twitch text-brand-twitch-foreground"
              title="Twitch"
              text="Followers, viewers, title and subscribers, plus subs and cheers that add time to a subathon."
            />
          </Reveal>
          <Reveal delay={160}>
            <IntegrationRow
              icon={<Music className="size-5" />}
              iconClass="bg-brand-spotify text-brand-spotify-foreground"
              title="Spotify"
              text="Track, artist, cover and progress, with accent colours taken from the cover."
            />
          </Reveal>
          <Reveal delay={240}>
            <IntegrationRow
              icon={<MonitorPlay className="size-5" />}
              iconClass="bg-foreground text-background"
              title="Your own apps"
              text="Game servers, Stream Deck buttons and bots send values over a simple HTTP API."
            />
          </Reveal>
        </div>
      </div>

      <Reveal delay={120}>
        <div className="overflow-hidden rounded-xl border bg-card shadow-xl">
          <div className="flex items-center gap-2 border-b px-4 py-3 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-full bg-foreground/15" />
            <span className="size-2.5 rounded-full bg-foreground/15" />
            <span className="size-2.5 rounded-full bg-foreground/15" />
            <span className="ml-2 font-mono">terminal</span>
          </div>
          <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed">
            <code>
              <span className="text-muted-foreground"># Team Red scored, tell the overlay</span>
              {"\n"}
              <span className="text-primary">curl</span> -X PUT \{"\n"}
              {"  "}
              <span className="text-success">.../api/v1/sources/tournament/variables/red.points</span>{" "}
              \{"\n"}
              {"  "}-H <span className="text-warning">"Authorization: Bearer ovrly_…"</span> \
              {"\n"}
              {"  "}-H <span className="text-warning">"Content-Type: application/json"</span> \
              {"\n"}
              {"  "}-d <span className="text-warning">{`'{ "type": "integer", "value": 12 }'`}</span>
            </code>
          </pre>
          <div className="flex items-center justify-between border-t bg-background/40 px-5 py-4">
            <span className="text-sm text-muted-foreground">red.points</span>
            <span className="font-display text-3xl font-bold tabular-nums">12</span>
          </div>
        </div>
      </Reveal>
    </div>
  </section>
);

const Roles = () => (
  <section className="border-t">
    <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
      <SectionHeading
        eyebrow="Sharing"
        title="Hand over the controls, not your account"
        text="Share one overlay or all of them. The higher role wins, and only you can share or delete."
      />
      <div className="mt-16 grid gap-4 md:grid-cols-3">
        {ROLES.map(({ icon: Icon, role, text }, i) => (
          <Reveal key={role} delay={i * 100}>
            <SpotlightCard className="p-6">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-lg border bg-background text-primary">
                  <Icon className="size-5" />
                </span>
                <div className="flex gap-1">
                  {ROLES.map((_, level) => (
                    <span
                      key={level}
                      className={cn(
                        "h-1.5 w-5 rounded-full",
                        level <= i ? "bg-primary" : "bg-muted"
                      )}
                    />
                  ))}
                </div>
              </div>
              <h3 className="mt-6 font-display text-lg font-semibold">{role}</h3>
              <p className="mt-1 text-muted-foreground">{text}</p>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

const FinalCta = () => (
  <section className="px-6 pb-24 sm:pb-32">
    <Reveal>
      <div className="relative isolate mx-auto max-w-5xl overflow-hidden rounded-3xl border bg-card px-6 py-20 text-center">
        <div className="landing-grid pointer-events-none absolute inset-0 -z-10 opacity-60" />
        <div className="pointer-events-none absolute -bottom-40 left-1/2 -z-10 h-80 w-[640px] -translate-x-1/2 rounded-full bg-primary/30 blur-[120px]" />
        <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight text-balance sm:text-5xl">
          Your next scene is a few clicks away
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Sign in, pick a template and add it to OBS before your stream starts.
        </p>
        <TwitchSignInButton className="mt-10 h-11 min-w-56 px-6 text-base">
          Get started with Twitch
        </TwitchSignInButton>
      </div>
    </Reveal>
  </section>
);

const Footer = () => (
  <footer className="border-t">
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row">
      <span className="font-display font-semibold text-foreground">Ovrly</span>
      <nav className="flex gap-6">
        <a href="#features" className="hover:text-foreground">
          Features
        </a>
        <a href="#integrations" className="hover:text-foreground">
          Integrations
        </a>
        <a href="#faq" className="hover:text-foreground">
          FAQ
        </a>
      </nav>
      <span>© {new Date().getFullYear()} Ovrly</span>
    </div>
  </footer>
);

const SectionHeading: React.FC<{ eyebrow: string; title: string; text: string }> = ({
  eyebrow,
  title,
  text,
}) => (
  <Reveal className="mx-auto max-w-2xl text-center">
    <p className="text-sm font-medium text-primary">{eyebrow}</p>
    <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-balance sm:text-5xl">
      {title}
    </h2>
    <p className="mt-4 text-lg text-balance text-muted-foreground">{text}</p>
  </Reveal>
);

const FeatureText: React.FC<{ icon: LucideIcon; title: string; text: string }> = ({
  icon: Icon,
  title,
  text,
}) => (
  <div className="p-6 pb-0">
    <Icon className="size-5 text-primary" />
    <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
    <p className="mt-1 text-muted-foreground">{text}</p>
  </div>
);

const IntegrationRow: React.FC<{
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  text: string;
}> = ({ icon, iconClass, title, text }) => (
  <div className="flex gap-4 rounded-xl border bg-card/60 p-4 transition-colors hover:border-primary/30">
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", iconClass)}>
      {icon}
    </span>
    <div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  </div>
);

// Small pictures under the feature texts, drawn with plain boxes.

const EditorIllustration = () => (
  <div className="relative mx-6 mt-8 mb-6 h-44 rounded-lg border bg-pasteboard">
    <div className="absolute top-0 bottom-0 left-1/2 w-px bg-canvas-guide/70" />
    <div className="absolute top-1/2 right-0 left-0 h-px bg-canvas-guide/70" />
    <div className="absolute top-6 left-6 h-10 w-28 rounded-md bg-muted" />
    <div className="absolute right-6 bottom-6 h-14 w-36 rounded-md bg-muted" />
    <div className="editor-drag absolute top-[calc(50%-2rem)] left-[calc(50%-4rem)] h-16 w-32 rounded-md border-2 border-primary bg-primary/15">
      {["-top-1 -left-1", "-top-1 -right-1", "-bottom-1 -left-1", "-bottom-1 -right-1"].map(
        (position) => (
          <span
            key={position}
            className={cn(
              "absolute size-2 rounded-[2px] border-2 border-primary bg-background",
              position
            )}
          />
        )
      )}
      <MousePointer2 className="absolute -right-4 -bottom-5 size-5 fill-foreground text-background" />
    </div>
  </div>
);

const CounterIllustration = () => (
  <div className="mx-6 mt-8 mb-6 flex items-center justify-between rounded-lg border bg-background p-4">
    <span className="text-sm text-muted-foreground">Deaths</span>
    <div className="flex items-center gap-3">
      <span className="flex size-7 items-center justify-center rounded-md border text-muted-foreground">
        −
      </span>
      <span className="relative inline-block h-8 w-10 overflow-hidden text-center font-display text-2xl font-bold tabular-nums">
        <span className="counter-roll-inner flex flex-col leading-8">
          <span className="h-8">12</span>
          <span className="h-8">13</span>
          <span className="h-8">14</span>
        </span>
      </span>
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        +
      </span>
    </div>
  </div>
);

const VariablesIllustration = () => (
  <div className="mx-6 mt-8 mb-6 space-y-2 font-mono text-xs">
    {[
      ["twitch:@me", "followers", "1,024"],
      ["spotify:player", "track", "Midnight City"],
      ["tournament", "red.points", "12"],
    ].map(([source, key, value]) => (
      <div
        key={key}
        className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2"
      >
        <span className="truncate">
          <span className="text-muted-foreground">{source} · </span>
          {key}
        </span>
        <span className="shrink-0 text-primary">{value}</span>
      </div>
    ))}
  </div>
);

const AvatarsIllustration = () => (
  <div className="mx-6 mt-8 mb-6 space-y-2">
    {[
      ["You", "Owner", "from-primary to-chart-5"],
      ["mod_marie", "Controller", "from-chart-2 to-chart-3"],
      ["pixel_pete", "Editor", "from-chart-4 to-chart-5"],
    ].map(([name, role, gradient]) => (
      <div key={name} className="flex items-center gap-3 rounded-md border bg-background px-3 py-2">
        <span className={cn("size-6 rounded-full bg-gradient-to-br", gradient)} />
        <span className="flex-1 truncate text-sm">{name}</span>
        <span className="text-xs text-muted-foreground">{role}</span>
      </div>
    ))}
  </div>
);

const ComponentsIllustration = () => (
  <div className="mx-6 mt-8 mb-6 grid grid-cols-3 gap-2">
    {["from-primary/40", "from-chart-2/40", "from-chart-5/40", "from-chart-4/40", "from-chart-3/40", "from-primary/25"].map(
      (from, i) => (
        <div
          key={i}
          className={cn(
            "aspect-[4/3] rounded-md border bg-gradient-to-br to-transparent transition-transform duration-300 group-hover:-translate-y-0.5",
            from
          )}
          style={{ transitionDelay: `${i * 30}ms` }}
        />
      )
    )}
  </div>
);

export default Landing;
