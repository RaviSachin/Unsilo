// Centralized Tailwind recipes. Keep visual tokens here so the UI stays consistent.
export const ui = {
  glass:"border border-white/[.08] bg-white/[.035] backdrop-blur-xl",
  card:"rounded-2xl border border-white/[.08] bg-[#191c1e]/90 shadow-[0_18px_70px_rgba(0,0,0,.22)]",
  muted:"text-[#a6a09a]",
  eyebrow:"text-[10px] font-bold uppercase tracking-[.22em] text-[#e6a65b]",
  button:"inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40",
  primary:"bg-[#f0a34a] text-[#21170f] shadow-[0_0_30px_rgba(240,163,74,.12)] hover:-translate-y-0.5 hover:bg-[#d8ff8b]",
  secondary:"border border-white/10 bg-white/[.04] text-white hover:border-[#f0a34a]/40 hover:bg-white/[.08]",
  input:"w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#f0a34a]/60 focus:ring-2 focus:ring-[#f0a34a]/10",
  badge:"inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold"
};
