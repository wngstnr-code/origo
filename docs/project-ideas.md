# Monad Metropolis: Winner Analysis and 5 Project Ideas

As of October 9, 2026. Hackathon details (rubric, tracks, bounties, rules) are in [hackathon.md](./hackathon.md).

**Constraints used:** no mock data and no self-owned backend. The architecture: static frontend (client-side/local-first) + smart contracts on Monad + public APIs and decentralized infrastructure (RPC, Envio, Chainlink CRE, IPFS).

---

## 1. Previous Monad hackathon winners

| Event | Winners | Project type |
| --- | --- | --- |
| **evm/accathon** (Feb to Mar 2025, Monad's first hackathon) | KiSignals, Gorillionaire, MonFundMe, StakeFun, OwnPay, StitchAI | Sentiment terminal, AI trading signals + execution, crowdfunding, staking game, payments, AI |
| **Monad Madness NYC** (Oct 2024, pitch) | Earnos (1), Sauce.GG (2), Levr.bet (3) | Digital ads, DEX, prediction entertainment |
| **Monad Madness Bangkok** (Nov 2024) | RareBetSports, Kizzy, Sparkball | Sports betting, consumer mobile, game |
| **Monad Madness Hong Kong** (Apr 2025) | AMMO (multi-agent), GM (AI longevity), TypeX (transactions from the keyboard) | Agent infra, AI health, UX that hides crypto |
| **Moltiverse** (Feb 2026, 400+ submissions, 16 winners) | Claw IO, Soulbyte, Monagotchi, ChainMMO, MoltGit, Moltmatch, Chaos Arena, The Reef, etc. | Agent + token, agent games, arenas |
| **Rebel in Paradise AI** (Mar 2026, 11 winners) | **OpenAlice (champion)**: a trading agent that runs locally and transparently; TickPay: per-second/per-API-call payments; A2A IntentPool; AgentVerse (x402); Libra (version control for AI code) | Local agents, micro-payments, agent infra |

Sources: [Envio: Monad hackathon winners](https://docs.envio.dev/blog/announcing-the-monad-envio-hackathon-winners), [Monad Madness NYC](https://www.chaincatcher.com/en/article/2146002), [Monad Madness Bangkok](https://x.com/monad/status/1858575157176234439), [Monad Madness HK](https://panews.io/articles/y390l6bi), [Monad Pulse #018 (Moltiverse)](https://themonadpulse.substack.com/p/the-monad-pulse-018), [Rebel in Paradise](https://www.kucoin.com/news/flash/monad-ai-hackathon-concludes-with-11-winning-projects-and-major-llm-partnerships). Metropolis has no winners yet because the announcement is on Nov 3.

### Patterns that made them win

1. **A complete flow from start to action**, not just a dashboard. Gorillionaire won because signals could be executed immediately (0x API), then rounded out with a leaderboard, Nillion gating, and Privy login.
2. **Monad's speed is part of the feature.** TickPay (pay per second), Gorillionaire and MonFundMe (real-time tracking via Envio), order books, and real-time games.
3. **Crypto is hidden from the user.** TypeX (transactions from the keyboard) and Kizzy (consumer mobile). The Track 02 judges explicitly look for the "first five minutes".
4. **Meaningful use of several sponsor tools.** Every sponsor tool used means a DevRel judge who cares, plus a bounty opportunity.
5. **Transparency and local-first are rewarded.** The Rebel in Paradise champion (OpenAlice) is an agent that *runs locally* with a transparent workspace. This fits the no-backend constraint.

### What judges reward vs. what tends to be ignored

- **Rewarded:** a product that runs in the video; a specific target user; a concrete "why Monad" reason; startup-style pitches with a business model (the judges are dominated by VCs: Paradigm, Dragonfly, Pantera, Electric, Galaxy).
- **Ignored:** raw data dashboards (Nansen even wrote "beyond exposing raw data"), login-only integrations (Privy wrote "login-only will not qualify"), projects that could move to another EVM chain unchanged, and decks without a product.

### Ideas that appear too often (best avoided)

AI trading signals/bots, arenas or agent games with tokens, generic prediction markets, memecoin launchpads, copy trading, generic NFT ticketing, crowdfunding, generic remittance apps, creator tipping, and "ChatGPT + wallet". Moltiverse alone received 400+ submissions, most of them agent + token.

### Lessons applied to the ideas below

- Pick problems that **genuinely need Monad's latency or cost** (400ms, ~10k TPS, cheap gas).
- **One wow moment that can be proven live** in the 3-minute video.
- A **very specific** target user and a local story (Indonesia/Southeast Asia) that few other participants bring.
- Stack **1 to 3 bounties** that fit naturally, not forced.
- For Track 04: ship a **primitive + SDK + example app**, because the rules require "infrastructure used by other applications".

---

## 2. Market landscape per track

| Track | Real unsolved problem | Existing players | Gap |
| --- | --- | --- | --- |
| 01 Finance | Markets for non-crypto underlyings (local commodities, weather, compute) barely exist onchain; oracles for real-world data are expensive | Perpl (perps), Kuru (spot order book), Polymarket-style | Hedging markets for assets with no exchange (local food prices) |
| 02 Consumer | Informal financial systems (arisan (rotating savings group), rekber (third-party escrow), iuran (group dues)) run on blind trust; micro-insurance for gig workers barely exists | Bank apps, e-wallets, Celo/ROSCA apps, Etherisc (parametric) | Per-hour/per-minute products that are only economical on a cheap, fast chain |
| 03 Social | Offline communities (arisan, fandoms, collectives) have no portable reputation record | Farcaster, Lens, fan platforms | Traditional social mechanics brought onchain with rules enforced by code |
| 04 Trust/AI | Provenance metadata (C2PA) is lost when an image is compressed or screenshotted (WhatsApp, IG); AI memory is locked into a single vendor | C2PA/Content Credentials, Numbers Protocol, Truepic, Mem0, OpenAI Memory, Vana | Provenance based on *image content* (perceptual hash) that is searchable onchain; AI memory encrypted with user-owned keys |

Regulatory constraints to keep in mind: in Indonesia, crypto is **not allowed** as a means of payment (rupiah is mandatory), and crypto assets are supervised by OJK (the Financial Services Authority). For payment ideas, position the initial target on the diaspora/migrant workers or markets outside Indonesia, or use stablecoins as *savings/escrow*, not as a domestic payment instrument.

---

## 3. Five project ideas

### Idea 1: **Origo**, photo provenance that is still detected after WhatsApp compression
*Track 04 · Bounty: Mera "One Passkey, Many Keys", Envio*

**Summary:** an onchain registry of photo *visual fingerprints* (perceptual hashes), so an image that has been compressed, resized, or re-sent via WhatsApp can still be traced to its original creator and the time it was first registered.

- **Problem and target users:** photojournalists, newsrooms, and fact-checkers (e.g. fact-checking communities) whose photos are stolen or used for hoaxes. The C2PA standard puts provenance in *metadata*, and this metadata disappears as soon as a photo passes through WhatsApp, Instagram, or a screenshot. As a result, verification fails exactly where hoaxes spread.
- **Why it is non-mainstream:** other provenance projects sign the *file* (a cryptographic hash), which changes completely if even one pixel changes. Origo registers the *visual content*, and the search happens **directly in the smart contract** through multi-index hashing, with no search server.
- **Winner lessons applied:** a complete flow (register, spread, verify); runs locally like OpenAlice; ships a primitive + SDK + example app.
- **Rubric fulfillment:**
  - *Product:* drag-and-drop verification web app + "check this photo" extension + npm SDK.
  - *Technical:* 64-bit perceptual hash (pHash/dHash) computed in the browser via WASM. The hash is split into 4 16-bit segments and stored in `mapping(segment ⇒ id[])`. By the pigeonhole principle, any image within Hamming distance ≤ 3 must share at least one identical segment, so a search takes only 4 `view` calls followed by Hamming verification on the client. PDQ 256-bit (open source from Meta) is stored for a second, stricter verification.
  - *Monad:* bulk registration (a newsroom registering 10,000 archive photos) is cheap and fast. A photo can be registered the second it is taken, with ~800ms finality, and the block timestamp serves as proof of "who was first".
  - *Track fit:* a provenance primitive used by other applications, matching the official example "provenance for generated media that survives re-encoding".
  - *Innovation:* image similarity search fully onchain.
- **Real data sources:** users' own original photos; viral photos pulled straight from WhatsApp/IG during the demo; a dataset of freely licensed photos (Wikimedia Commons) to seed the initial registry.
- **Architecture without a backend:** static frontend (Vercel/IPFS) → WASM hashing in the browser → **Mera** passkey signature. The signing key is derived from PRF with HKDF (`"origo-signing"`), separate from the wallet key, which fits the "non-wallet use of PRF" bounty. Then the `OrigoRegistry` contract on Monad. Search via public RPC. History and feed via Envio HyperSync. Optional thumbnails stored on IPFS.
- **Business model:** free registry for the public. Newsrooms and platforms pay per bulk registration / API quota (contract-level fee or onchain subscription). There is also a paid "verified creator" badge. First users: 3 to 5 local photographers, fact-checking communities, and student press.
- **Wow moment:** a photographer takes a photo and registers it with Face ID. The photo is then sent to WhatsApp, screenshotted, slightly cropped, and compressed. The result is dragged into Origo, and in <1 second it shows "Original: @photographer, registered 14:02:31, block #…", complete with an explorer link.
- **Risks and hard judge questions:**
  - "What if a thief registers someone else's photo first?" → see the solution below: register at capture, original file proof (commit-reveal), stake + onchain dispute, and identity labels.
  - "Can heavy cropping or mirroring fool pHash?" → see the solution below: 8 orientation variants at verification, per-tile hashes for crops, and auto-trimming of screenshot borders.

#### Solutions to Origo's two main weaknesses

**A. The photo is heavily cropped or mirrored**

1. **Mirror/rotation: check 8 variants at verification.** When a user checks a photo, the browser computes the fingerprint for 8 orientations (4 rotations × normal/mirrored) and searches for all of them. The registry does not need to store anything extra. PDQ is designed with these dihedral variants, and the cost is only 8× local hashing + 32 `view` calls (free).
2. **Crop: per-tile fingerprints.** At registration, besides the full fingerprint, the photo is cut into a 3×3 grid of overlapping tiles, plus a center crop. Each tile has its own fingerprint. A cropped photo still contains several intact tiles, so Origo can find it and show "partial match: 4 of 9 parts, likely a crop of #123". The main fingerprint is stored in contract storage, while tile fingerprints go only in the event log (cheaper) and are read via Envio HyperSync.
3. **Screenshots: strip the border first.** Screenshots usually add a status bar, a black frame, or app UI. The browser trims uniformly colored edge areas before hashing.
4. **Be honest about the limits.** If less than ±25% of the photo remains, Origo shows "not enough evidence" instead of a guess. Judges value a system that knows its limits.

**B. A thief registers someone else's photo first**

The principle: Origo does not use "first = owner", but **shows the strongest evidence**.

1. **Register at capture (default).** The camera inside the Origo PWA registers the photo a few seconds after it is taken, before it has a chance to spread. Photos like this are labeled "Registered at capture", while photos uploaded from the gallery are labeled "Uploaded". Because Monad's finality is <1 second, a thief practically has no time window.
2. **Original file proof (commit-reveal).** At registration, Origo also stores the *cryptographic hash* of the full-resolution file (without uploading the file). If a dispute occurs, the original owner simply shows the original file: it has higher resolution, a wider image field, camera EXIF, and its hash matches the recorded one. The thief only has a WhatsApp copy, and **a copy always has less information than the original**. An 800 px photo cannot be turned back into a 6000 px file with a matching hash.
3. **Small stake + onchain dispute.** Every registration locks a small deposit (Monad gas is cheap, so the deposit can be very small). Anyone can file a counterclaim with evidence (B2). The stronger evidence is checked in the judge's/attester's browser. The losing party forfeits the deposit and its registration is marked "disputed - lost". So mass-registering stolen photos is a losing proposition.
4. **Identity labels.** Accounts verified by institutions (newsrooms, photographer associations) through onchain attestation are shown differently from anonymous accounts. The check result is not just "owned by X", but "owned by X (verified Tempo photographer), registered at capture, original file available".
5. **Duplicates cannot become a "new original".** If a registered photo turns out to be similar to an existing entry, the contract records it as "derived from #id", not as a new original registration.

**Result display:** Origo shows *evidence*, not a single verdict. Example: "First registrant: @x (uploaded from gallery). Counterclaim: @y (registered at capture, original resolution 6000 px, verified). Strongest evidence: @y."
  - "Buckets bloating at the scale of millions?" → longer segments or monthly sharding.
  - Strong competitors exist (Numbers Protocol, C2PA), and the organizers themselves list this idea, so the differentiation must be sharp.

### Idea 2: **Kocok**, an onchain auction arisan (rotating savings group) that resists fraud
*Track 03 · Bounty: Mera-Powered UX, Monad Community, Envio*

**Summary:** an arisan with rules enforced by a smart contract. Deposits are locked, turns are decided through a live sealed-bid auction, and participants who have already received the pot must post collateral so they cannot run away.

- **Problem and target users:** arisan is a very common social-financial institution in Indonesia, but "arisan bodong" (fraudulent arisan) cases (the organizer runs off, participants stop paying after receiving their turn) keep recurring. Initial target: **Indonesian migrant worker communities in Hong Kong/Taiwan** who actively take part in arisan, are paid in foreign currency, and are not subject to Indonesia's crypto payment ban. Next targets: office arisan and diaspora communities.
- **Why it is non-mainstream:** existing onchain ROSCA (rotating savings and credit association) projects (usually on Celo) just copy the standard draw-based arisan (arisan kocok). Kocok brings up the **auction arisan** variant, where participants bid a discount to get the pot earlier. This variant is an *informal credit market* that has never been built onchain. Deposit history also becomes **portable credit reputation**, which connects to the official idea "lending priced on onchain credit history".
- **Winner lessons applied:** crypto is hidden (TypeX, Kizzy); a specific local story; a real community (Track 03 judges look for "teams who have grown a community").
- **Rubric fulfillment:**
  - *Product:* mobile PWA to create a group, invite via WA (WhatsApp) link, deposit, auction, and withdraw.
  - *Technical:* sealed-bid commit-reveal auction per round; dynamic collateral scheme (early recipients lock collateral = remaining obligation − discount); automatic slashing if late; arisan history SBT.
  - *Monad:* a live auction during the arisan meeting. 20 people bid from their phones, then the reveal and winner selection finish in seconds with a very small cost per bid. On other L1s, this flow is too slow and expensive for ibu-ibu (housewives) bidding Rp50,000.
  - *Track fit:* the core value is social connection and community with financial mechanics, matching the Track 03 definition.
  - *Innovation:* auction arisan + credit reputation.
- **Real data sources:** real arisan groups (at least one test group of 5 to 10 people using small amounts of AUSD/USDC on mainnet); all state lives onchain.
- **Architecture without a backend:** static PWA → **Mera** passkey account (no seed phrase, no extension) → `ArisanFactory` + `ArisanGroup` contracts → events read via RPC/Envio. Invitations use a link containing the contract address. Due-date notifications use a local calendar (.ics) generated on the client.
- **Business model:** 0.5 to 1% fee on the pot per round, paid by the contract to the treasury. Later: lending based on arisan reputation. Acquisition: 2 to 3 migrant worker arisan groups via Facebook/WA communities, then viral effect because each group invites 10 to 20 people.
- **Wow moment:** an "arisan night" demo. Five phones bid live, the auction board updates in real time, the reveal happens, the winner receives the pot in <1 second, and then one participant who is "late paying" is automatically slashed from their collateral.
- **Risks and hard judge questions:**
  - Regulation: fund pooling and the status of stablecoins in users' jurisdictions.
  - "Why not use a regular app?" → because the problem is *trust in the organizer*, and the contract removes the organizer's role.
  - "What if all participants run away at once?" → collateral limits.
  - On/off-ramp for migrant workers (option: a fully client-side Mercuryo widget).

### Idea 3: **Teduh**, hourly rain insurance for ojol (ride-hailing motorbike) drivers
*Track 02 · Bounty: Chainlink CRE, Mera-Powered UX*

**Summary:** ojek/online courier drivers buy income protection for the next 1 to 3 hours for pocket change. If rainfall at their location passes a threshold, the payout arrives automatically with no claim.

- **Problem and target users:** during heavy rain or floods, gig drivers' income collapses because they cannot ride or orders dry up, and there is no insurance product for a risk this small and short. Target: gig drivers in tropical cities. Start with markets outside Indonesia's crypto payment ban (Philippines, Latin America), or position it as a community *mutual fund*.
- **Why it is non-mainstream:** existing onchain parametric insurance (Etherisc, Arbol) targets farmers or aviation with seasonal policies. Teduh offers **hourly policies**, per-minute premiums, and payouts in seconds. This matches the official idea "Micro-Insurance by the Minute" but with a very specific segment.
- **Winner lessons applied:** micro-payments that only make sense on Monad (TickPay); invisible crypto; one clear persona.
- **Rubric fulfillment:**
  - *Product:* a one-button PWA "Protect the next 2 hours", complete with a live rain radar and payout history.
  - *Technical:* the premium price is computed from the Open-Meteo forecast rain probability for that coordinate and hour, so **adverse selection** is handled (drivers cannot buy cheap right when the clouds have already darkened). Purchases close before the window starts. There is an underwriting LP pool with an exposure limit per geographic cell (geohash).
  - *Monad:* premiums of around Rp2,000 and 1-hour policies are only economical with very cheap gas; instant payouts with ~800ms finality; thousands of policies per hour in a single city.
  - *Track fit:* non-crypto consumers with financial experience as the core value.
- **Real data sources:** [Open-Meteo](https://open-meteo.com) (free, no API key, open CORS) for forecasts and actual rainfall; radar from RainViewer (public tiles); data is brought onchain through a **Chainlink CRE workflow** that reads Open-Meteo and writes the result to the contract.
- **Architecture without a backend:** PWA → Mera passkey account + browser geolocation → `TeduhPool` contract (premiums, LPs, exposure) → CRE workflow (a decentralized oracle network, not a self-owned server) reports rainfall per cell → the contract settles policies automatically.
- **Business model:** 10 to 15% premium spread for the protocol, the rest for LPs. Later: B2B2C to driver cooperatives or associations. Acquisition: driver gathering points (basecamp) and community WA groups.
- **Wow moment:** a demo in a city that *is raining at that moment* (real data from Open-Meteo). Buy a policy with Face ID, rain data crosses the threshold, the payout lands in the balance, and all of it happens live in the video.
- **Risks and hard judge questions:**
  - Basis risk: rain in a 1 to 11 km grid is not necessarily the same as rain on the driver's street.
  - Insurance licensing.
  - CRE readiness on Monad mainnet must be checked. Fallback: optimistic oracle with a dispute period.
  - "Who would want to be an LP?" → yield that is uncorrelated with the crypto market.

### Idea 4: **Pasar Cabai**, a food price hedging market for small traders
*Track 01 · Bounty: Kuru "Bring New Assets and Markets", Chainlink CRE*

**Summary:** forward/perp contracts on price indices for cabai (chili), bawang (shallots/garlic), and beras (rice), traded on Kuru's onchain order book, so warung (small food stall) owners or market sellers can lock in ingredient costs.

- **Problem and target users:** chili prices in Indonesia can spike several-fold within a few weeks, eroding the margins of warung padang (Padang food stalls), seblak (spicy snack) sellers, or sambal (chili sauce) traders. Formal commodity exchanges do not reach them. The main target users for Track 01 are **traders and market makers** who provide liquidity; small traders are the demand side.
- **Why it is non-mainstream:** prediction markets and crypto perps are already too crowded. This is "Options/markets on non-traditional underlyings" with a genuinely real and local underlying, and no onchain competitor yet.
- **Rubric fulfillment:**
  - *Technical:* a price index oracle using the median of several sources, a weekly settlement mechanism, and a margin vault.
  - *Monad:* a full onchain order book (Kuru) is only feasible on a chain with 400ms blocks and cheap gas.
  - *Track fit:* a new asset primitive and a new market structure.
- **Real data sources:** the National Food Agency (Badan Pangan Nasional) Price Panel and Bank Indonesia's PIHPS (daily price data per province), brought onchain via Chainlink CRE.
- **Architecture without a backend:** static frontend → Kuru SDK (order book) → `IndexOracle` + `ForwardMarket` contracts → CRE workflow fetches daily prices.
- **Business model:** market creation and settlement fees; index data can be licensed to SME (UMKM) fintechs.
- **Wow moment:** a chart of real chili prices over the last 12 months, then a simulation of "a trader locking in last month's price" showing how many rupiah were saved in an actual spike, followed by a live trade on the order book.
- **Risks and hard judge questions:** liquidity (who is the counterparty?); CORS and stability of government APIs (needs checking); derivatives regulation (Bappebti/OJK); warung traders may not want to use stablecoins. **The riskiest** of the five ideas.

### Idea 5: **Kunci**, encrypted AI memory you can bring to any AI app
*Track 04 · Bounty: Mera "One Passkey, Many Keys", Kimi, Qwen 3.8 Max*

**Summary:** a user-owned AI memory layer. Memory is encrypted with a key derived from a passkey, then each AI app gets limited access that can be revoked in one second.

- **Problem and target users:** the memory of ChatGPT, Claude, and others is locked into each vendor, so your context is lost when you switch apps. Cross-app memory services (Mem0) store your data on their servers. Target: AI power users and AI app developers who want to offer "portable memory" without having to store user data.
- **Why it is non-mainstream:** existing solutions are centralized or are data DAOs (Vana). Kunci uses the **passkey PRF as the root key**: one passkey becomes many per-app keys through HKDF, matching the Mera "non-wallet use" bounty exactly. Permissions and revocations are recorded onchain.
- **Rubric fulfillment:**
  - *Technical:* HKDF key hierarchy, per-memory envelope encryption, grants in the form of data keys re-wrapped for the app's public key, and key rotation when permission is revoked.
  - *Monad:* grant/revoke as cheap transactions with <1 second finality; small encrypted blobs can be stored as calldata/events.
  - *Track fit:* "Cross-Application AI Memory" and "Personal Data Locker" are in the official idea list.
- **Real data sources:** the user's real conversations with Kimi/Qwen (BYOK (bring your own key), called directly from the browser) and memories extracted from those conversations.
- **Architecture without a backend:** SDK in the browser → Mera PRF → local encryption (WebCrypto) → `MemoryVault` contract (pointer, grant, revoke) → blobs on IPFS or Monad calldata → LLM called directly from the client with the user's own API key.
- **Business model:** free SDK; AI apps pay per active user who brings memory; premium tier for storage.
- **Wow moment:** chat in app A (Kimi), then open app B (Qwen) and it remembers right away. Then revoke B's permission with Face ID, and B's next request fails in <1 second.
- **Risks and hard judge questions:** "Data already read by an app cannot be taken back" (honest answer: revoke only applies to future access); "Why is a blockchain needed, rather than just local encryption?" (cross-app permissions without a trusted server); LLM API CORS; adoption needs two sides (users and apps).

---

## 4. Comparison table

Scores 1 to 5 (5 = best). "No backend" measures how purely the idea runs without a self-owned server and without oracle dependency.

| Criteria | 1 Origo | 2 Kocok | 3 Teduh | 4 Pasar Cabai | 5 Kunci |
| --- | --- | --- | --- | --- | --- |
| Track | 04 | 03 | 02 | 01 | 04 |
| Real data without mocks | 5 | 4 | 5 | 4 | 5 |
| No backend / no oracle | **5** | **5** | 3 | 2 | 4 |
| Real problem + specific target | 4 | 5 | 5 | 4 | 3 |
| Non-mainstream | 4 | 5 | 4 | 5 | 3 |
| Rubric fit (5 × 20%) | 5 | 4 | 4 | 3 | 4 |
| Monad integration (why it must be Monad) | 4 | 4 | 5 | 5 | 3 |
| Business model + acquisition | 3 | 4 | 4 | 3 | 3 |
| Wow moment | **5** | 5 | 4 | 3 | 4 |
| Technical depth | **5** | 4 | 4 | 4 | 4 |
| Execution risk (5 = safest) | 4 | 4 | 3 | 1 | 3 |
| Additional bounty potential | Mera, Envio | Mera, Community, Envio | CRE, Mera | Kuru, CRE | Mera, Kimi, Qwen |
| **Total (out of 50)** | **44** | **44** | 41 | 34 | 36 |

## 5. Recommendation: **Origo** (with Kocok as the alternative)

Origo is recommended because:

1. **The only idea that is truly 100% without a backend and without an oracle.** Registration, similarity search, and verification all run in the browser + contract. The risk of "oracle = disguised backend" that burdens Teduh and Pasar Cabai does not exist.
2. **Its wow moment cannot be faked and is understood immediately:** "this photo went through WhatsApp and was screenshotted, yet its owner is still found in one second." This moment can be proven live in the 3-minute video.
3. **Its technical depth is something to be proud of in front of engineer judges:** WASM perceptual hashing, onchain multi-index hashing with the pigeonhole argument, and signing keys derived from the passkey PRF.
4. **A very good fit with the Track 04 definition** (primitive + SDK used by other applications) and with the organizers' official example, plus a chance at the Mera "One Passkey, Many Keys" bounty.
5. **A strong impact narrative for VC judges:** hoaxes and deepfakes in the AI era, with a clear B2B market (newsrooms, platforms, fact-checkers).

**When to choose Kocok:** if you are stronger in product/community than in cryptography, or have access to real arisan groups (especially migrant workers). Kocok has the most human and most non-mainstream story, and a chance at the Community bounty. Its downsides: the "why Monad" reasoning is slightly weaker, and there is fund-pooling regulatory risk.
