"use client";

import { useEffect, useId, useState } from "react";
import { addDoc, collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

type CurrentKing = {
  name: string;
  country: string;
  seasonTotal: number;
  latestMessage: string;
  timeAsKingSeconds: number;
  /** Donations that sum to seasonTotal — shown as visual breakdown */
  donationHistory: number[];
};

type RecentKing = {
  name: string;
  country: string;
  seasonTotal: number;
  latestDonation: number;
  message: string;
};

const MOCK_SEASON = {
  number: 1,
  label: "Season 1",
};

const MOCK_KING: CurrentKing = {
  name: "John",
  country: "USA",
  seasonTotal: 1200,
  latestMessage: "Nobody can beat me.",
  timeAsKingSeconds: 2 * 3600 + 14 * 60 + 31,
  donationHistory: [1000, 200],
};

const MOCK_RECENT_KINGS: RecentKing[] = [
  {
    name: "Marcus",
    country: "UK",
    seasonTotal: 1100,
    latestDonation: 1100,
    message: "My reign was legendary.",
  },
  {
    name: "Yuki",
    country: "Japan",
    seasonTotal: 1000,
    latestDonation: 1000,
    message: "Honor above all.",
  },
  {
    name: "Sofia",
    country: "Brazil",
    seasonTotal: 875,
    latestDonation: 875,
    message: "Dance like a queen.",
  },
  {
    name: "Viktor",
    country: "Germany",
    seasonTotal: 720,
    latestDonation: 720,
    message: "Precision wins crowns.",
  },
  {
    name: "Amara",
    country: "Nigeria",
    seasonTotal: 640,
    latestDonation: 640,
    message: "Africa rises.",
  },
];

const HOW_IT_WORKS =
  "Every donation adds to your season total. The player with the highest total becomes the King of Internet. If someone passes your total, you can donate again to reclaim the crown.";

type HallOfFameChampion = {
  name: string;
  country: string;
};

type HallOfFameSeason = {
  number: number;
  label: string;
  weekRange: string;
  highestAmount: HallOfFameChampion & { seasonTotal: number };
  longestReign: HallOfFameChampion & { reignSeconds: number };
};

const MOCK_HALL_OF_FAME: HallOfFameSeason[] = [
  {
    number: 1,
    label: "Season 1",
    weekRange: "Jan 6 – Jan 12",
    highestAmount: {
      name: "Elena",
      country: "Spain",
      seasonTotal: 4850,
    },
    longestReign: {
      name: "Marcus",
      country: "UK",
      reignSeconds: 4 * 86400 + 12 * 3600 + 8 * 60,
    },
  },
  {
    number: 2,
    label: "Season 2",
    weekRange: "Jan 13 – Jan 19",
    highestAmount: {
      name: "Kenji",
      country: "Japan",
      seasonTotal: 6200,
    },
    longestReign: {
      name: "Sofia",
      country: "Brazil",
      reignSeconds: 6 * 86400 + 2 * 3600 + 41 * 60,
    },
  },
  {
    number: 3,
    label: "Season 3",
    weekRange: "Jan 20 – Jan 26",
    highestAmount: {
      name: "Amara",
      country: "Nigeria",
      seasonTotal: 8750,
    },
    longestReign: {
      name: "John",
      country: "USA",
      reignSeconds: 3 * 86400 + 18 * 3600 + 55 * 60,
    },
  },
];

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString("en-US")}`;
}

function formatTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

function formatReign(totalSeconds: number) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
  }
  return formatTime(totalSeconds);
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-game text-[10px] font-semibold tracking-[0.2em] text-zinc-500 uppercase sm:text-xs">
      {children}
    </p>
  );
}

function SeasonBadge() {
  return (
    <span className="font-game inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/5 px-3 py-1 text-[10px] font-semibold tracking-[0.2em] text-gold uppercase sm:text-xs">
      <span className="h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_6px_#d4af37]" />
      {MOCK_SEASON.label} · Highest total wins
    </span>
  );
}

function SeasonTotalVisual({
  donations,
  total,
  compact = false,
}: {
  donations: number[];
  total: number;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "text-xs" : "text-sm sm:text-base"}`}>
      {donations.map((amount, index) => (
        <span key={`${amount}-${index}`} className="inline-flex items-center gap-1.5">
          {index > 0 && <span className="font-game font-bold text-gold/60">+</span>}
          <span className="rounded-md border border-gold/20 bg-gold/10 px-2 py-0.5 font-mono font-semibold text-gold-light">
            {formatCurrency(amount)}
          </span>
        </span>
      ))}
      <span className="font-game font-bold text-gold/60">=</span>
      <span
        className={`rounded-md border border-gold/30 bg-gold/15 font-display font-bold text-gold ${compact ? "px-2 py-0.5 text-sm" : "px-2.5 py-1 text-base sm:text-lg"}`}
      >
        {formatCurrency(total)}
      </span>
    </div>
  );
}

function MiniCrownIcon({ variant = "gold" }: { variant?: "gold" | "reign" }) {
  const uid = useId().replace(/:/g, "");
  const gradientId = `${uid}-crown-${variant}`;
  const gemId = `${uid}-gem-${variant}`;
  const stroke = variant === "gold" ? "#f5e6a3" : "#a8f0e8";

  return (
    <svg
      viewBox="0 0 32 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-7 w-7 shrink-0 sm:h-8 sm:w-8"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          {variant === "gold" ? (
            <>
              <stop offset="0%" stopColor="#fff8dc" />
              <stop offset="50%" stopColor="#d4af37" />
              <stop offset="100%" stopColor="#7a6020" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#c8faf5" />
              <stop offset="50%" stopColor="#4ecdc4" />
              <stop offset="100%" stopColor="#2a7a72" />
            </>
          )}
        </linearGradient>
        <linearGradient id={gemId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={variant === "gold" ? "#ff8080" : "#7ee8e0"} />
          <stop offset="100%" stopColor={variant === "gold" ? "#a02020" : "#2a9d8f"} />
        </linearGradient>
      </defs>
      <path
        d="M3 20 L7 9 L11 15 L16 5 L21 15 L25 9 L29 20 Z"
        fill={`url(#${gradientId})`}
        stroke={stroke}
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
      <rect x="2" y="20" width="28" height="4" rx="1" fill={`url(#${gradientId})`} />
      <circle cx="16" cy="5" r="2.5" fill={`url(#${gemId})`} />
    </svg>
  );
}

function CrownIcon() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -m-8 rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.25)_0%,transparent_70%)] blur-xl" />
      <span className="animate-sparkle absolute -top-1 left-1/4 h-1.5 w-1.5 rounded-full bg-gold-light shadow-[0_0_8px_#f5e6a3]" />
      <span className="animate-sparkle absolute top-2 right-0 h-1 w-1 rounded-full bg-gold-light shadow-[0_0_6px_#f5e6a3] [animation-delay:0.8s]" />
      <span className="animate-sparkle absolute bottom-4 left-0 h-1 w-1 rounded-full bg-gold shadow-[0_0_6px_#d4af37] [animation-delay:1.4s]" />

      <svg
        viewBox="0 0 120 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 animate-crown"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="crownGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff8dc" />
            <stop offset="35%" stopColor="#f5e6a3" />
            <stop offset="55%" stopColor="#d4af37" />
            <stop offset="100%" stopColor="#7a6020" />
          </linearGradient>
          <linearGradient id="gemGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ff8080" />
            <stop offset="100%" stopColor="#a02020" />
          </linearGradient>
          <linearGradient id="tealGem" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7ee8e0" />
            <stop offset="100%" stopColor="#2a9d8f" />
          </linearGradient>
        </defs>
        <path
          d="M10 75 L20 35 L35 55 L60 18 L85 55 L100 35 L110 75 Z"
          fill="url(#crownGradient)"
          stroke="#f5e6a3"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <rect x="8" y="75" width="104" height="14" rx="2" fill="url(#crownGradient)" stroke="#f5e6a3" strokeWidth="0.5" />
        <circle cx="20" cy="35" r="5.5" fill="url(#gemGradient)" stroke="#ffb3b3" strokeWidth="0.5" />
        <circle cx="60" cy="18" r="7" fill="url(#gemGradient)" stroke="#ffb3b3" strokeWidth="0.5" />
        <circle cx="100" cy="35" r="5.5" fill="url(#gemGradient)" stroke="#ffb3b3" strokeWidth="0.5" />
        <circle cx="35" cy="55" r="4.5" fill="url(#tealGem)" stroke="#a8f0e8" strokeWidth="0.5" />
        <circle cx="85" cy="55" r="4.5" fill="url(#tealGem)" stroke="#a8f0e8" strokeWidth="0.5" />
      </svg>

      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
        <div className="animate-crown-shine absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      </div>
    </div>
  );
}

function HowItWorksSection() {
  return (
    <section className="animate-fade-up delay-200 mt-10 w-full sm:mt-12">
      <div className="card-premium relative overflow-hidden rounded-2xl p-5 text-left sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gold/[0.04] via-transparent to-transparent" />
        <div className="pointer-events-none absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

        <div className="relative flex items-start gap-3 sm:gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold/25 bg-gold/10 sm:h-10 sm:w-10">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-gold sm:h-5 sm:w-5" fill="currentColor" aria-hidden="true">
              <path d="M12 2l2.4 5.8L21 9l-4.5 4.2L18 20l-6-3.5L6 20l1.5-6.8L3 9l6.6-1.2L12 2z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-game text-xs font-bold tracking-[0.25em] text-gold uppercase sm:text-sm">
              How It Works
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400 sm:text-[15px]">
              {HOW_IT_WORKS}
            </p>

            {/* Visual example matching the rule */}
            <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/30 p-3 sm:p-4">
              <p className="font-game text-[10px] font-semibold tracking-[0.15em] text-zinc-500 uppercase">
                Example
              </p>
              <div className="mt-3 space-y-2.5 text-xs text-zinc-400 sm:text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-zinc-500">Player A</span>
                  <SeasonTotalVisual donations={[1000]} total={1000} compact />
                  <span className="text-gold">→ King</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-zinc-500">Player B</span>
                  <SeasonTotalVisual donations={[1100]} total={1100} compact />
                  <span className="text-gold">→ King</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-zinc-500">Player A</span>
                  <SeasonTotalVisual donations={[1000, 200]} total={1200} compact />
                  <span className="text-gold">→ King again</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HallOfFameChampionCard({
  type,
  name,
  country,
  stat,
  statLabel,
}: {
  type: "highest" | "longest";
  name: string;
  country: string;
  stat: string;
  statLabel: string;
}) {
  const isHighest = type === "highest";

  return (
    <article
      className={`card-hall-of-fame group relative overflow-hidden rounded-xl p-4 sm:p-5 ${!isHighest ? "card-hall-of-fame-reign" : ""}`}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60 ${isHighest ? "from-gold/[0.06] via-transparent to-transparent" : "from-teal-400/[0.05] via-transparent to-transparent"}`}
      />
      <div
        className={`pointer-events-none absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent ${isHighest ? "via-gold/35" : "via-teal-400/30"} to-transparent`}
      />

      <div className="relative flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border sm:h-12 sm:w-12 ${isHighest ? "border-gold/25 bg-gold/10" : "border-teal-400/25 bg-teal-400/10"}`}
        >
          <MiniCrownIcon variant={isHighest ? "gold" : "reign"} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p
            className={`font-game text-[10px] font-bold tracking-[0.2em] uppercase sm:text-xs ${isHighest ? "text-gold" : "text-teal-300"}`}
          >
            {isHighest ? "Highest Amount King" : "Longest Reign King"}
          </p>
          <p className="mt-1.5 truncate text-base font-semibold text-white sm:text-lg">{name}</p>
          <p className="font-game mt-0.5 text-[10px] tracking-wider text-zinc-500 uppercase sm:text-xs">
            {country}
          </p>
        </div>
      </div>

      <div
        className={`relative mt-4 rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3 ${isHighest ? "border-gold/15 bg-gold/5" : "border-teal-400/15 bg-teal-400/5"}`}
      >
        <Label>{statLabel}</Label>
        <p
          className={`mt-0.5 font-display text-xl font-bold sm:text-2xl ${isHighest ? "text-gold" : "text-teal-300"}`}
        >
          {stat}
        </p>
      </div>
    </article>
  );
}

function HallOfFameSection() {
  return (
    <section className="animate-fade-up delay-700 mt-14 w-full sm:mt-16">
      <div className="section-divider mb-8 sm:mb-10" />

      <div className="mb-8 space-y-3 text-left sm:mb-10 sm:text-center">
        <div className="flex items-center justify-start gap-3 sm:justify-center">
          <MiniCrownIcon variant="gold" />
          <h2 className="font-game text-sm font-bold tracking-[0.35em] text-gold uppercase sm:text-base">
            Hall of Fame
          </h2>
          <MiniCrownIcon variant="gold" />
        </div>
        <p className="text-sm text-zinc-500">Weekly Seasons · Legendary champions crowned</p>
      </div>

      <div className="space-y-5 sm:space-y-6">
        {MOCK_HALL_OF_FAME.map((season) => (
          <article
            key={season.number}
            className="card-hall-season relative overflow-hidden rounded-2xl p-4 sm:rounded-3xl sm:p-6"
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-gold/[0.03] via-transparent to-purple-500/[0.02]" />

            <header className="relative mb-4 flex flex-col gap-1 border-b border-white/[0.05] pb-4 sm:mb-5 sm:flex-row sm:items-center sm:justify-between sm:pb-5">
              <div className="flex items-center gap-2.5">
                <span className="font-game flex h-8 w-8 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 text-xs font-bold text-gold">
                  {season.number}
                </span>
                <h3 className="font-display text-lg font-bold text-white sm:text-xl">{season.label}</h3>
              </div>
              <p className="font-game text-[10px] tracking-[0.15em] text-zinc-500 uppercase sm:text-xs">
                Weekly · {season.weekRange}
              </p>
            </header>

            <div className="relative grid gap-3 sm:grid-cols-2 sm:gap-4">
              <HallOfFameChampionCard
                type="highest"
                name={season.highestAmount.name}
                country={season.highestAmount.country}
                stat={formatCurrency(season.highestAmount.seasonTotal)}
                statLabel="Season total"
              />
              <HallOfFameChampionCard
                type="longest"
                name={season.longestReign.name}
                country={season.longestReign.country}
                stat={formatReign(season.longestReign.reignSeconds)}
                statLabel="Longest reign"
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RecentKingCard({
  king,
  rank,
  className = "",
}: {
  king: RecentKing;
  rank: number;
  className?: string;
}) {
  return (
    <article
      className={`card-king-history group relative overflow-hidden rounded-xl p-4 sm:p-5 ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gold/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="pointer-events-none absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />

      <div className="relative flex items-start gap-3">
        <span className="font-game flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gold/20 bg-gold/5 text-xs font-bold text-gold">
          #{rank}
        </span>
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="truncate text-base font-semibold text-white sm:text-lg">{king.name}</p>
              <p className="font-game mt-0.5 text-[10px] tracking-wider text-zinc-500 uppercase sm:text-xs">
                {king.country}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
            <div className="rounded-lg border border-gold/10 bg-black/25 px-2.5 py-2">
              <Label>Season total</Label>
              <p className="mt-0.5 font-display text-lg font-bold text-gold sm:text-xl">
                {formatCurrency(king.seasonTotal)}
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
              <Label>Latest donation</Label>
              <p className="mt-0.5 font-mono text-lg font-semibold text-zinc-200 sm:text-xl">
                {formatCurrency(king.latestDonation)}
              </p>
            </div>
          </div>

          <p className="mt-3 border-t border-white/[0.04] pt-3 text-sm leading-relaxed text-zinc-400 italic sm:text-[15px]">
            &ldquo;{king.message}&rdquo;
          </p>
        </div>
      </div>
    </article>
  );
}
function StatisticsSection() {
  const stats = [
    { label: "Total Kings", value: "247" },
    { label: "Total Donations", value: "$18,450" },
    {
      label: "Highest Amount Ever",
      value: "$8,750",
      player: "Amara",
      country: "🇳🇬 Nigeria",
    },
    { label: "Longest Reign Ever", value: "6d 02h" },
  ];

  return (
    <section className="animate-fade-up delay-700 mt-14 w-full sm:mt-16">
      <div className="section-divider mb-8 sm:mb-10" />

      <div className="mb-8 space-y-2 text-left sm:mb-10 sm:text-center">
        <h2 className="font-game text-sm font-bold tracking-[0.35em] text-gold uppercase sm:text-base">
          Statistics
        </h2>
        <p className="text-sm text-zinc-500">
          Live kingdom numbers and legendary records
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="card-premium rounded-xl border border-gold/10 bg-black/30 p-5 text-left"
          >
            <Label>{stat.label}</Label>
            <div className="mt-2 flex flex-wrap items-end gap-3">
  <p className="font-display text-3xl font-black text-gold sm:text-4xl">
    {stat.value}
  </p>

  {"player" in stat && (
    <div className="mb-1">
      <p className="text-sm font-bold text-white">{stat.player}</p>
      <p className="text-xs text-zinc-500">{stat.country}</p>
    </div>
  )}
</div>
          </div>
        ))}
      </div>
    </section>
  );
}
function CountryRankingSection() {
  const countries = [
    { flag: "🇺🇸", name: "USA", amount: 12400, kings: 42 },
    { flag: "🇧🇷", name: "Brazil", amount: 9800, kings: 35 },
    { flag: "🇯🇵", name: "Japan", amount: 7200, kings: 21 },
    { flag: "🇬🇧", name: "United Kingdom", amount: 6100, kings: 18 },
    { flag: "🇩🇪", name: "Germany", amount: 4800, kings: 14 },
  ];

  return (
    <section className="animate-fade-up delay-700 mt-14 w-full sm:mt-16">
      <div className="section-divider mb-8 sm:mb-10" />

      <div className="mb-8 space-y-2 text-left sm:mb-10 sm:text-center">
        <h2 className="font-game text-sm font-bold tracking-[0.35em] text-gold uppercase sm:text-base">
          Country Ranking
        </h2>
        <p className="text-sm text-zinc-500">
          Nations competing for internet dominance
        </p>
      </div>

      <div className="space-y-3">
        {countries.map((country, index) => (
          <div
            key={country.name}
            className="card-premium flex items-center justify-between rounded-xl border border-gold/10 bg-black/30 p-4"
          >
            <div className="flex items-center gap-4">
              <span className="font-game flex h-9 w-9 items-center justify-center rounded-lg border border-gold/20 bg-gold/5 text-xs font-bold text-gold">
                #{index + 1}
              </span>
              <div>
                <p className="text-lg font-bold text-white">
                  <span className="mr-2">{country.flag}</span>
                  {country.name}
                </p>
                <p className="text-xs text-zinc-500">
                  {country.kings} kings crowned
                </p>
              </div>
            </div>

            <p className="font-display text-xl font-black text-gold sm:text-2xl">
              {formatCurrency(country.amount)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
function GlobalLeaderboardSection() {
  const players = [
    { name: "John", country: "🇺🇸 USA", total: 12000, crowns: 8, reign: "2d 14h" },
    { name: "Sofia", country: "🇧🇷 Brazil", total: 9800, crowns: 6, reign: "1d 22h" },
    { name: "Kenji", country: "🇯🇵 Japan", total: 8700, crowns: 5, reign: "3d 04h" },
    { name: "Marcus", country: "🇬🇧 UK", total: 7600, crowns: 4, reign: "1d 08h" },
    { name: "Amara", country: "🇳🇬 Nigeria", total: 6400, crowns: 3, reign: "19h" },
  ];

  return (
    <section className="animate-fade-up delay-700 mt-14 w-full sm:mt-16">
      <div className="section-divider mb-8 sm:mb-10" />

      <div className="mb-8 space-y-2 text-left sm:mb-10 sm:text-center">
        <h2 className="font-game text-sm font-bold tracking-[0.35em] text-gold uppercase sm:text-base">
          Global Leaderboard
        </h2>
        <p className="text-sm text-zinc-500">
          The richest and most powerful rulers of all time
        </p>
      </div>

      <div className="space-y-3">
        {players.map((player, index) => (
          <div
            key={player.name}
            className="card-premium rounded-xl border border-gold/10 bg-black/30 p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="font-game flex h-9 w-9 items-center justify-center rounded-lg border border-gold/20 bg-gold/5 text-xs font-bold text-gold">
                  #{index + 1}
                </span>
                <div>
                  <p className="text-lg font-bold text-white">{player.name}</p>
                  <p className="text-xs text-zinc-500">{player.country}</p>
                </div>
              </div>

              <p className="font-display text-xl font-black text-gold sm:text-2xl">
                {formatCurrency(player.total)}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.05] pt-4 text-left">
              <div>
                <Label>Crowns won</Label>
                <p className="mt-1 text-lg font-bold text-white">{player.crowns}</p>
              </div>
              <div>
                <Label>Total reign</Label>
                <p className="mt-1 text-lg font-bold text-white">{player.reign}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
function ActivityFeedSection() {
  const activities = [
    "John from USA reclaimed the crown with $1,200",
    "Marcus from UK stole the crown with $1,100",
    "Sofia from Brazil joined the season with $875",
    "Yuki from Japan ruled for 48 minutes",
    "Amara from Nigeria entered the leaderboard",
  ];

  return (
    <section className="animate-fade-up delay-700 mt-14 w-full sm:mt-16">
      <div className="section-divider mb-8 sm:mb-10" />

      <div className="mb-8 space-y-2 text-left sm:mb-10 sm:text-center">
        <h2 className="font-game text-sm font-bold tracking-[0.35em] text-gold uppercase sm:text-base">
          Live Activity
        </h2>
        <p className="text-sm text-zinc-500">
          Every crown battle creates a new legend
        </p>
      </div>

      <div className="space-y-3">
        {activities.map((activity, index) => (
          <div
            key={activity}
            className="card-premium flex items-center gap-4 rounded-xl border border-gold/10 bg-black/30 p-4 text-left"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-gold shadow-[0_0_10px_#d4af37]" />
            <p className="text-sm text-zinc-300 sm:text-base">{activity}</p>
            <span className="ml-auto text-xs text-zinc-600">
              {index + 1}m ago
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
function SeasonInfoSection() {
  return (
    <section className="animate-fade-up delay-700 mt-14 w-full sm:mt-16">
      <div className="section-divider mb-8 sm:mb-10" />

      <div className="card-premium rounded-2xl p-6 text-center">
        <h2 className="font-game text-sm font-bold tracking-[0.35em] text-gold uppercase">
          Current Season
        </h2>

        <p className="mt-4 text-5xl font-black text-gold">
          #1
        </p>

        <p className="mt-3 text-zinc-400">
          Ends in 5 days, 13 hours
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-zinc-500 uppercase">
              Current King
            </p>
            <p className="text-white font-bold">
              John
            </p>
          </div>

          <div>
            <p className="text-xs text-zinc-500 uppercase">
              Prize
            </p>
            <p className="text-gold font-bold">
              Hall of Fame
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
function BiggestDonationSection() {
  return (
    <section className="animate-fade-up delay-700 mt-14 w-full sm:mt-16">
      <div className="section-divider mb-8 sm:mb-10" />

      <div className="card-premium relative overflow-hidden rounded-2xl border border-gold/20 bg-black/30 p-6 text-center sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gold/[0.08] via-transparent to-purple-500/[0.04]" />

        <div className="relative">
          <h2 className="font-game text-sm font-bold tracking-[0.35em] text-gold uppercase">
            Biggest King Ever
          </h2>

          <p className="mt-5 font-display text-5xl font-black text-gold sm:text-6xl">
            $8,750
          </p>

          <div className="mt-4">
            <p className="text-2xl font-bold text-white">Amara</p>
            <p className="text-sm text-zinc-500">🇳🇬 Nigeria</p>
          </div>

          <p className="mx-auto mt-6 max-w-xl text-lg italic leading-relaxed text-zinc-300">
            &ldquo;Africa rises.&rdquo;
          </p>
        </div>
      </div>
    </section>
  );
}
export default function Home() {
  const [elapsed, setElapsed] = useState(MOCK_KING.timeAsKingSeconds);

  const [firebaseKing, setFirebaseKing] = useState({
    name: MOCK_KING.name,
    country: MOCK_KING.country,
    amount: MOCK_KING.seasonTotal,
    message: MOCK_KING.latestMessage,
  });

  const [firebaseDonations, setFirebaseDonations] = useState<RecentKing[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    country: "",
    amount: "",
    message: "",
  });
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const kingRef = doc(db, "currentKing", "current");

    const unsubscribe = onSnapshot(kingRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();

        setFirebaseKing({
          name: String(data.name || "No King Yet"),
          country: String(data.country || "None"),
          amount: Number(data.amount || 0),
          message: String(data.message || "Be the first king"),
        });
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const donationsRef = collection(db, "donations");

    const unsubscribe = onSnapshot(donationsRef, (snapshot) => {
      const donations = snapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          name: String(data.name || "Unknown"),
          country: String(data.country || "Unknown"),
          seasonTotal: Number(data.amount || 0),
          latestDonation: Number(data.amount || 0),
          message: String(data.message || ""),
        };
      });

      setFirebaseDonations(donations);
    });

    return () => unsubscribe();
  }, []);
  async function handleBecomeKing(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
  
    const amountNumber = Number(formData.amount);
  
    if (!formData.name || !formData.country || !formData.message || amountNumber <= 0) {
      alert("Please fill all fields correctly.");
      return;
    }
  
    await setDoc(doc(db, "currentKing", "current"), {
      name: formData.name,
      country: formData.country,
      amount: amountNumber,
      message: formData.message,
      timestamp: new Date().toISOString(),
    });
  
    await addDoc(collection(db, "donations"), {
      name: formData.name,
      country: formData.country,
      amount: amountNumber,
      message: formData.message,
      timestamp: serverTimestamp(),
    });
  
    setFormData({
      name: "",
      country: "",
      amount: "",
      message: "",
    });
  
    setShowForm(false);
  }
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 bg-[#030305]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-5%,rgba(212,175,55,0.22),transparent_55%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_50%_40%_at_0%_50%,rgba(80,60,140,0.07),transparent)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_50%_40%_at_100%_80%,rgba(212,175,55,0.06),transparent)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_100%_100%_at_50%_50%,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
      <div
        className="pointer-events-none fixed inset-0 animate-grid opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(212,175,55,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="pointer-events-none fixed top-[12%] left-[8%] h-32 w-32 animate-float-orb rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none fixed top-[60%] right-[5%] h-40 w-40 animate-float-orb rounded-full bg-purple-500/8 blur-3xl [animation-delay:2s]" />

      <div className="relative z-10 flex flex-col items-center px-4 py-12 sm:px-6 sm:py-16 md:py-20">
        <div className="relative mb-8 sm:mb-10">
          <div className="pointer-events-none absolute top-1/2 left-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/15 animate-pulse-ring sm:h-72 sm:w-72" />
          <div className="pointer-events-none absolute top-1/2 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/8 animate-pulse-ring-outer sm:h-96 sm:w-96" />
          <div className="animate-fade-up flex justify-center">
            <CrownIcon />
          </div>
        </div>

        <main className="flex w-full max-w-2xl flex-col items-center text-center">
          <div className="animate-fade-up delay-100 space-y-4 sm:space-y-5">
            <SeasonBadge />
            <h1 className="font-display text-gold-glow text-[1.65rem] font-black leading-tight tracking-[0.12em] uppercase sm:text-4xl md:text-[2.75rem] md:tracking-[0.15em]">
              <span className="bg-gradient-to-b from-[#fff8dc] via-gold-light via-40% to-gold-dark bg-clip-text text-transparent">
                THE KING OF INTERNET
              </span>
            </h1>
            <p className="font-game mx-auto max-w-md text-[11px] font-medium tracking-[0.25em] text-zinc-500 uppercase sm:text-xs sm:tracking-[0.3em]">
              Steal the crown. Rule the internet.
            </p>
          </div>

  
          {/* Current King Card */}
          <div className="animate-fade-up delay-300 mt-10 w-full sm:mt-12">
            <div className="card-premium relative overflow-hidden rounded-2xl p-6 sm:rounded-3xl sm:p-8">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gold/[0.07] via-transparent to-purple-500/[0.04]" />
              <div className="pointer-events-none absolute -top-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
              <div className="pointer-events-none absolute top-0 right-0 h-32 w-32 bg-[radial-gradient(circle,rgba(212,175,55,0.12),transparent_70%)]" />

              <div className="relative flex items-center justify-center gap-2">
                <span className="h-px w-8 bg-gradient-to-r from-transparent to-gold/50 sm:w-12" />
                <p className="font-game text-[11px] font-bold tracking-[0.3em] text-gold uppercase sm:text-xs">
                  Current King
                </p>
                <span className="h-px w-8 bg-gradient-to-l from-transparent to-gold/50 sm:w-12" />
              </div>

              <div className="relative mt-7 space-y-5 text-left sm:mt-8 sm:space-y-6">
                <div className="grid grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <Label>Name</Label>
                    <p className="mt-1.5 font-display text-2xl font-bold text-white sm:text-3xl">
                    {firebaseKing.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <Label>Country</Label>
                    <p className="mt-1.5 font-display text-2xl font-bold text-white sm:text-3xl">
                    {firebaseKing.country}
                    </p>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-xl border border-gold/15 bg-black/40 px-5 py-4 sm:py-5">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-gold/5 via-transparent to-gold/5" />
                  <Label>Total donated this season</Label>
                  <p className="relative mt-1 font-display text-4xl font-black text-gold sm:text-5xl">
                  {formatCurrency(firebaseKing.amount)}
                  </p>
                  <div className="relative mt-3 border-t border-gold/10 pt-3">
                    <p className="font-game text-[10px] tracking-[0.15em] text-zinc-500 uppercase">
                      Donations add up
                    </p>
                    <div className="mt-2">
                      <SeasonTotalVisual
                        donations={MOCK_KING.donationHistory}
                        total={MOCK_KING.seasonTotal}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Latest message</Label>
                  <p className="mt-2 text-base leading-relaxed text-zinc-300 sm:text-lg">
                    &ldquo;{firebaseKing.message}&rdquo;
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-gold/15 bg-black/40 px-5 py-4">
                  <Label>Time as king</Label>
                  <p className="font-mono text-lg font-bold tabular-nums tracking-wide text-gold-light sm:text-xl">
                    {formatTime(elapsed)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Kings */}
          <HowItWorksSection />

<button
  type="button"
  onClick={() => setShowForm(true)}
  className="animate-fade-up delay-600 group relative mt-8 w-full max-w-md overflow-hidden rounded-2xl px-8 py-5 font-game text-base font-bold tracking-[0.25em] text-black uppercase transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_50px_rgba(212,175,55,0.45)] active:scale-[0.98] sm:mt-10 sm:py-6 sm:text-lg"
  style={{
    background:
      "linear-gradient(135deg, #fff8dc 0%, #f5e6a3 15%, #d4af37 45%, #c9a227 55%, #f5e6a3 85%, #fff8dc 100%)",
  }} 
>
  <span className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
  <span className="relative drop-shadow-sm">BECOME KING</span>
</button>
{showForm && (
  <form
    onSubmit={handleBecomeKing}
    className="mt-6 w-full max-w-md space-y-3 rounded-2xl border border-gold/20 bg-black/40 p-5 text-left"
  >
    <input
      className="w-full rounded-xl border border-gold/20 bg-black/60 px-4 py-3 text-white outline-none"
      placeholder="Your name"
      value={formData.name}
      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
    />

    <input
      className="w-full rounded-xl border border-gold/20 bg-black/60 px-4 py-3 text-white outline-none"
      placeholder="Country"
      value={formData.country}
      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
    />

    <input
      className="w-full rounded-xl border border-gold/20 bg-black/60 px-4 py-3 text-white outline-none"
      placeholder="Amount"
      type="number"
      value={formData.amount}
      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
    />

    <input
      className="w-full rounded-xl border border-gold/20 bg-black/60 px-4 py-3 text-white outline-none"
      placeholder="Message"
      maxLength={50}
      value={formData.message}
      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
    />

    <button
      type="submit"
      className="w-full rounded-xl bg-gold px-4 py-3 font-bold text-black"
    >
      SUBMIT TEST KING
    </button>
  </form>
)}
{/* Recent Kings */}
          <section className="animate-fade-up delay-400 mt-14 w-full sm:mt-16">
            <div className="section-divider mb-8 sm:mb-10" />
            <div className="mb-8 space-y-2 text-left sm:mb-10 sm:text-center">
              <h2 className="font-game text-sm font-bold tracking-[0.35em] text-gold uppercase sm:text-base">
                Recent Kings
              </h2>
              <p className="text-sm text-zinc-500">
                Former crown holders and their season totals
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {(firebaseDonations.length > 0 ? firebaseDonations : MOCK_RECENT_KINGS).map((king, index) => (
                <RecentKingCard
                  key={king.name}
                  king={king}
                  rank={index + 1}
                  className={
                    index === MOCK_RECENT_KINGS.length - 1
                      ? "sm:col-span-2 sm:mx-auto sm:w-full sm:max-w-md"
                      : ""
                  }
                />
              ))}
            </div>
          </section>

          <HallOfFameSection />
          <StatisticsSection />
          <CountryRankingSection />
          <GlobalLeaderboardSection />
          <ActivityFeedSection />
          <SeasonInfoSection />
          <BiggestDonationSection />
        </main>
      </div>
    </div>
  );
}
