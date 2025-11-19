import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, serverTimestamp, getDoc } from 'firebase/firestore';

// --- CONFIGURATION AND DUMMY DATA ---

// Mandatory Global Variables for Canvas Environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

const ALL_TEAMS = [
  { id: 'JJ', name: 'Jaipur Jewels', color: 'bg-pink-700', text: 'text-pink-100', accent: 'border-pink-500', motto: 'The Gemstone of the West' },
  { id: 'MM', name: 'Mumbai Mavericks', color: 'bg-blue-700', text: 'text-blue-100', accent: 'border-blue-500', motto: 'The Champions of the Harbor' },
  { id: 'AA', name: 'Ahmedabad Aces', color: 'bg-orange-700', text: 'text-orange-100', accent: 'border-orange-500', motto: 'The Diamond City Strikers' },
  { id: 'DD', name: 'Delhi Dynamos', color: 'bg-red-700', text: 'text-red-100', accent: 'border-red-500', motto: "The Empire's Might" },
  { id: 'KK', name: 'Kolkata Knights', color: 'bg-purple-700', text: 'text-purple-100', accent: 'border-purple-500', motto: 'The Royal Bengal Tigers' },
  { id: 'BB', name: 'Bangalore Braves', color: 'bg-green-700', text: 'text-green-100', accent: 'border-green-500', motto: 'The Silicon Stunners' },
];

const MATCH_DATA = {
  id: 'JPL09_M12',
  teamA: ALL_TEAMS[0], // JJ
  teamB: ALL_TEAMS[1], // MM
  venue: 'Motera Stadium, Ahmedabad',
  status: 'Live',
  toss: 'Mumbai Mavericks won the toss and elected to bowl.',
};

const INITIAL_SCORE = {
  scoreA: 0,
  wicketsA: 0,
  oversA: 0.0,
  scoreB: 0,
  wicketsB: 0,
  oversB: 0.0,
  target: 0,
  currentInnings: 1,
  requiredRunRate: 0,
  currentRunRate: 0,
  lastBall: 0,
};

const DUMMY_POINTS_TABLE = [
    { team: 'Mumbai Mavericks', P: 8, W: 6, L: 2, NRR: +1.250, Pts: 12, accent: ALL_TEAMS[1].accent },
    { team: 'Jaipur Jewels', P: 7, W: 5, L: 2, NRR: +0.890, Pts: 10, accent: ALL_TEAMS[0].accent },
    { team: 'Ahmedabad Aces', P: 8, W: 4, L: 4, NRR: -0.150, Pts: 8, accent: ALL_TEAMS[2].accent },
    { team: 'Delhi Dynamos', P: 6, W: 3, L: 3, NRR: -0.520, Pts: 6, accent: ALL_TEAMS[3].accent },
    { team: 'Kolkata Knights', P: 7, W: 2, L: 5, NRR: -0.600, Pts: 4, accent: ALL_TEAMS[4].accent },
    { team: 'Bangalore Braves', P: 8, W: 1, L: 7, NRR: -1.370, Pts: 2, accent: ALL_TEAMS[5].accent },
];

const DUMMY_CAPS = {
    orange: [
        { name: 'R. Oswal (MM)', runs: 452, teamColor: ALL_TEAMS[1].color },
        { name: 'A. Shah (JJ)', runs: 420, teamColor: ALL_TEAMS[0].color },
    ],
    purple: [
        { name: 'K. Soni (BB)', wickets: 18, teamColor: ALL_TEAMS[5].color },
        { name: 'S. Patni (MM)', wickets: 16, teamColor: ALL_TEAMS[1].color },
    ]
};

// --- FIREBASE CONTEXT & INITIALIZATION ---

const FirebaseContext = React.createContext(null);

const FirebaseProvider = ({ children }) => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    useEffect(() => {
        if (!firebaseConfig) {
            console.error('Firebase config not found. Running in demo mode.');
            setIsAuthReady(true);
            return;
        }

        try {
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const authentication = getAuth(app);

            setDb(firestore);
            setAuth(authentication);
            setDoc(doc(firestore, 'debug', appId), {
                log: 'App initialized',
                timestamp: serverTimestamp(),
            }, { merge: true });

            const unsubscribe = onAuthStateChanged(authentication, (user) => {
                if (user) {
                    setUserId(user.uid);
                    setIsAuthReady(true);
                } else {
                    if (initialAuthToken) {
                        signInWithCustomToken(authentication, initialAuthToken)
                            .catch(e => {
                                console.error('Error signing in with custom token. Falling back to anonymous:', e);
                                signInAnonymously(authentication);
                            });
                    } else {
                        signInAnonymously(authentication);
                    }
                }
            });

            return () => unsubscribe();
        } catch (error) {
            console.error('Failed to initialize Firebase:', error);
            setIsAuthReady(true);
        }
    }, []);

    return (
        <FirebaseContext.Provider value={{ db, auth, userId, isAuthReady }}>
            {children}
        </FirebaseContext.Provider>
    );
};

const useFirebase = () => React.useContext(FirebaseContext);

// --- FIREBASE DATA HOOKS ---

// Hook for Live Match Feed (Public)
const useLiveMatchFeed = (matchId) => {
    const { db, isAuthReady } = useFirebase();
    const [feed, setFeed] = useState(null);

    const feedPath = useMemo(() => `artifacts/${appId}/public/data/liveMatchFeed/${matchId}`, [matchId]);

    useEffect(() => {
        if (!db || !isAuthReady) return;
        const ref = doc(db, feedPath);
        const unsub = onSnapshot(ref, (snap) => {
            if (snap.exists()) setFeed(snap.data());
            else setFeed(null);
        }, (err) => console.error('Live feed error:', err));
        return () => unsub();
    }, [db, isAuthReady, feedPath]);

    const pushUpdate = useCallback(async (data) => {
        if (!db) throw new Error('Database not ready');
        const ref = doc(db, feedPath);
        await setDoc(ref, { ...data, serverTimestamp: serverTimestamp() }, { merge: true });
    }, [db, feedPath]);

    return { feed, pushUpdate };
};

// Hook for fetching and updating public match votes
const useMatchVotes = (matchId) => {
    const { db, userId, isAuthReady } = useFirebase();
    const [fanPolls, setFanPolls] = useState({ poll: {}, mvp: {} });
    const [userVote, setUserVote] = useState({ poll: null, mvp: null });

    const docPath = useMemo(() => {
        return `artifacts/${appId}/public/data/matchVotes/${matchId}`;
    }, [matchId]);

    useEffect(() => {
        if (!db || !isAuthReady) return;

        const docRef = doc(db, docPath);

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setFanPolls({
                    poll: data.poll || {},
                    mvp: data.mvp || {},
                });
                if (userId && data.userVotes && data.userVotes[userId]) {
                    setUserVote(data.userVotes[userId]);
                }
            }
        }, (error) => {
            console.error('Error fetching match votes:', error);
        });

        return () => unsubscribe();
    }, [db, isAuthReady, docPath, userId]);

    const castVote = useCallback(async (type, option) => {
        if (!db || !userId) {
            console.warn('Authentication is required to vote.');
            return;
        }
        const fieldPath = type === 'poll' ? `poll.${option}` : `mvp.${option}`;
        const userPath = `userVotes.${userId}`;
        const docRef = doc(db, docPath);

        try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.userVotes && data.userVotes[userId] && data.userVotes[userId][type]) {
                    console.log(`User already voted for ${type}.`);
                    return;
                }
            }
            
            await setDoc(docRef, {
                [fieldPath]: (fanPolls[type][option] || 0) + 1,
                [userPath]: { ...userVote, [type]: option, votedAt: serverTimestamp() },
                lastUpdated: serverTimestamp(),
            }, { merge: true });

            setUserVote(prev => ({ ...prev, [type]: option }));

        } catch (error) {
            console.error('Error casting vote:', error);
        }
    }, [db, docPath, userId, fanPolls, userVote]);

    return { fanPolls, userVote, castVote };
};

// --- PRESENTATION COMPONENTS ---

const Header = ({ currentView, setView, isAuthReady, userId, adminMode, setAdminMode }) => {
    const navItems = [
        { name: 'Live', view: 'LIVE' },
        { name: 'Teams', view: 'TEAMS' },
        { name: 'Schedule', view: 'SCHEDULE' },
        { name: 'Stats', view: 'STATS' },
        { name: 'News', view: 'NEWS' },
    ];
    
    const displayUserId = userId || 'Authenticating...';

    return (
        <div className="bg-gray-900/80 backdrop-blur-md shadow-2xl fixed top-0 left-0 right-0 z-20 border-b border-white/10">
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
                <div className="flex justify-between items-center py-3">
                    <h1 className="text-2xl font-black tracking-wider bg-gradient-to-r from-yellow-300 via-rose-300 to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]">
                        JPL <span className="opacity-80">9</span>
                    </h1>
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex flex-col items-end text-[10px] sm:text-xs text-gray-400">
                            <span className="mb-1">{isAuthReady ? 'Authenticated' : 'Connecting...'}</span>
                            <span className="p-1 px-3 bg-gray-800/60 rounded-full text-[10px] sm:text-xs break-all border border-white/10" title={userId}>
                                <span className="text-gray-400">User</span> <span className="text-yellow-300 font-mono">{displayUserId}</span>
                            </span>
                        </div>
                        <button
                            onClick={() => setAdminMode(m => !m)}
                            className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg border transition shadow-md hover:shadow-xl active:scale-[0.98] ${adminMode ? 'bg-yellow-400/90 text-gray-900 border-yellow-300' : 'bg-white/5 text-white border-white/10 hover:bg-white/10'}`}
                            title="Toggle Admin Mode"
                        >
                            {adminMode ? 'Admin: ON' : 'Admin: OFF'}
                        </button>
                    </div>
                </div>
                <nav className="flex space-x-4 overflow-x-auto pb-2 -mb-2">
                    {navItems.map((item) => (
                        <button
                            key={item.view}
                            onClick={() => setView(item.view)}
                            className={`px-3 py-2 text-sm font-medium transition duration-200 ease-out rounded-md hover:bg-white/5 ${currentView === item.view
                                    ? 'text-yellow-300 bg-white/5 border border-yellow-300/30 shadow-[0_0_0_1px_rgba(250,204,21,0.2)]'
                                    : 'text-gray-300'
                                }`}
                        >
                            {item.name}
                        </button>
                    ))}
                </nav>
            </div>
        </div>
    );
};

const LiveScoreboard = ({ score, match }) => {
    const teamA = match.teamA;
    const teamB = match.teamB;
    const isTargetSet = score.target > 0;
    const isSecondInnings = score.currentInnings === 2;

    const battingTeam = isSecondInnings ? teamB : teamA;
    const bowlingTeam = isSecondInnings ? teamA : teamB;
    const battingScore = isSecondInnings ? score.scoreB : score.scoreA;
    const battingWickets = isSecondInnings ? score.wicketsB : score.wicketsA;
    const battingOvers = isSecondInnings ? score.oversB : score.oversA;

    const currentBatsman = isSecondInnings ? 'M. Gandhi' : 'A. Shah';
    const currentBowler = isSecondInnings ? 'J. Kothari' : 'S. Patni';
    const lastBallText = score.lastBall === 4 ? 'FOUR!' : score.lastBall === 6 ? 'SIX!' : score.lastBall === 0 ? 'Dot' : score.lastBall > 0 ? `${score.lastBall} Run` : 'WICKET!';

    return (
        <div className={`relative overflow-hidden rounded-2xl shadow-2xl p-5 sm:p-6 ${battingTeam.text}`}>
            <div className="absolute -inset-1 bg-gradient-to-br from-yellow-400/30 via-pink-500/20 to-cyan-400/30 blur-2xl opacity-40" />
            <div className="relative rounded-xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 border border-white/10">
                <div className="p-4 sm:p-6">
                    <div className="text-xs font-semibold opacity-80 mb-2 text-gray-300 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        {match.status} • JPL Season 9, Match 12 • {match.venue}
                    </div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2">
                            <span className="bg-white/10 px-2 py-1 rounded-md border border-white/10 shadow">{battingTeam.name}</span>
                            <span className="text-xl font-light text-yellow-300 drop-shadow">{battingScore}-{battingWickets}</span>
                        </div>
                        <div className="text-lg font-bold text-white/90">
                            {battingOvers.toFixed(1)} <span className="text-sm font-light text-gray-400">Overs</span>
                        </div>
                    </div>

                    {isTargetSet && (
                        <div className="text-sm font-medium mb-3 text-gray-200">
                            Target: <span className="text-white font-bold">{score.target}</span> • Required RR: <span className="font-bold text-rose-300">{score.requiredRunRate.toFixed(2)}</span>
                        </div>
                    )}

                    <div className="flex justify-between text-sm font-medium mb-1 border-t border-white/10 pt-3">
                        <div className="flex flex-col">
                            <span className="text-gray-400 text-xs">Batting</span>
                            <span className="font-bold text-white">{currentBatsman}</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-gray-400 text-xs">Bowling ({bowlingTeam.id})</span>
                            <span className="font-bold text-white">{currentBowler}</span>
                        </div>
                    </div>

                    <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-yellow-500/15 via-pink-500/15 to-cyan-500/15 text-center text-yellow-300 font-extrabold text-lg sm:text-xl">
                        Last Ball: {lastBallText}
                    </div>
                </div>
            </div>
        </div>
    );
};

const FanEngagement = ({ matchId }) => {
    const { fanPolls, userVote, castVote } = useMatchVotes(matchId);

    const pollOptions = ['JJ (Jaipur Jewels)', 'MM (Mumbai Mavericks)'];
    const mvpOptions = ['A. Shah', 'R. Oswal', 'J. Kothari', 'S. Patni'];

    const getPercentage = (votes, total) => (total > 0 ? ((votes / total) * 100).toFixed(0) : 0);

    const totalPollVotes = Object.values(fanPolls.poll).reduce((sum, v) => sum + v, 0);
    const totalMvpVotes = Object.values(fanPolls.mvp).reduce((sum, v) => sum + v, 0);

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">Interactive Fan Engagement (Real-Time)</h2>

            <div className="bg-white/5 border border-white/10 p-4 rounded-xl shadow-xl backdrop-blur">
                <h3 className="text-lg font-semibold text-yellow-300 mb-3">Fan Poll: Who will win this match?</h3>
                <div className="space-y-2">
                    {pollOptions.map(option => (
                        <div key={option} className="relative">
                            <button
                                onClick={() => castVote('poll', option)}
                                disabled={!!userVote.poll}
                                className={`w-full py-2 px-4 rounded-lg text-left transition ${userVote.poll === option
                                    ? 'bg-yellow-600 font-bold text-white'
                                    : 'bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10'
                                }`}
                            >
                                {option}
                            </button>
                            {!!userVote.poll && (
                                <div className="absolute inset-0 bg-gray-900/70 rounded-lg flex items-center overflow-hidden">
                                    <div
                                        style={{ width: `${getPercentage(fanPolls.poll[option] || 0, totalPollVotes)}%` }}
                                        className={`h-full ${option.includes('JJ') ? 'bg-pink-600/70' : 'bg-blue-600/70'} transition-all duration-500`}
                                    ></div>
                                    <span className="absolute left-2 text-white font-semibold drop-shadow">
                                        {option} ({getPercentage(fanPolls.poll[option] || 0, totalPollVotes)}%)
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                {!!userVote.poll && <p className="text-sm text-center mt-3 text-gray-400">Thank you for voting. Total votes: {totalPollVotes}</p>}
            </div>

            <div className="bg-white/5 border border-white/10 p-4 rounded-xl shadow-xl backdrop-blur">
                <h3 className="text-lg font-semibold text-yellow-300 mb-3">Vote for Player of the Match (MVP)</h3>
                <div className="grid grid-cols-2 gap-3">
                    {mvpOptions.map(player => (
                        <div key={player} className="relative">
                            <button
                                onClick={() => castVote('mvp', player)}
                                disabled={!!userVote.mvp}
                                className={`w-full py-2 px-4 rounded-lg text-left transition ${userVote.mvp === player
                                    ? 'bg-green-600 font-bold text-white'
                                    : 'bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10'
                                }`}
                            >
                                {player}
                            </button>
                            {!!userVote.mvp && (
                                <div className="absolute inset-0 bg-gray-900/70 rounded-lg flex items-center overflow-hidden">
                                    <div
                                        style={{ width: `${getPercentage(fanPolls.mvp[player] || 0, totalMvpVotes)}%` }}
                                        className="h-full bg-green-500/70 transition-all duration-500"
                                    ></div>
                                    <span className="absolute left-2 text-white font-semibold drop-shadow">
                                        {player} ({getPercentage(fanPolls.mvp[player] || 0, totalMvpVotes)}%)
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- TEAM VIEWS ---

const PlayerProfileView = ({ playerId, setSelectedPlayerId }) => {
    const player = TEAM_PLAYERS.find(p => p.id === playerId);
    const team = ALL_TEAMS.find(t => t.id === player.team);

    if (!player) return <p className="text-red-400">Player not found.</p>;

    return (
        <div className="space-y-6">
            <button
                onClick={() => setSelectedPlayerId(null)}
                className="text-yellow-300 hover:text-white transition mb-4 text-sm flex items-center"
            >
                 ← Back to Team Profile
            </button>
            <h2 className={`text-3xl font-black pb-2 flex items-center border-b border-white/10`}>
                <span className={`${team.color} ${team.text} px-3 py-1 rounded-full mr-3 text-sm`}>{team.name}</span>
                {player.name}
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6 bg-white/5 p-6 rounded-xl shadow-xl border border-white/10">
                <div className="space-y-4">
                    <p className="text-gray-400">Role: <span className="font-semibold text-white">{player.role}</span></p>
                    <p className="text-gray-300 italic">{player.bio}</p>
                </div>
                <div className="space-y-3">
                    <h3 className="text-xl font-bold text-yellow-300 border-b border-white/10 pb-1">Career Stats (Sample)</h3>
                    <div className="text-sm text-gray-400">
                        <p>Matches: 55 | Runs: 1520 | Wickets: 12</p>
                        <p>Highest Score: 89* | Economy: 7.2</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TEAM_PLAYERS = [
  { id: 'JJ01', name: 'A. Shah', role: 'BAT', team: 'JJ', bio: 'Dynamic opening batsman.' },
  { id: 'JJ02', name: 'V. Mehta', role: 'BAT', team: 'JJ', bio: 'Experienced middle-order anchor.' },
  { id: 'JJ03', name: 'J. Kothari', role: 'AR', team: 'JJ', bio: 'Premier all-rounder, excellent death bowler.' },
  { id: 'MM01', name: 'R. Oswal', role: 'BAT', team: 'MM', bio: 'Captain, power hitter.' },
  { id: 'MM02', name: 'S. Patni', role: 'BWL', team: 'MM', bio: 'Wily spin bowler.' },
  { id: 'MM03', name: 'M. Gandhi', role: 'AR', team: 'MM', bio: 'Impact player, explosive finisher.' },
];

const TeamProfileView = ({ teamId, setSelectedTeamId, setSelectedPlayerId }) => {
    const team = ALL_TEAMS.find(t => t.id === teamId);
    const roster = TEAM_PLAYERS.filter(p => p.team === teamId);
    const pointsData = DUMMY_POINTS_TABLE.find(p => p.team === team.name);

    return (
        <div className="space-y-6">
            <button
                onClick={() => setSelectedTeamId(null)}
                className="text-yellow-300 hover:text-white transition mb-4 text-sm flex items-center"
            >
                 ← Back to Teams List
            </button>
            <h2 className={`text-3xl font-black pb-2 flex items-center border-b border-white/10`}>
                <span className={`${team.color} ${team.text} px-3 py-1 rounded-full mr-3 text-sm`}>{team.id}</span>
                {team.name}
            </h2>
            <p className="text-gray-400 italic text-lg">{team.motto}</p>

            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1 bg-white/5 p-4 rounded-xl shadow-xl space-y-3 border border-white/10">
                    <h3 className="text-xl font-bold text-yellow-300">Current Standing</h3>
                    <p className="text-gray-300">Played: {pointsData.P} | Wins: {pointsData.W} | NRR: {pointsData.NRR}</p>
                    <p className="text-4xl font-black text-white">{pointsData.Pts} Pts</p>
                </div>
                <div className="md:col-span-2 bg-white/5 p-4 rounded-xl shadow-xl border border-white/10">
                    <h3 className="text-xl font-bold text-yellow-300 mb-3">Team Roster</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {roster.map(player => (
                            <button
                                key={player.id}
                                onClick={() => setSelectedPlayerId(player.id)}
                                className="bg-gray-900/40 p-3 rounded-lg text-left hover:bg-gray-800/60 transition border border-white/10"
                            >
                                <span className="font-semibold text-white truncate block">{player.name}</span>
                                <span className="text-xs text-gray-400">{player.role}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const TeamsListView = ({ setSelectedTeamId }) => (
    <div className="space-y-6">
        <h2 className="text-3xl font-bold text-white border-b border-white/10 pb-2">JPL Teams</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {ALL_TEAMS.map(team => (
                <button
                    key={team.id}
                    onClick={() => setSelectedTeamId(team.id)}
                    className={`p-6 rounded-xl shadow-xl transition transform hover:scale-[1.02] bg-white/5 border border-white/10 ${team.text} text-left`}
                >
                    <div className="text-3xl font-black">{team.id}</div>
                    <div className="text-xl font-bold mt-1">{team.name}</div>
                    <p className="text-sm italic opacity-80 mt-2">{team.motto}</p>
                    <span className="mt-3 inline-block text-xs font-semibold px-3 py-1 bg-white/10 rounded-full">View Profile →</span>
                </button>
            ))}
        </div>
    </div>
);

// --- OTHER VIEWS ---

const LiveFeedPanel = ({ feed }) => {
    if (!feed) return null;
    return (
        <div className="bg-white/5 p-4 rounded-xl shadow-xl border border-white/10">
            <h3 className="text-lg font-semibold text-yellow-300 mb-3">Live Feed (Firestore)</h3>
            <div className="grid sm:grid-cols-3 gap-3 text-sm text-gray-200">
                <div>Score: <span className="font-bold">{feed.score ?? '-'}</span></div>
                <div>Wickets: <span className="font-bold">{feed.wickets ?? '-'}</span></div>
                <div>Overs: <span className="font-bold">{(feed.overs ?? 0).toFixed ? feed.overs.toFixed(1) : feed.overs}</span></div>
                <div>Target: <span className="font-bold">{feed.target ?? '-'}</span></div>
                <div>Innings: <span className="font-bold">{feed.innings ?? '-'}</span></div>
                <div>Last Ball: <span className="font-bold">{feed.lastBall ?? '-'}</span></div>
            </div>
            {feed.lastCommentary && (
                <div className="mt-3 text-gray-300 italic">{feed.lastCommentary}</div>
            )}
        </div>
    );
};

const LiveMatchView = ({ score, match, liveFeed }) => (
    <div className="space-y-8">
        <LiveScoreboard score={score} match={match} />
        {liveFeed && <LiveFeedPanel feed={liveFeed} />}
        <p className="text-gray-400 text-sm">{match.toss}</p>
        <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <FanEngagement matchId={match.id} />
                <div className="bg-white/5 p-4 rounded-xl shadow-xl border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-2">Social Stream (#JPL9)</h3>
                    <p className="text-sm text-gray-400">Twitter/X feed placeholder for official JPL content and fan chatter.</p>
                    <div className="h-24 bg-gray-900/40 rounded mt-2 flex items-center justify-center text-gray-500 text-xs">Live feed content goes here...</div>
                </div>
            </div>
            <div className="space-y-4">
                <div className="bg-white/5 p-4 rounded-xl shadow-xl border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-2">Live Commentary</h3>
                    <div className="h-64 overflow-y-auto space-y-2 text-sm text-gray-300">
                        <p><span className="font-bold text-yellow-300">1.2</span> - <span className="text-green-400">FOUR!</span> A. Shah drives wide of mid-off.</p>
                        <p><span className="font-bold text-yellow-300">1.1</span> - Dot ball. Excellent line from S. Patni.</p>
                        <p><span className="font-bold text-yellow-300">0.6</span> - Single. V. Mehta rotates the strike.</p>
                        <p><span className="font-bold text-yellow-300">0.5</span> - <span className="text-red-400">WICKET!</span> V. Mehta run out. Oh dear, a mix-up!</p>
                        <p className="text-xs text-gray-500 text-center">--- Innings Break ---</p>
                    </div>
                </div>
                <div className="bg-white/5 p-4 rounded-xl shadow-xl border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-2">Video Highlights (Placeholder)</h3>
                    <div className="h-40 bg-gray-900/40 rounded flex items-center justify-center text-gray-500 text-xs">Video Player: Match Highlights</div>
                </div>
            </div>
        </div>
    </div>
);

const ScheduleView = () => (
    <div className="space-y-6">
        <h2 className="text-3xl font-bold text-white border-b border-white/10 pb-2">JPL Season 9 Schedule & Results</h2>
        <div className="bg-white/5 p-4 rounded-xl shadow-xl border border-white/10">
            <h3 className="text-xl font-semibold text-yellow-300 mb-4">Upcoming Fixtures</h3>
            <div className="space-y-3">
                {[
                    { date: 'Nov 20', match: 'AA vs BB', venue: 'Indore', status: 'Upcoming', team: ALL_TEAMS[2].accent },
                    { date: 'Nov 21', match: 'DD vs KK', venue: 'Pune', status: 'Upcoming', team: ALL_TEAMS[3].accent },
                    { date: 'Nov 22', match: 'JJ vs DD', venue: 'Mumbai', status: 'Upcoming', team: ALL_TEAMS[0].accent },
                ].map((item, index) => (
                    <div key={index} className={`flex justify-between items-center p-3 rounded-lg bg-gray-900/40 border-l-4 ${item.team}`}>
                        <div className="text-gray-300">{item.date}</div>
                        <div className="text-white font-semibold">{item.match}</div>
                        <div className="text-gray-400 text-sm">{item.venue}</div>
                    </div>
                ))}
            </div>
        </div>
        <div className="bg-white/5 p-4 rounded-xl shadow-xl border border-white/10">
            <h3 className="text-xl font-semibold text-yellow-300 mb-4">Completed Results</h3>
            <div className="space-y-3">
                {[
                    { result: 'MM beat AA by 5 wickets', venue: 'Delhi', team: ALL_TEAMS[1].accent },
                    { result: 'BB beat KK by 10 runs', venue: 'Bangalore', team: ALL_TEAMS[5].accent },
                ].map((item, index) => (
                    <div key={index} className={`flex justify-between items-center p-3 rounded-lg bg-gray-900/40 border-l-4 ${item.team}`}>
                        <div className="text-white font-semibold">{item.result}</div>
                        <div className="text-gray-400 text-sm">{item.venue}</div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const StatsView = () => (
    <div className="space-y-8">
        <h2 className="text-3xl font-bold text-white border-b border-white/10 pb-2">Statistics Hub</h2>
        
        <div className="bg-white/5 p-4 rounded-xl shadow-xl overflow-x-auto border border-white/10">
            <h3 className="text-xl font-semibold text-yellow-300 mb-4">Points Table</h3>
            <table className="min-w-full text-left text-sm text-gray-300">
                <thead>
                    <tr className="bg-white/5 text-white uppercase tracking-wider">
                        <th className="py-2 px-4">Team</th>
                        <th className="py-2 px-4">P</th>
                        <th className="py-2 px-4">W</th>
                        <th className="py-2 px-4">L</th>
                        <th className="py-2 px-4">NRR</th>
                        <th className="py-2 px-4">Pts</th>
                    </tr>
                </thead>
                <tbody>
                    {DUMMY_POINTS_TABLE.map((team, index) => (
                        <tr key={team.team} className={`border-b border-white/10 hover:bg-white/5`}>
                            <td className="py-2 px-4 font-semibold">{index + 1}. {team.team}</td>
                            <td className="py-2 px-4">{team.P}</td>
                            <td className="py-2 px-4">{team.W}</td>
                            <td className="py-2 px-4">{team.L}</td>
                            <td className="py-2 px-4">{team.NRR}</td>
                            <td className="py-2 px-4 font-bold">{team.Pts}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
            <Leaderboard title="Orange Cap (Most Runs)" data={DUMMY_CAPS.orange} valueKey="runs" unit="Runs" capColor="bg-orange-500" />
            <Leaderboard title="Purple Cap (Most Wickets)" data={DUMMY_CAPS.purple} valueKey="wickets" unit="Wickets" capColor="bg-purple-500" />
        </div>
    </div>
);

const Leaderboard = ({ title, data, valueKey, unit, capColor }) => (
    <div className="bg-white/5 p-4 rounded-xl shadow-xl border border-white/10">
        <h3 className={`text-xl font-bold text-white mb-4 flex items-center`}>
            <span className={`inline-block w-3 h-3 rounded-full mr-2 ${capColor}`}></span>
            {title}
        </h3>
        <ul className="space-y-3">
            {data.map((player, index) => (
                <li key={player.name} className="flex justify-between items-center p-3 bg-gray-900/40 rounded-lg">
                    <span className="text-lg font-bold mr-2 text-white/70">{index + 1}.</span>
                    <span className="flex-1 text-gray-200 font-medium">{player.name}</span>
                    <span className="text-yellow-300 font-bold">{player[valueKey]} {unit}</span>
                </li>
            ))}
        </ul>
    </div>
);

const NewsView = () => (
    <div className="space-y-6">
        <h2 className="text-3xl font-bold text-white border-b border-white/10 pb-2">Official JPL News & Editorials</h2>
        <div className="grid md:grid-cols-2 gap-6">
            {[
                { title: 'Exclusive Interview: J. Kothari on Team Balance', excerpt: "The star all-rounder discusses the team's strategy and the challenges of a packed season.", color: 'bg-pink-700' },
                { title: 'Match Report: Mumbai Mavericks Secure Top Spot', excerpt: 'A deep dive into how MM defended a low total against Ahmedabad Aces to solidify their lead.', color: 'bg-blue-700' },
                { title: 'FLAMES AI Feature: Predicting the Playoff Picture', excerpt: 'Our analytics engine breaks down the probability of each team making it to the final four.', color: 'bg-orange-700' },
                { title: 'Gallery: Top Catches of the Week', excerpt: 'Relive the stunning fielding moments from the last seven days of JPL action.', color: 'bg-red-700' },
            ].map((article, index) => (
                <div key={index} className={`rounded-xl shadow-xl overflow-hidden ${article.color} border border-white/10`}>
                    <div className="p-4">
                        <h3 className="text-xl font-bold text-white mb-2">{article.title}</h3>
                        <p className="text-sm text-gray-200 mb-4">{article.excerpt}</p>
                        <a href="#" className="text-sm font-semibold text-yellow-300 hover:text-white transition">Read Full Article →</a>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// --- ADMIN PANEL ---
const AdminControlPanel = ({ matchId, onPush, disabledReason }) => {
    const [form, setForm] = useState({ score: 0, wickets: 0, overs: 0, target: 0, innings: 1, lastBall: 0, lastCommentary: '' });

    const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

    return (
        <div className="fixed bottom-4 right-4 z-20 w-[92vw] sm:w-[520px] bg-gray-900/95 border border-yellow-400/50 rounded-xl shadow-2xl backdrop-blur">
            <div className="p-3 bg-gradient-to-r from-yellow-400 to-rose-400 rounded-t-xl text-gray-900 font-extrabold">Admin: Live Match Control</div>
            <div className="p-4 space-y-3">
                {disabledReason && (
                    <div className="text-sm text-red-300 bg-red-900/40 border border-red-700 p-2 rounded">{disabledReason}</div>
                )}
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <label className="flex flex-col text-gray-300">Score<input type="number" className="mt-1 px-2 py-1 rounded bg-gray-800 border border-white/10" value={form.score} onChange={e=>setField('score', Number(e.target.value))} /></label>
                    <label className="flex flex-col text-gray-300">Wickets<input type="number" className="mt-1 px-2 py-1 rounded bg-gray-800 border border-white/10" value={form.wickets} onChange={e=>setField('wickets', Number(e.target.value))} /></label>
                    <label className="flex flex-col text-gray-300">Overs<input type="number" step="0.1" className="mt-1 px-2 py-1 rounded bg-gray-800 border border-white/10" value={form.overs} onChange={e=>setField('overs', Number(e.target.value))} /></label>
                    <label className="flex flex-col text-gray-300">Target<input type="number" className="mt-1 px-2 py-1 rounded bg-gray-800 border border-white/10" value={form.target} onChange={e=>setField('target', Number(e.target.value))} /></label>
                    <label className="flex flex-col text-gray-300">Innings<select className="mt-1 px-2 py-1 rounded bg-gray-800 border border-white/10" value={form.innings} onChange={e=>setField('innings', Number(e.target.value))}><option value={1}>1</option><option value={2}>2</option></select></label>
                    <label className="flex flex-col text-gray-300">Last Ball<select className="mt-1 px-2 py-1 rounded bg-gray-800 border border-white/10" value={form.lastBall} onChange={e=>setField('lastBall', Number(e.target.value))}><option value={0}>0</option><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option><option value={6}>6</option><option value={-1}>Wicket</option></select></label>
                </div>
                <label className="flex flex-col text-sm text-gray-300">Commentary<textarea rows={2} className="mt-1 px-2 py-1 rounded bg-gray-800 border border-white/10" value={form.lastCommentary} onChange={e=>setField('lastCommentary', e.target.value)} /></label>
                <button
                    onClick={() => onPush(form)}
                    disabled={!!disabledReason}
                    className="w-full py-2 rounded-lg font-bold bg-yellow-400 hover:bg-yellow-300 text-gray-900 disabled:opacity-60 disabled:cursor-not-allowed shadow"
                >
                    Push Update to Viewers
                </button>
                <div className="text-[10px] text-gray-500 text-center">artifacts/{appId}/public/data/liveMatchFeed/{matchId}</div>
            </div>
        </div>
    );
};

// --- MAIN APP COMPONENT ---
const AppContent = () => {
    const [currentView, setView] = useState('LIVE');
    const [score, setScore] = useState(INITIAL_SCORE);
    const [selectedTeamId, setSelectedTeamId] = useState(null);
    const [selectedPlayerId, setSelectedPlayerId] = useState(null);
    const [adminMode, setAdminMode] = useState(false);
    const { userId, isAuthReady } = useFirebase();

    const { feed, pushUpdate } = useLiveMatchFeed(MATCH_DATA.id);

    const handleViewChange = (view) => {
        if (view !== 'TEAMS') {
            setSelectedTeamId(null);
            setSelectedPlayerId(null);
        }
        setView(view);
    };

    useEffect(() => {
        let timer;
        const runs = [0, 1, 2, 3, 4, 6];

        const simulateBall = () => {
            setScore(prev => {
                let newScore = { ...prev };
                const isSecondInnings = newScore.currentInnings === 2;
                const target = newScore.target;

                const outcome = Math.random() < 0.1 ? -1 : runs[Math.floor(Math.random() * runs.length)];

                if (isSecondInnings) {
                    if (outcome === -1) newScore.wicketsB++;
                    else newScore.scoreB += outcome;
                    newScore.lastBall = outcome;
                } else {
                    if (outcome === -1) newScore.wicketsA++;
                    else newScore.scoreA += outcome;
                    newScore.lastBall = outcome;
                }

                let currentOvers = isSecondInnings ? newScore.oversB : newScore.oversA;
                const ballCount = Math.round((currentOvers * 10) % 10);
                let newBallCount = ballCount + 1;
                let newOvers;

                if (newBallCount === 6) {
                    newOvers = Math.floor(currentOvers) + 1;
                    newBallCount = 0;
                } else {
                    newOvers = Math.floor(currentOvers) + newBallCount / 10;
                }

                if (isSecondInnings) newScore.oversB = newOvers;
                else newScore.oversA = newOvers;

                const maxOvers = 20;

                if (newScore.currentInnings === 1 && (newScore.wicketsA === 10 || newScore.oversA >= maxOvers)) {
                    newScore.currentInnings = 2;
                    newScore.target = newScore.scoreA + 1;
                    newScore.requiredRunRate = newScore.target / maxOvers;
                } else if (newScore.currentInnings === 2) {
                    const runsNeeded = target - newScore.scoreB;
                    const ballsRemaining = maxOvers * 6 - (Math.floor(newScore.oversB) * 6 + newBallCount);

                    if (newScore.scoreB >= target || newScore.wicketsB === 10 || newScore.oversB >= maxOvers) {
                        newScore.status = 'Completed';
                        clearInterval(timer);
                    } else {
                        newScore.requiredRunRate = (runsNeeded / ballsRemaining) * 6;
                    }
                }

                return newScore;
            });
        };

        if (score.status !== 'Completed') {
            timer = setInterval(simulateBall, 1000);
        }

        return () => clearInterval(timer);
    }, [score.status]);

    const disabledReason = !firebaseConfig
        ? 'Firebase is not configured. Set window.__firebase_config to enable admin updates.'
        : !isAuthReady
            ? 'Authenticating...'
            : null;

    const renderView = () => {
        switch (currentView) {
            case 'LIVE':
                return <LiveMatchView score={score} match={MATCH_DATA} liveFeed={feed} />;
            case 'TEAMS':
                if (selectedPlayerId) {
                    return <PlayerProfileView playerId={selectedPlayerId} setSelectedPlayerId={setSelectedPlayerId} />;
                }
                if (selectedTeamId) {
                    return <TeamProfileView teamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} setSelectedPlayerId={setSelectedPlayerId} />;
                }
                return <TeamsListView setSelectedTeamId={setSelectedTeamId} />;
            case 'SCHEDULE':
                return <ScheduleView />;
            case 'STATS':
                return <StatsView />;
            case 'NEWS':
                return <NewsView />;
            default:
                return <LiveMatchView score={score} match={MATCH_DATA} liveFeed={feed} />;
        }
    };

    return (
        <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-900 to-black text-white">
            <Header currentView={currentView} setView={handleViewChange} isAuthReady={isAuthReady} userId={userId} adminMode={adminMode} setAdminMode={setAdminMode} />
            <main className="relative max-w-7xl mx-auto py-24 px-4 sm:px-6 lg:px-8">
                <div className="absolute -z-10 inset-0 opacity-30 pointer-events-none">
                    <div className="absolute -top-20 -left-20 w-72 h-72 bg-pink-500/20 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute top-1/3 -right-10 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-yellow-400/10 rounded-full blur-3xl"></div>
                </div>
                {renderView()}
            </main>
            {adminMode && (
                <AdminControlPanel
                    matchId={MATCH_DATA.id}
                    onPush={async (payload) => {
                        try {
                            await pushUpdate(payload);
                        } catch (e) {
                            console.error(e);
                            alert('Failed to push update. See console for details.');
                        }
                    }}
                    disabledReason={disabledReason}
                />
            )}
        </div>
    );
};

// Wrapper for Firebase Context
const App = () => (
    <FirebaseProvider>
        <AppContent />
    </FirebaseProvider>
);

export default App;
