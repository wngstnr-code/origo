# Origo: Frontend References

Open-source projects with live deployments, checked on 2026-10-09 (GitHub API for activity and license, HTTP 200 on every live link). Use them for **design and UX patterns**. Only copy code from MIT, Apache-2.0, or BSD projects, with attribution; GPL and custom-licensed projects are reference only (our repo is MIT).

## Landing page

| Project | Live | Code | License | What to take |
| --- | --- | --- | --- | --- |
| Dub | https://dub.co | https://github.com/dubinc/dub (24.9k stars, active) | Custom (reference only) | Calm monochrome hero, one strong headline, product UI as the hero visual, small feature pills |
| Magic UI | https://magicui.design, template demo https://startup-template-sage.vercel.app | https://github.com/magicuidesign/magicui (22.5k stars, active) | MIT | Animated accents (border beam, marquee, number ticker) for a "before and after" hero |
| Launch UI | https://www.launchuicomponents.com | https://github.com/launch-ui/launch-ui (active) | MIT | Dark landing sections on shadcn/ui and Tailwind v4: hero, features, FAQ, CTA |
| Precedent | https://precedent.dev | https://github.com/steven-tey/precedent (last push 2024) | MIT | Minimal one-page structure, subtle motion |
| shadcn/ui | https://ui.shadcn.com | https://github.com/shadcn-ui/ui (125k stars) | MIT | Base component system (buttons, dialogs, tabs, toasts) |

## App: verification and image UX (closest to Origo)

| Project | Live | Code | License | What to take |
| --- | --- | --- | --- | --- |
| Content Credentials Verify (closest competitor) | https://verify.contentauthenticity.org (redirect from contentcredentials.org/verify) | https://github.com/contentauth/c2pa-js | MIT (library) | Two-column layout: drop zone left, provenance details right; plain-language result |
| Squoosh | https://squoosh.app | https://github.com/GoogleChromeLabs/squoosh (26k stars, active) | Apache-2.0 | Fully client-side image processing, big friendly drop zone, sample images to try, side-by-side compare slider (query vs registered thumbnail) |
| Sourcify | https://sourcify.dev | https://github.com/argotorg/sourcify (active) | MIT | Verification status language and badges ("exact match", "partial match"), a pattern for our evidence ranking |

## App: web3 without friction

| Project | Live | Code | License | What to take |
| --- | --- | --- | --- | --- |
| Mera (passkey accounts) | https://mera.category.xyz | https://github.com/category-labs/mera | Apache-2.0 | Passkey onboarding copy and flow (our account layer) |
| ENS Manager | https://app.ens.domains | https://github.com/ensdomains/ens-app-v3 (active) | MIT | Profile and record pages, a pattern for "Me" and creator profiles |
| Uniswap Interface | https://app.uniswap.org | https://github.com/Uniswap/interface | GPL-3.0 (reference only) | Transaction states: review, signing, pending, confirmed with explorer link |
| Safe{Wallet} | https://app.safe.global | https://github.com/safe-global/safe-wallet-monorepo | GPL-3.0 (reference only) | Multi-party signing, a pattern for the relay link (one signs, another pays) |
| RainbowKit | https://rainbowkit.com | https://github.com/rainbow-me/rainbowkit | MIT | Injected-wallet fallback modal (G7) |

## Proposed direction (to confirm with the owner)

- **Landing:** Dub-style calm monochrome plus one Magic UI accent. The hero is a live "before and after": a WhatsApp-compressed copy next to the original with "Found: original by @creator, block #...".
- **App:** Content Credentials two-column verify layout plus Squoosh-style drop zone, sample photos, and compare slider plus Sourcify-style evidence badges.
- **Stack:** Tailwind v4 + shadcn/ui (MIT) inside the existing Vite app.
