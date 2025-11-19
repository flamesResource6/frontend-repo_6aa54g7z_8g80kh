import { useEffect, useMemo, useRef, useState } from "react";
import {
  Flame,
  Trophy,
  Users,
  Bell,
  Play,
  Pause,
  Star,
  Crown,
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  BarChart3,
  Sparkles,
  Megaphone,
  ThumbsUp,
} from "lucide-react";

// Single-file React app for Jain Premier League (JPL) Season 9
// Focus: Live Match Center + Fantasy Hub with AI-style suggestions

const TEAMS = [
  { id: "JPL-1", name: "Mumbai Monarchs", short: "MM", color: "#0ea5e9" },
  { id: "JPL-2", name: "Pune Panthers", short: "PP", color: "#f59e0b" },
  { id: "JPL-3", name: "Surat Stallions", short: "SS", color: "#22c55e" },
  { id: "JPL-4", name: "Jaipur Jaguars", short: "JJ", color: "#ef4444" },
  { id: "JPL-5", name: "Ahmedabad Arrows", short: "AA", color: "#a78bfa" },
  { id: "JPL-6", name: "Indore Invincibles", short: "II", color: "#fb7185" },
];

const STADIUMS = [
  { id: "STAD-1", name: "Sardar Patel Stadium", city: "Ahmedabad" },
  { id: "STAD-2", name: "Wankhede", city: "Mumbai" },
  { id: "STAD-3", name: "MCA International", city: "Pune" },
  { id: "STAD-4", name: "SMS Stadium", city: "Jaipur" },
  { id: "STAD-5", name: "Holkar Stadium", city: "Indore" },
  { id: "STAD-6", name: "Lalbhai Contractor", city: "Surat" },
];

// Seed players per team (batters, allrounders, bowlers)
const seedPlayers = (team) => {
  const roles = [
    { role: "BAT", weight: 0.35 },
    { role: "AR", weight: 0.2 },
    { role: "BWL", weight: 0.45 },
  ];
  const names = [
    "A. Shah",
    "R. Jain",
    "M. Mehta",
    "P. Doshi",
    "V. Kothari",
    "S. Sanghvi",
    "D. Lodha",
    "K. Oswal",
    "Y. Gada",
    "T. Bafna",
    "N. Choradia",
    "J. Bohra",
    "B. Golechha",
  ];
  return new Array(12).fill(0).map((_, i) => {
    const role = roles[Math.floor(Math.random() * roles.length)].role;
    const credit = 6 + Math.round(Math.random() * 5 * 10) / 10; // 6.0 - 11.0
    return {
      id: `${team.id}-P${i + 1}`,
      name: `${names[i % names.length]}`,
      team: team.short,
      teamId: team.id,
      role,
      credit,
      // performance seeds
      seasonRuns: Math.floor(Math.random() * 380),
      seasonWkts: Math.floor(Math.random() * 20),
      strikeRate: 110 + Math.floor(Math.random() * 60),
      economy: 6 + Math.round(Math.random() * 6 * 10) / 10,
      form: Array.from({ length: 5 }, () => Math.floor(Math.random() * 100)),
    };
  });
};

const ROSTERS = TEAMS.reduce((acc, t) => {
  acc[t.id] = seedPlayers(t);
  return acc;
}, {});

const makeFixture = (i) => {
  const a = TEAMS[i % TEAMS.length];
  const b = TEAMS[(i + 2) % TEAMS.length];
  const venue = STADIUMS[i % STADIUMS.length];
  const date = new Date();
  date.setDate(date.getDate() + i - 2);
  const status = i === 2 ? "LIVE" : i < 2 ? "COMPLETED" : "UPCOMING";
  return {
    id: `FIX-${i + 1}`,
    a,
    b,
    venue,
    start: date,
    status,
  };
};

const FIXTURES = Array.from({ length: 12 }, (_, i) => makeFixture(i));

// Live engine simulation for one featured match (ball-by-ball)
function useLiveMatchSimulation(fixture) {
  const [state, setState] = useState(() => {
    return {
      status: fixture?.status || "UPCOMING",
      toss: Math.random() > 0.5 ? `${fixture.a.short} won the toss` : `${fixture.b.short} won the toss`,
      innings: 1,
      batting: fixture?.a.short,
      bowling: fixture?.b.short,
      overs: 0,
      ballsInOver: 0,
      runs: 0,
      wickets: 0,
      target: null,
      rr: 0,
      rrr: null,
      striker: pickBatter(fixture.a.id).name,
      nonStriker: pickBatter(fixture.a.id).name,
      bowler: pickBowler(fixture.b.id).name,
      commentary: [],
      battingCard: initBattingCard(fixture.a.id),
      bowlingCard: initBowlingCard(fixture.b.id),
      mvpVotes: {},
      poll: { question: "Who will win today?", options: [fixture.a.short, fixture.b.short], votes: {} },
    };
  });

  const timerRef = useRef(null);

  useEffect(() => {
    if (state.status !== "LIVE") return;
    timerRef.current = setInterval(() => {
      setState((prev) => simulateBall(prev, fixture));
    }, 900); // sub-second-ish
    return () => clearInterval(timerRef.current);
  }, [state.status, fixture]);

  const start = () => setState((s) => ({ ...s, status: "LIVE" }));
  const pause = () => setState((s) => ({ ...s, status: "PAUSED" }));
  const reset = () => setState((s) => ({ ...s, status: "UPCOMING", overs: 0, ballsInOver: 0, runs: 0, wickets: 0, commentary: [], battingCard: initBattingCard(fixture.a.id), bowlingCard: initBowlingCard(fixture.b.id) }));

  return { state, setState, start, pause, reset };
}

function pickBatter(teamId) {
  const bats = ROSTERS[teamId].filter((p) => p.role !== "BWL");
  return bats[Math.floor(Math.random() * bats.length)];
}
function pickBowler(teamId) {
  const bwl = ROSTERS[teamId].filter((p) => p.role !== "BAT");
  return bwl[Math.floor(Math.random() * bwl.length)];
}

function initBattingCard(teamId) {
  const batters = ROSTERS[teamId].filter((p) => p.role !== "BWL").slice(0, 7);
  return batters.map((p, i) => ({ id: p.id, name: p.name, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, order: i + 1 }));
}
function initBowlingCard(teamId) {
  const bowlers = ROSTERS[teamId].filter((p) => p.role !== "BAT").slice(0, 6);
  return bowlers.map((p) => ({ id: p.id, name: p.name, overs: 0, balls: 0, runs: 0, wkts: 0, econ: 0 }));
}

function simulateBall(prev, fixture) {
  // if paused
  if (prev.status !== "LIVE") return prev;

  let {
    innings,
    batting,
    bowling,
    overs,
    ballsInOver,
    runs,
    wickets,
    target,
    rr,
    rrr,
    striker,
    nonStriker,
    bowler,
    commentary,
    battingCard,
    bowlingCard,
    mvpVotes,
    poll,
  } = JSON.parse(JSON.stringify(prev));

  // generate random ball outcome
  const outcomes = [0, 1, 2, 3, 4, 6, "W", "Wd", "Nb"];
  const weights = [0.28, 0.24, 0.12, 0.05, 0.18, 0.08, 0.04, 0.008, 0.008];
  const outcome = weightedChoice(outcomes, weights);

  // update strike and cards
  const strikerIdx = battingCard.findIndex((b) => b.name === striker);
  const bowlerIdx = bowlingCard.findIndex((b) => b.name === bowler);
  if (strikerIdx === -1 || bowlerIdx === -1) return prev;

  let ballText = "";
  let ballCounted = true; // legal delivery or not

  if (outcome === "Wd" || outcome === "Nb") {
    runs += 1;
    ballText = `${overText(overs, ballsInOver)} ${outcome}! +1`;
    ballCounted = false;
    bowlingCard[bowlerIdx].runs += 1;
  } else if (outcome === "W") {
    wickets += 1;
    battingCard[strikerIdx].balls += 1;
    ballsInOver += 1;
    bowlingCard[bowlerIdx].balls += 1;
    ballText = `${overText(overs, ballsInOver)} WICKET!`;
    battingCard[strikerIdx].out = true;
    // new batter comes in
    const next = pickBatter(TEAMS.find((t) => t.short === batting).id).name;
    striker = next;
    battingCard.push({ id: `${batting}-${Date.now()}`, name: next, runs: 0, balls: 0, fours: 0, sixes: 0, out: false });
    bowlingCard[bowlerIdx].wkts += 1;
  } else {
    const r = outcome;
    runs += r;
    battingCard[strikerIdx].runs += r;
    battingCard[strikerIdx].balls += 1;
    if (r === 4) battingCard[strikerIdx].fours += 1;
    if (r === 6) battingCard[strikerIdx].sixes += 1;
    bowlingCard[bowlerIdx].runs += r;
    bowlingCard[bowlerIdx].balls += 1;
    ballsInOver += 1;
    ballText = `${overText(overs, ballsInOver)} ${r} run${r !== 1 ? "s" : ""}`;
    if (r % 2 === 1) {
      [striker, nonStriker] = [nonStriker, striker];
    }
  }

  // Over rollover
  if (ballsInOver === 6) {
    ballsInOver = 0;
    overs += 1;
    // change bowler and swap strike
    [striker, nonStriker] = [nonStriker, striker];
    const nextBowler = pickBowler(TEAMS.find((t) => t.short === bowling).id).name;
    bowler = nextBowler;
    bowlingCard[bowlerIdx].overs += 1;
  }

  // compute rates
  const totalBalls = overs * 6 + ballsInOver;
  rr = totalBalls ? (runs / totalBalls) * 6 : 0;
  if (innings === 2 && target) {
    const ballsLeft = 120 - totalBalls;
    const runsNeeded = Math.max(0, target - runs);
    rrr = ballsLeft > 0 ? (runsNeeded / ballsLeft) * 6 : 0;
  }

  // innings switch
  if (innings === 1 && (overs === 20 || wickets === 10)) {
    innings = 2;
    target = runs + 1;
    bowling = prev.batting;
    batting = prev.bowling;
    striker = pickBatter(TEAMS.find((t) => t.short === batting).id).name;
    nonStriker = pickBatter(TEAMS.find((t) => t.short === batting).id).name;
    bowler = pickBowler(TEAMS.find((t) => t.short === bowling).id).name;
    overs = 0;
    ballsInOver = 0;
    runs = 0;
    wickets = 0;
    rr = 0;
    rrr = (target / 120) * 6;
    battingCard = initBattingCard(TEAMS.find((t) => t.short === batting).id);
    bowlingCard = initBowlingCard(TEAMS.find((t) => t.short === bowling).id);
    ballText = `Innings break. Target: ${target}`;
  }

  // match end
  if (innings === 2) {
    const totalBalls2 = overs * 6 + ballsInOver;
    if (runs >= target || overs === 20 || wickets === 10) {
      const result = runs >= target ? `${batting} won by ${10 - wickets} wickets` : `${bowling} won by ${target - runs - 1} runs`;
      commentary = [
        { t: Date.now(), text: `RESULT: ${result}` },
        ...commentary,
      ];
      return { ...prev, status: "COMPLETED", overs, ballsInOver, runs, wickets, striker, nonStriker, bowler, commentary, batting, bowling, rr, rrr, target, innings, battingCard, bowlingCard, mvpVotes, poll };
    }
  }

  commentary = [{ t: Date.now(), text: ballText }, ...commentary].slice(0, 40);

  // econ update
  bowlingCard = bowlingCard.map((b) => ({ ...b, econ: b.overs || b.balls ? (b.runs / Math.max(1, b.overs * 6 + (b.balls % 6))) * 6 : 0 }));

  return { ...prev, overs, ballsInOver, runs, wickets, striker, nonStriker, bowler, commentary, batting, bowling, rr, rrr, target, innings, battingCard, bowlingCard, mvpVotes, poll };
}

function weightedChoice(items, weights) {
  const s = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * s;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[0];
}

function overText(overs, balls) {
  return `${overs}.${balls}`;
}

function formatOvers(overs, balls) {
  return `${overs}.${balls}`;
}

function pct(n) {
  return Math.round(n * 100);
}

export default function App() {
  const [tab, setTab] = useState("LIVE");
  const featured = FIXTURES.find((f) => f.status === "LIVE") || FIXTURES[2];
  const { state, start, pause } = useLiveMatchSimulation(featured);

  const schedule = useMemo(() => FIXTURES, []);
  const pointsTable = useMemo(() => makePointsTable(), []);
  const orange = useMemo(() => topRuns(), []);
  const purple = useMemo(() => topWkts(), []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative">
      <BgEffects />
      <Header tab={tab} setTab={setTab} />

      {tab === "LIVE" && (
        <LiveCenter fixture={featured} live={state} onStart={start} onPause={pause} />
      )}
      {tab === "SCHEDULE" && <Schedule fixtures={schedule} />}
      {tab === "STATS" && (
        <Stats points={pointsTable} orange={orange} purple={purple} />
      )}
      {tab === "FANTASY" && <FantasyHub />} 
      {tab === "NEWS" && <NewsHub />} 

      <Footer />
    </div>
  );
}

function BgEffects() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-black" />
      <div className="absolute inset-0 opacity-25 bg-[radial-gradient(50%_50%_at_50%_50%,rgba(59,130,246,0.25),transparent_60%)]" />
      <div className="absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full bg-gradient-to-br from-rose-500/20 to-amber-500/20 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-[480px] h-[480px] rounded-full bg-gradient-to-br from-sky-500/20 to-emerald-500/20 blur-3xl" />
    </div>
  );
}

function Header({ tab, setTab }) {
  const nav = [
    { k: "LIVE", label: "Live", icon: Flame },
    { k: "SCHEDULE", label: "Schedule", icon: Calendar },
    { k: "STATS", label: "Stats", icon: BarChart3 },
    { k: "FANTASY", label: "Fantasy", icon: Trophy },
    { k: "NEWS", label: "News", icon: Megaphone },
  ];
  return (
    <header className="sticky top-0 z-20 backdrop-blur-xl bg-slate-900/60 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-gradient-to-tr from-sky-500 to-rose-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Flame className="text-white" size={20} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-sky-300/80">Jain Premier League</div>
            <div className="text-lg font-bold">Season 9</div>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-2">
          {nav.map(({ k, label, icon: Icon }) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 rounded-full text-sm flex items-center gap-2 transition ${
                tab === k
                  ? "bg-sky-500 text-white shadow shadow-sky-500/30"
                  : "hover:bg-white/5 text-slate-300"
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <button className="relative p-2 rounded-full hover:bg-white/5">
            <Bell size={18} />
            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-rose-500" />
          </button>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 text-xs text-slate-300">
            <Users size={14} /> 120,438 watching
          </div>
        </div>
      </div>
      {/* mobile nav */}
      <div className="md:hidden px-3 pb-3 flex gap-2">
        {nav.map(({ k, label }) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm ${
              tab === k ? "bg-sky-500 text-white" : "bg-white/5 text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </header>
  );
}

function LiveCenter({ fixture, live, onStart, onPause }) {
  const battingTeam = TEAMS.find((t) => t.short === live.batting);
  const bowlingTeam = TEAMS.find((t) => t.short === live.bowling);

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="rounded-2xl p-5 bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <TeamBadge team={fixture.a} active={live.batting === fixture.a.short} />
              <div className="text-2xl font-bold">vs</div>
              <TeamBadge team={fixture.b} active={live.batting === fixture.b.short} />
            </div>
            <div className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {fixture.status === "LIVE" || live.status === "LIVE" ? "LIVE" : live.status}
            </div>
          </div>

          {/* Score strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile label={`${live.batting} Score`} value={`${live.runs}/${live.wickets}`} sub={`${formatOvers(live.overs, live.ballsInOver)} ov`} color="from-sky-500 to-blue-500" />
            <StatTile label="Run Rate" value={live.rr.toFixed(2)} sub="CRR" color="from-emerald-500 to-teal-500" />
            <StatTile label="Req. Rate" value={live.rrr ? live.rrr.toFixed(2) : "-"} sub={live.target ? `Target ${live.target}` : "1st Inn."} color="from-amber-500 to-orange-500" />
            <StatTile label="Innings" value={`${live.innings}`} sub={`${live.batting} batting`} color="from-fuchsia-500 to-pink-500" />
          </div>

          <div className="mt-5 grid md:grid-cols-3 gap-4">
            <div className="col-span-2 rounded-xl bg-white/5 p-4 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-slate-300">On Strike</div>
                <div className="text-xs text-slate-400">vs {live.bowler}</div>
              </div>
              <div className="flex items-center gap-4">
                <Pill text={live.striker} color="bg-sky-500/20 text-sky-200" />
                <span className="text-slate-500 text-sm">&</span>
                <Pill text={live.nonStriker} color="bg-sky-500/10 text-sky-200" />
              </div>
              <div className="mt-4 flex gap-3">
                {fixture.status !== "LIVE" && live.status !== "LIVE" ? (
                  <button onClick={onStart} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm inline-flex items-center gap-2">
                    <Play size={16} /> Start Simulation
                  </button>
                ) : (
                  <button onClick={onPause} className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm inline-flex items-center gap-2">
                    <Pause size={16} /> Pause
                  </button>
                )}
                <div className="ml-auto text-xs text-slate-400 flex items-center gap-2">
                  <Clock size={14} /> {fixture.venue.name} • {fixture.venue.city}
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-4 border border-white/10">
              <div className="text-xs text-slate-400">Current Bowler</div>
              <div className="text-lg font-semibold">{live.bowler}</div>
              <div className="mt-2 text-xs text-slate-400">For {bowlingTeam.short}</div>
              <div className="mt-3 flex gap-2">
                <Pill text="MVP Vote" color="bg-amber-500/20 text-amber-200" />
                <Pill text="Fan Poll" color="bg-indigo-500/20 text-indigo-200" />
              </div>
            </div>
          </div>
        </div>

        {/* Commentary & Polls */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-slate-900/80 p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="inline-flex items-center gap-2 text-slate-200 font-semibold">
                <Sparkles size={16} className="text-sky-400" /> Ball-by-Ball
              </div>
              <div className="text-xs text-slate-400">Auto-refresh</div>
            </div>
            <div className="space-y-2 max-h-72 overflow-auto pr-2">
              {live.commentary.length === 0 && (
                <div className="text-slate-400 text-sm">Waiting for play to begin…</div>
              )}
              {live.commentary.map((c) => (
                <div key={c.t} className="text-sm px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                  {c.text}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <MvpVoting live={live} battingTeam={battingTeam} bowlingTeam={bowlingTeam} />
            <FanPoll live={live} />
          </div>
        </div>

        {/* Scorecards */}
        <div className="rounded-2xl bg-slate-900/80 p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-3 font-semibold">
            <Trophy size={16} className="text-amber-400" /> Scorecard
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-slate-300 mb-2">Batting - {live.batting}</div>
              <div className="overflow-auto rounded-lg border border-white/10">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/5 text-slate-300">
                    <tr>
                      <th className="text-left p-2">Batter</th>
                      <th className="text-right p-2">R(B)</th>
                      <th className="text-right p-2">4s</th>
                      <th className="text-right p-2">6s</th>
                    </tr>
                  </thead>
                  <tbody>
                    {live.battingCard.map((b, i) => (
                      <tr key={i} className="odd:bg-white/0 even:bg-white/5">
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded ${b.name === live.striker ? "bg-sky-500/20 text-sky-200" : "bg-white/5 text-slate-200"}`}>{b.name}</span>
                          {b.out && <span className="ml-2 text-rose-400 text-xs">out</span>}
                        </td>
                        <td className="p-2 text-right">{b.runs} ({b.balls})</td>
                        <td className="p-2 text-right">{b.fours}</td>
                        <td className="p-2 text-right">{b.sixes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-300 mb-2">Bowling - {live.bowling}</div>
              <div className="overflow-auto rounded-lg border border-white/10">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/5 text-slate-300">
                    <tr>
                      <th className="text-left p-2">Bowler</th>
                      <th className="text-right p-2">O</th>
                      <th className="text-right p-2">R</th>
                      <th className="text-right p-2">W</th>
                      <th className="text-right p-2">Econ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {live.bowlingCard.map((b, i) => (
                      <tr key={i} className="odd:bg-white/0 even:bg-white/5">
                        <td className="p-2">{b.name}</td>
                        <td className="p-2 text-right">{Math.floor(b.balls / 6)}.{b.balls % 6}</td>
                        <td className="p-2 text-right">{b.runs}</td>
                        <td className="p-2 text-right">{b.wkts}</td>
                        <td className="p-2 text-right">{b.econ.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right rail */}
      <div className="space-y-6">
        <MatchInfo fixture={fixture} live={live} />
        <SocialStream />
        <MediaHighlights />
      </div>
    </main>
  );
}

function TeamBadge({ team, active }) {
  return (
    <div className="flex items-center gap-2">
      <div className="size-9 rounded-lg border border-white/10 flex items-center justify-center" style={{ background: `${team.color}22` }}>
        <Crown size={16} style={{ color: team.color }} />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-slate-400">{team.short}</div>
        <div className="font-semibold" style={{ color: active ? team.color : undefined }}>{team.name}</div>
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, color }) {
  return (
    <div className={`rounded-xl p-4 bg-gradient-to-br ${color} bg-opacity-10 border border-white/10`}> 
      <div className="text-xs text-white/80">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-white/70">{sub}</div>
    </div>
  );
}

function Pill({ text, color = "bg-white/10 text-slate-200" }) {
  return <span className={`px-2 py-1 rounded-full text-xs ${color}`}>{text}</span>;
}

function MvpVoting({ live, battingTeam, bowlingTeam }) {
  const [votes, setVotes] = useState({});
  const candidates = [
    { name: live.striker, team: battingTeam.short },
    { name: live.nonStriker, team: battingTeam.short },
    { name: live.bowler, team: bowlingTeam.short },
  ];
  const total = Object.values(votes).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="rounded-2xl bg-slate-900/80 p-4 border border-white/10">
      <div className="flex items-center gap-2 mb-2 font-semibold">
        <Star size={16} className="text-amber-400" /> Live MVP Voting
      </div>
      <div className="space-y-3">
        {candidates.map((c) => {
          const count = votes[c.name] || 0;
          const p = (count / total) * 100;
          return (
            <div key={c.name} className="">
              <div className="flex items-center justify-between text-sm mb-1">
                <div className="flex items-center gap-2">
                  <Pill text={c.team} />
                  <div>{c.name}</div>
                </div>
                <div className="text-slate-300 text-xs">{p.toFixed(0)}%</div>
              </div>
              <div className="h-2 rounded bg-white/10 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-500 to-rose-500" style={{ width: `${p}%` }} />
              </div>
              <div className="mt-2">
                <button onClick={() => setVotes((v) => ({ ...v, [c.name]: (v[c.name] || 0) + 1 }))} className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/15">Vote</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FanPoll({ live }) {
  const [votes, setVotes] = useState({});
  const total = Object.values(votes).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="rounded-2xl bg-slate-900/80 p-4 border border-white/10">
      <div className="flex items-center gap-2 mb-2 font-semibold">
        <ThumbsUp size={16} className="text-indigo-400" /> Fan Poll
      </div>
      <div className="text-sm text-slate-300 mb-3">{live.poll.question}</div>
      <div className="space-y-2">
        {live.poll.options.map((opt) => (
          <button
            key={opt}
            onClick={() => setVotes((v) => ({ ...v, [opt]: (v[opt] || 0) + 1 }))}
            className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10"
          >
            <div className="flex items-center justify-between">
              <div>{opt}</div>
              <div className="text-xs text-slate-400">{Math.round(((votes[opt] || 0) / total) * 100)}%</div>
            </div>
            <div className="mt-1 h-1.5 rounded bg-white/10 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-sky-500" style={{ width: `${((votes[opt] || 0) / total) * 100}%` }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MatchInfo({ fixture, live }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 border border-white/10">
      <div className="text-sm text-slate-300 mb-3">Match Info</div>
      <div className="space-y-2 text-sm">
        <InfoRow icon={Calendar} label="Date" value={fixture.start.toDateString()} />
        <InfoRow icon={Clock} label="Time" value={fixture.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} />
        <InfoRow icon={MapPin} label="Venue" value={`${fixture.venue.name}, ${fixture.venue.city}`} />
        <InfoRow icon={Crown} label="Toss" value={live.toss} />
      </div>
      <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300">
        {live.innings === 1 ? (
          <div>
            Powerplay ongoing. Field restrictions apply. Strategic timeout at 10 overs.
          </div>
        ) : (
          <div>
            Chasing {live.target}. Required run rate: {live.rrr?.toFixed(2) || "-"}.
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="size-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
        <Icon size={16} className="text-slate-300" />
      </div>
      <div className="text-slate-400 min-w-20 text-xs">{label}</div>
      <div className="font-medium text-slate-200">{value}</div>
    </div>
  );
}

function SocialStream() {
  const items = [
    { h: "#JPL9", text: "What a shot! 90m six straight down the ground." },
    { h: "@JPL_Official", text: "Toss at 7PM. Stay tuned for line-ups." },
    { h: "#Monarchs", text: "Bowling change works instantly!" },
  ];
  return (
    <div className="rounded-2xl bg-slate-900/80 p-4 border border-white/10">
      <div className="text-sm font-semibold mb-2">Social Stream</div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm">
            <span className="text-sky-400 mr-2">{it.h}</span>
            {it.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function MediaHighlights() {
  return (
    <div className="rounded-2xl bg-slate-900/80 p-4 border border-white/10">
      <div className="text-sm font-semibold mb-2">Media & Highlights</div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="aspect-video rounded-lg bg-gradient-to-tr from-sky-800/30 to-slate-700/30 border border-white/10 flex items-center justify-center text-xs text-slate-300">
            Video {i}
          </div>
        ))}
      </div>
    </div>
  );
}

function Schedule({ fixtures }) {
  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {fixtures.map((f) => (
          <div key={f.id} className="rounded-2xl p-4 bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10">
            <div className="flex items-center justify-between text-xs mb-3">
              <div className={`px-2 py-1 rounded-full border ${f.status === "LIVE" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : f.status === "COMPLETED" ? "border-slate-400/30 bg-white/5 text-slate-300" : "border-sky-400/30 bg-sky-500/10 text-sky-300"}`}>{f.status}</div>
              <div className="text-slate-400">{f.start.toDateString()}</div>
            </div>
            <div className="flex items-center justify-between">
              <TeamBadge team={f.a} />
              <div className="text-slate-400 text-xs">vs</div>
              <TeamBadge team={f.b} />
            </div>
            <div className="mt-3 text-xs text-slate-400 flex items-center gap-2">
              <MapPin size={14} /> {f.venue.name}, {f.venue.city}
            </div>
            <button className="mt-4 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm">
              View Details <ChevronRight size={16} />
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}

function Stats({ points, orange, purple }) {
  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-slate-900/80 p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-3 font-semibold">
            <BarChart3 size={16} className="text-sky-400" /> Points Table
          </div>
          <div className="overflow-auto rounded-lg border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5 text-slate-300">
                <tr>
                  <th className="text-left p-2">Team</th>
                  <th className="text-right p-2">P</th>
                  <th className="text-right p-2">W</th>
                  <th className="text-right p-2">L</th>
                  <th className="text-right p-2">NRR</th>
                  <th className="text-right p-2">Pts</th>
                </tr>
              </thead>
              <tbody>
                {points.map((r) => (
                  <tr key={r.team} className="odd:bg-white/0 even:bg-white/5">
                    <td className="p-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                      {r.team}
                    </td>
                    <td className="p-2 text-right">{r.p}</td>
                    <td className="p-2 text-right">{r.w}</td>
                    <td className="p-2 text-right">{r.l}</td>
                    <td className="p-2 text-right">{r.nrr.toFixed(2)}</td>
                    <td className="p-2 text-right">{r.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-6">
          <CapCard title="Orange Cap - Most Runs" color="from-amber-500 to-orange-500" list={orange.map((p) => ({ label: `${p.name} (${p.team})`, value: p.runs }))} />
          <CapCard title="Purple Cap - Most Wickets" color="from-violet-500 to-fuchsia-500" list={purple.map((p) => ({ label: `${p.name} (${p.team})`, value: p.wkts }))} />
        </div>
      </div>
    </main>
  );
}

function CapCard({ title, color, list }) {
  return (
    <div className="rounded-2xl p-4 bg-slate-900/80 border border-white/10">
      <div className="text-sm font-semibold mb-3">{title}</div>
      <div className="space-y-2">
        {list.map((i, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <div className={`size-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center font-bold`}>{idx + 1}</div>
            <div className="flex-1">
              <div className="text-sm">{i.label}</div>
              <div className="h-1.5 bg-white/10 rounded mt-1 overflow-hidden">
                <div className="h-full bg-white/70" style={{ width: `${Math.min(100, (i.value / (list[0]?.value || 1)) * 100)}%` }} />
              </div>
            </div>
            <div className="text-sm font-semibold w-10 text-right">{i.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FantasyHub() {
  const [budget, setBudget] = useState(100);
  const allPlayers = useMemo(() => Object.values(ROSTERS).flat(), []);
  const [team, setTeam] = useState([]); // selected players
  const [cv, setCv] = useState({ c: null, vc: null });
  const [leagueJoined, setLeagueJoined] = useState(false);

  const creditsUsed = team.reduce((s, p) => s + p.credit, 0);
  const creditsLeft = budget - creditsUsed;

  const add = (p) => {
    if (team.find((x) => x.id === p.id)) return;
    if (creditsLeft - p.credit < 0) return;
    if (team.length >= 11) return;
    setTeam([...team, p]);
  };
  const remove = (p) => setTeam(team.filter((x) => x.id !== p.id));

  const suggestion = useMemo(() => aiSuggest(allPlayers, team), [allPlayers, team]);

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="rounded-2xl p-4 bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-semibold">Create Your Fantasy Team</div>
            <div className="text-sm text-slate-300">Credits: <span className="font-bold text-white">{creditsLeft.toFixed(1)}</span> / {budget}</div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-white/5 p-3 border border-white/10">
              <div className="text-xs text-slate-400 mb-2">Available Players</div>
              <div className="max-h-[380px] overflow-auto space-y-2 pr-2">
                {allPlayers.slice(0, 120).map((p) => (
                  <div key={p.id} className="p-2 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2">
                      <Pill text={p.team} />
                      <div className="font-medium flex-1">{p.name}</div>
                      <div className="text-xs text-slate-400 w-12">{p.role}</div>
                      <div className="text-xs text-slate-300 w-12">{p.credit.toFixed(1)}</div>
                      <button onClick={() => add(p)} className="px-2 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white">Add</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-white/5 p-3 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-slate-400">Your XI ({team.length}/11)</div>
                <div className="text-xs text-slate-400">C/VC</div>
              </div>
              <div className="space-y-2 max-h-[380px] overflow-auto pr-2">
                {team.map((p) => (
                  <div key={p.id} className="p-2 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2">
                      <Pill text={p.team} />
                      <div className="font-medium flex-1">{p.name}</div>
                      <div className="text-xs text-slate-400 w-10">{p.role}</div>
                      <div className="text-xs text-slate-300 w-10">{p.credit.toFixed(1)}</div>
                      <button onClick={() => setCv({ ...cv, c: p.id })} className={`px-2 py-1 text-xs rounded ${cv.c === p.id ? "bg-amber-600" : "bg-white/10 hover:bg-white/15"}`}>C</button>
                      <button onClick={() => setCv({ ...cv, vc: p.id })} className={`px-2 py-1 text-xs rounded ${cv.vc === p.id ? "bg-amber-400" : "bg-white/10 hover:bg-white/15"}`}>VC</button>
                      <button onClick={() => remove(p)} className="px-2 py-1 text-xs rounded bg-rose-600 hover:bg-rose-500 text-white">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => {
                    if (team.length === 11 && cv.c && cv.vc && cv.c !== cv.vc) setLeagueJoined(true);
                  }}
                  className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm"
                >
                  Join Contest
                </button>
                <button
                  onClick={() => {
                    // apply suggestion as quick fill
                    const picks = suggestion.recommended.filter((id) => !team.find((t) => t.id === id)).map((id) => allPlayers.find((p) => p.id === id));
                    const merged = [...team];
                    for (const p of picks) {
                      if (!p) continue;
                      if (merged.length >= 11) break;
                      const left = budget - merged.reduce((s, x) => s + x.credit, 0);
                      if (left - p.credit >= 0) merged.push(p);
                    }
                    setTeam(merged);
                    if (!cv.c && merged[0]) setCv((c) => ({ ...c, c: merged[0].id }));
                    if (!cv.vc && merged[1]) setCv((c) => ({ ...c, vc: merged[1].id }));
                  }}
                  className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm inline-flex items-center gap-2"
                >
                  <Sparkles size={16} /> Smart Fill
                </button>
              </div>
              {leagueJoined && (
                <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300">
                  You're in! Weekly insights will be generated based on your XI.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-4 bg-slate-900/80 border border-white/10">
          <div className="flex items-center gap-2 mb-3 font-semibold">
            <Sparkles size={16} className="text-fuchsia-400" /> FLAMES Prediction Engine
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-3">
              <InsightCard title="Captaincy" desc={suggestion.captaincy.text} />
              <InsightCard title="Transfers" desc={suggestion.transfers.text} />
              <InsightCard title="Matchup" desc={suggestion.matchup.text} />
            </div>
            <div className="rounded-xl p-3 bg-white/5 border border-white/10">
              <div className="text-xs text-slate-400 mb-2">Recommended XI</div>
              <div className="space-y-1 text-sm">
                {suggestion.recommended.slice(0, 11).map((id) => {
                  const p = allPlayers.find((x) => x.id === id);
                  if (!p) return null;
                  return (
                    <div key={id} className="flex items-center gap-2">
                      <Pill text={p.team} />
                      <div className="flex-1">{p.name}</div>
                      <div className="text-xs text-slate-400">{p.role}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right rail */}
      <div className="space-y-6">
        <div className="rounded-2xl p-4 bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10">
          <div className="text-sm text-slate-300 mb-2">Weekly Personalized Summary</div>
          <div className="text-sm text-slate-200">
            Based on your picks, your projected score is trending upward. Focus on death-over bowlers from slow pitches and top-order batters batting first. Captain recommendation is high-impact all-rounder; vice-captain as in-form opener.
          </div>
        </div>

        <div className="rounded-2xl p-4 bg-slate-900/80 border border-white/10">
          <div className="text-sm font-semibold mb-2">Secure Transactions</div>
          <div className="text-sm text-slate-300">Payments and wallet integrations are supported in production. This demo focuses on team strategy and AI insights.</div>
        </div>
      </div>
    </main>
  );
}

function InsightCard({ title, desc }) {
  return (
    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
      <div className="text-xs text-slate-400">{title}</div>
      <div className="text-sm">{desc}</div>
    </div>
  );
}

function NewsHub() {
  const items = [
    { t: "Interview", h: "Skipper on strategy", p: "We back our middle order to deliver under pressure.", c: "from-rose-500/20 to-orange-500/20" },
    { t: "Report", h: "Panthers edge thriller", p: "Last-over drama as Pune clinch a 1-run win.", c: "from-sky-500/20 to-emerald-500/20" },
    { t: "Feature", h: "Spin to win", p: "Why wrist-spinners dominate in the middle overs.", c: "from-violet-500/20 to-fuchsia-500/20" },
  ];
  return (
    <main className="max-w-7xl mx-auto px-4 py-6 grid md:grid-cols-3 gap-6">
      {items.map((it, i) => (
        <div key={i} className={`rounded-2xl p-5 bg-gradient-to-br ${it.c} border border-white/10`}>
          <div className="text-xs uppercase tracking-wider text-slate-300">{it.t}</div>
          <div className="mt-2 text-lg font-semibold">{it.h}</div>
          <div className="mt-2 text-sm text-slate-300">{it.p}</div>
          <button className="mt-4 inline-flex items-center gap-2 text-sky-300 text-sm">Read more <ChevronRight size={16} /></button>
        </div>
      ))}
    </main>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 mt-8">
      <div className="max-w-7xl mx-auto px-4 py-6 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>© 2025 JPL Season 9 • Demo experience</div>
        <div className="flex items-center gap-3">
          <a className="hover:text-slate-200" href="#">Privacy</a>
          <a className="hover:text-slate-200" href="#">Terms</a>
          <a className="hover:text-slate-200" href="#">Support</a>
        </div>
      </div>
    </footer>
  );
}

// ---- Mock data helpers for Stats ----
function makePointsTable() {
  return TEAMS.map((t) => ({
    team: t.name,
    color: t.color,
    p: 8 + Math.floor(Math.random() * 2),
    w: 4 + Math.floor(Math.random() * 5),
    l: 4 + Math.floor(Math.random() * 3),
    nrr: (Math.random() * 1.2 - 0.6),
    pts: 8 + Math.floor(Math.random() * 10),
  })).sort((a, b) => b.pts - a.pts || b.nrr - a.nrr);
}
function topRuns() {
  const all = Object.values(ROSTERS).flat().map((p) => ({ name: p.name, team: p.team, runs: p.seasonRuns + Math.floor(Math.random() * 50) }));
  return all.sort((a, b) => b.runs - a.runs).slice(0, 5);
}
function topWkts() {
  const all = Object.values(ROSTERS).flat().map((p) => ({ name: p.name, team: p.team, wkts: p.seasonWkts + Math.floor(Math.random() * 5) }));
  return all.sort((a, b) => b.wkts - a.wkts).slice(0, 5);
}

// ---- AI Suggestion heuristic ----
function aiSuggest(pool, currentTeam) {
  // Score players using weighted features: form, role balance, venue hints, and season stats
  const currentIds = new Set(currentTeam.map((p) => p.id));
  const roleNeed = roleNeeds(currentTeam);
  const scored = pool.map((p) => {
    const formAvg = p.form.reduce((a, b) => a + b, 0) / p.form.length;
    const roleBonus = p.role === roleNeed ? 12 : 0;
    const battingScore = p.seasonRuns / 8 + p.strikeRate / 3;
    const bowlingScore = p.seasonWkts * 8 - p.economy * 2;
    const base = (p.role === "BAT" ? battingScore : p.role === "BWL" ? bowlingScore : battingScore * 0.7 + bowlingScore * 0.7) + formAvg * 0.4 + roleBonus;
    const valueAdj = 10 - p.credit; // cheaper gets small boost
    return { p, score: base + valueAdj };
  });
  const recommended = scored
    .filter(({ p }) => !currentIds.has(p.id))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p.id)
    .slice(0, 15);

  const cap = pickBestCaptain(pool, currentTeam);

  return {
    recommended,
    captaincy: {
      text: `Captain ${cap.c?.name || "an all-rounder in top form"} and vice-captain ${cap.vc?.name || "a powerplay specialist"} to maximize points from both innings.`,
    },
    transfers: {
      text: `Prioritize players with strong last-5 form and favorable venue matchups. Consider swapping out any player with economy > 9.0 or SR < 120.`,
    },
    matchup: {
      text: `Slow surfaces will aid spinners in the middle overs; pick at least two wrist-spinners and a finisher who strikes > 150 in death overs.`,
    },
  };
}

function roleNeeds(team) {
  const counts = team.reduce(
    (acc, p) => {
      acc[p.role] = (acc[p.role] || 0) + 1;
      return acc;
    },
    { BAT: 0, AR: 0, BWL: 0 }
  );
  const target = { BAT: 5, AR: 2, BWL: 4 };
  const deficit = Object.keys(target)
    .map((k) => ({ k, d: target[k] - counts[k] }))
    .sort((a, b) => b.d - a.d)[0];
  return deficit.k;
}

function pickBestCaptain(pool, team) {
  const scored = pool.map((p) => {
    const formAvg = p.form.reduce((a, b) => a + b, 0) / p.form.length;
    const impact = p.seasonRuns * 0.2 + p.seasonWkts * 10 + formAvg;
    const balance = p.role === "AR" ? 15 : 0;
    return { p, s: impact + balance };
  });
  const sorted = scored.sort((a, b) => b.s - a.s).map((x) => x.p);
  return { c: sorted[0], vc: sorted[1] };
}
