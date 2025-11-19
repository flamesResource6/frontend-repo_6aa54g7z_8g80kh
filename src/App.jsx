import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, serverTimestamp, updateDoc, getDoc } from 'firebase/firestore';

// --- CONFIGURATION AND DUMMY DATA ---

// Mandatory Global Variables for Canvas Environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

const ALL_TEAMS = [
  { id: 'JJ', name: 'Jaipur Jewels', color: 'bg-pink-700', text: 'text-pink-100', accent: 'border-pink-500', motto: 'The Gemstone of the West' },
  { id: 'MM', name: 'Mumbai Mavericks', color: 'bg-blue-700', text: 'text-blue-100', accent: 'border-blue-500', motto: 'The Champions of the Harbor' },
  { id: 'AA', name: 'Ahmedabad Aces', color: 'bg-orange-700', text: 'text-orange-100', accent: 'border-orange-500', motto: 'The Diamond City Strikers' },
  { id: 'DD', name: 'Delhi Dynamos', color: 'bg-red-700', text: 'text-red-100', accent: 'border-red-500', motto: 'The Empire\'s Might' },
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

const initialPlayerList = [
  // JJ Players (Team 1)
  { id: 'JJ01', name: 'A. Shah', role: 'BAT', team: 'JJ', credit: 9.5, form: 50, selected: 0, bio: 'Dynamic opening batsman.' },
  { id: 'JJ02', name: 'V. Mehta', role: 'BAT', team: 'JJ', credit: 8.0, form: 30, selected: 0, bio: 'Experienced middle-order anchor.' },
  { id: 'JJ03', name: 'J. Kothari', role: 'AR', team: 'JJ', credit: 10.0, form: 75, selected: 0, bio: 'Premier all-rounder, excellent death bowler.' },
  // MM Players (Team 2)
  { id: 'MM01', name: 'R. Oswal', role: 'BAT', team: 'MM', credit: 9.0, form: 60, selected: 0, bio: 'Captain, power hitter.' },
  { id: 'MM02', name: 'S. Patni', role: 'BWL', team: 'MM', credit: 7.5, form: 40, selected: 0, bio: 'Wily spin bowler.' },
  { id: 'MM03', name: 'M. Gandhi', role: 'AR', team: 'MM', credit: 10.5, form: 80, selected: 0, bio: 'Impact player, explosive finisher.' },
  // AA Players (Other Teams - for Smart Suggestions)
  { id: 'AA01', name: 'D. Jain', role: 'BAT', team: 'AA', credit: 8.5, form: 70, selected: 0, bio: 'Solid top-order bat.' },
  { id: 'BB01', name: 'K. Soni', role: 'BWL', team: 'BB', credit: 8.2, form: 65, selected: 0, bio: 'Fast bowler with swing.' },
  { id: 'DD01', name: 'P. Sanghvi', role: 'AR', team: 'DD', credit: 9.8, form: 78, selected: 0, bio: 'Dependable all-rounder.' },
  { id: 'KK01', name: 'H. Parekh', role: 'BAT', team: 'KK', credit: 7.0, form: 20, selected: 0, bio: 'Young talent, still developing.' },
];

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

// Utility function to convert seconds to M:S format
const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
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
            console.error("Firebase config not found. Running in demo mode.");
            setIsAuthReady(true); // Allow component to render in demo mode
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
                timestamp: serverTimestamp()
            }, { merge: true });

            const unsubscribe = onAuthStateChanged(authentication, (user) => {
                if (user) {
                    setUserId(user.uid);
                    setIsAuthReady(true);
                } else {
                    // If user is not yet logged in, sign in anonymously or with token
                    if (initialAuthToken) {
                        signInWithCustomToken(authentication, initialAuthToken)
                            .catch(e => {
                                console.error("Error signing in with custom token. Falling back to anonymous:", e);
                                signInAnonymously(authentication);
                            });
                    } else {
                        signInAnonymously(authentication);
                    }
                }
            });

            return () => unsubscribe();
        } catch (error) {
            console.error("Failed to initialize Firebase:", error);
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

// Hook for fetching and updating fantasy team (Private Data)
const useFantasyTeam = () => {
    const { db, userId, isAuthReady } = useFirebase();
    const [fantasyTeam, setFantasyTeam] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const fantasyTeamPath = useMemo(() => {
        if (!userId) return null;
        return `artifacts/${appId}/users/${userId}/fantasyTeams/myTeam`;
    }, [userId]);

    useEffect(() => {
        if (!db || !isAuthReady || !fantasyTeamPath) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);

        const docRef = doc(db, fantasyTeamPath);

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                // Ensure team is an array of player objects (necessary if playerList is an array)
                const storedTeam = docSnap.data().team;
                if (storedTeam && storedTeam.players) {
                    setFantasyTeam(storedTeam);
                } else {
                    setFantasyTeam(null);
                }
            } else {
                setFantasyTeam(null);
            }
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching fantasy team:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db, isAuthReady, fantasyTeamPath]);

    const saveTeam = useCallback(async (teamData) => {
        if (!db || !fantasyTeamPath) {
            console.error("Cannot save team: Database or user ID not ready.");
            return false;
        }
        try {
            const docRef = doc(db, fantasyTeamPath);
            await setDoc(docRef, { team: teamData, lastUpdated: serverTimestamp() }, { merge: true });
            return true;
        } catch (error) {
            console.error("Error saving fantasy team:", error);
            return false;
        }
    }, [db, fantasyTeamPath]);

    return { fantasyTeam, isLoading, saveTeam };
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
            console.error("Error fetching match votes:", error);
        });

        return () => unsubscribe();
    }, [db, isAuthReady, docPath, userId]);

    const castVote = useCallback(async (type, option) => {
        if (!db || !userId) {
            // Using a simple alert since custom modal UI is more complex
            console.warn('Authentication is required to vote.');
            return;
        }
        const fieldPath = type === 'poll' ? `poll.${option}` : `mvp.${option}`;
        const userPath = `userVotes.${userId}`;
        const docRef = doc(db, docPath);

        try {
            // Check if user has already voted to prevent double voting
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.userVotes && data.userVotes[userId] && data.userVotes[userId][type]) {
                    console.log(`User already voted for ${type}.`);
                    return; // Stop execution if user already voted
                }
            }
            
            await setDoc(docRef, {
                [fieldPath]: (fanPolls[type][option] || 0) + 1, // Increment vote count
                [userPath]: { ...userVote, [type]: option, votedAt: serverTimestamp() }, // Update user's vote
                lastUpdated: serverTimestamp()
            }, { merge: true });

            setUserVote(prev => ({ ...prev, [type]: option }));

        } catch (error) {
            console.error("Error casting vote:", error);
        }
    }, [db, docPath, userId, fanPolls, userVote]);

    return { fanPolls, userVote, castVote };
};


// --- PRESENTATION COMPONENTS ---

const Header = ({ currentView, setView, isAuthReady, userId }) => {
    const navItems = [
        { name: 'Live Match', view: 'LIVE' },
        { name: 'Fantasy Hub', view: 'FANTASY' },
        { name: 'Teams', view: 'TEAMS' }, // Added Teams view
        { name: 'Schedule', view: 'SCHEDULE' },
        { name: 'Stats', view: 'STATS' },
        { name: 'News', view: 'NEWS' },
    ];
    
    // Display full userId for multi-user purposes
    const displayUserId = userId || 'Authenticating...';

    return (
        <div className="bg-gray-800 shadow-xl fixed top-0 left-0 right-0 z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center py-3">
                    <h1 className="text-2xl font-black text-white tracking-wider">JPL <span className="text-yellow-400">9</span></h1>
                    <div className="flex flex-col items-end text-xs text-gray-400">
                        <span className="mb-1">{isAuthReady ? 'Authenticated' : 'Connecting...'}</span>
                        <span className="p-1 px-3 bg-gray-700 rounded-full text-xs break-all" title={userId}>
                            User ID: <span className="text-yellow-400 font-mono">{displayUserId}</span>
                        </span>
                    </div>
                </div>
                <nav className="flex space-x-4 overflow-x-auto pb-2 -mb-2">
                    {navItems.map((item) => (
                        <button
                            key={item.view}
                            onClick={() => setView(item.view)}
                            className={`px-3 py-2 text-sm font-medium transition duration-150 ease-in-out whitespace-nowrap
                                ${currentView === item.view
                                    ? 'text-yellow-400 border-b-2 border-yellow-400'
                                    : 'text-gray-300 hover:text-white hover:border-b-2 hover:border-gray-500'
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

    // Simulation of current players
    const currentBatsman = isSecondInnings ? 'M. Gandhi' : 'A. Shah';
    const currentBowler = isSecondInnings ? 'J. Kothari' : 'S. Patni';
    const lastBallText = score.lastBall === 4 ? 'FOUR!' : score.lastBall === 6 ? 'SIX!' : score.lastBall === 0 ? 'Dot' : score.lastBall > 0 ? `${score.lastBall} Run` : 'WICKET!';

    return (
        <div className={`p-4 rounded-xl shadow-lg ${battingTeam.color} ${battingTeam.text}`}>
            <div className="text-xs font-semibold opacity-80 mb-2">{match.status} | JPL Season 9, Match 12 | {match.venue}</div>
            <div className="flex items-center justify-between mb-4">
                <div className="text-2xl sm:text-3xl font-extrabold flex items-center space-x-2">
                    <span>{battingTeam.name}</span>
                    <span className="text-xl font-light">
                        {battingScore}-{battingWickets}
                    </span>
                </div>
                <div className="text-lg font-bold">
                    {battingOvers.toFixed(1)} <span className="text-sm font-light">Overs</span>
                </div>
            </div>

            {isTargetSet && (
                <div className="text-sm font-medium mb-3">
                    Target: {score.target} | Required Run Rate: <span className="font-bold">{score.requiredRunRate.toFixed(2)}</span>
                </div>
            )}

            <div className="flex justify-between text-sm font-medium mb-1 border-t border-gray-600 pt-2">
                <div className="flex flex-col">
                    <span className="text-gray-300 text-xs">Batting</span>
                    <span className="font-bold">{currentBatsman}</span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-gray-300 text-xs">Bowling ({bowlingTeam.id})</span>
                    <span className="font-bold">{currentBowler}</span>
                </div>
            </div>

            <div className="mt-4 p-2 rounded-lg bg-gray-900/50 text-center text-yellow-300 font-extrabold text-xl animate-pulse">
                Last Ball: {lastBallText}
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
            <h2 className="text-xl font-bold text-white border-b border-gray-700 pb-2">Interactive Fan Engagement (Real-Time)</h2>

            {/* Fan Poll */}
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
                <h3 className="text-lg font-semibold text-yellow-400 mb-3">Fan Poll: Who will win this match?</h3>
                <div className="space-y-2">
                    {pollOptions.map(option => (
                        <div key={option} className="relative">
                            <button
                                onClick={() => castVote('poll', option)}
                                disabled={!!userVote.poll}
                                className={`w-full py-2 px-4 rounded-lg text-left transition ${userVote.poll === option
                                    ? 'bg-yellow-600 font-bold text-white'
                                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                                }`}
                            >
                                {option}
                            </button>
                            {!!userVote.poll && (
                                <div className="absolute inset-0 bg-gray-900/80 rounded-lg flex items-center">
                                    <div
                                        style={{ width: `${getPercentage(fanPolls.poll[option] || 0, totalPollVotes)}%` }}
                                        className={`h-full ${option.includes('JJ') ? 'bg-pink-600' : 'bg-blue-600'} rounded-l-lg transition-all duration-500`}
                                    ></div>
                                    <span className="absolute left-2 text-white font-semibold">
                                        {option} ({getPercentage(fanPolls.poll[option] || 0, totalPollVotes)}%)
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                {!!userVote.poll && <p className="text-sm text-center mt-3 text-gray-400">Thank you for voting. Total votes: {totalPollVotes}</p>}
            </div>

            {/* Match MVP Voting */}
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
                <h3 className="text-lg font-semibold text-yellow-400 mb-3">Vote for Player of the Match (MVP)</h3>
                <div className="grid grid-cols-2 gap-3">
                    {mvpOptions.map(player => (
                        <div key={player} className="relative">
                            <button
                                onClick={() => castVote('mvp', player)}
                                disabled={!!userVote.mvp}
                                className={`w-full py-2 px-4 rounded-lg text-left transition ${userVote.mvp === player
                                    ? 'bg-green-600 font-bold text-white'
                                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                                }`}
                            >
                                {player}
                            </button>
                            {!!userVote.mvp && (
                                <div className="absolute inset-0 bg-gray-900/80 rounded-lg flex items-center">
                                    <div
                                        style={{ width: `${getPercentage(fanPolls.mvp[player] || 0, totalMvpVotes)}%` }}
                                        className="h-full bg-green-500 rounded-l-lg transition-all duration-500"
                                    ></div>
                                    <span className="absolute left-2 text-white font-semibold">
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

const PlayerProfileView = ({ playerId, setSelectedPlayerId, setSelectedTeamId }) => {
    const player = initialPlayerList.find(p => p.id === playerId);
    const team = ALL_TEAMS.find(t => t.id === player.team);

    if (!player) return <p className="text-red-400">Player not found.</p>;

    return (
        <div className="space-y-6">
            <button
                onClick={() => setSelectedPlayerId(null)}
                className="text-yellow-400 hover:text-white transition mb-4 text-sm flex items-center"
            >
                 &larr; Back to Team Profile
            </button>
            <h2 className={`text-3xl font-black pb-2 flex items-center border-b ${team.accent}`}>
                <span className={`${team.color} ${team.text} px-3 py-1 rounded-full mr-3 text-sm`}>{team.name}</span>
                {player.name}
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6 bg-gray-800 p-6 rounded-xl shadow-lg">
                <div className="space-y-4">
                    <p className="text-gray-400">**Player Role:** <span className="font-semibold text-white">{player.role}</span></p>
                    <p className="text-gray-400">**Current Form Index (FLAMES AI):** <span className="font-extrabold text-green-400 text-xl">{player.form}</span></p>
                    <p className="text-gray-300 italic">{player.bio}</p>
                </div>
                <div className="space-y-3">
                    <h3 className="text-xl font-bold text-yellow-400 border-b border-gray-700 pb-1">Career Stats (Placeholder)</h3>
                    <div className="text-sm text-gray-400">
                        <p>Matches: 55 | Runs: 1520 | Wickets: 12</p>
                        <p>Highest Score: 89* | Economy: 7.2</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TeamProfileView = ({ teamId, setSelectedTeamId, setSelectedPlayerId }) => {
    const team = ALL_TEAMS.find(t => t.id === teamId);
    const roster = initialPlayerList.filter(p => p.team === teamId);
    const pointsData = DUMMY_POINTS_TABLE.find(p => p.team === team.name);

    return (
        <div className="space-y-6">
            <button
                onClick={() => setSelectedTeamId(null)}
                className="text-yellow-400 hover:text-white transition mb-4 text-sm flex items-center"
            >
                 &larr; Back to Teams List
            </button>
            <h2 className={`text-3xl font-black pb-2 flex items-center border-b ${team.accent}`}>
                <span className={`${team.color} ${team.text} px-3 py-1 rounded-full mr-3 text-sm`}>{team.id}</span>
                {team.name}
            </h2>
            <p className="text-gray-400 italic text-lg">{team.motto}</p>

            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1 bg-gray-800 p-4 rounded-xl shadow-lg space-y-3">
                    <h3 className="text-xl font-bold text-yellow-400">Current Standing</h3>
                    <p className="text-gray-300">Played: {pointsData.P} | Wins: {pointsData.W} | NRR: {pointsData.NRR}</p>
                    <p className="text-4xl font-black text-white">{pointsData.Pts} Pts</p>
                </div>
                <div className="md:col-span-2 bg-gray-800 p-4 rounded-xl shadow-lg">
                    <h3 className="text-xl font-bold text-yellow-400 mb-3">Team Roster</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {roster.map(player => (
                            <button
                                key={player.id}
                                onClick={() => setSelectedPlayerId(player.id)}
                                className="bg-gray-700 p-3 rounded-lg text-left hover:bg-gray-600 transition"
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
        <h2 className="text-3xl font-bold text-white border-b border-yellow-400 pb-2">JPL Teams</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {ALL_TEAMS.map(team => (
                <button
                    key={team.id}
                    onClick={() => setSelectedTeamId(team.id)}
                    className={`p-6 rounded-xl shadow-xl transition transform hover:scale-[1.02] ${team.color} ${team.text} text-left`}
                >
                    <div className="text-3xl font-black">{team.id}</div>
                    <div className="text-xl font-bold mt-1">{team.name}</div>
                    <p className="text-sm italic opacity-70 mt-2">{team.motto}</p>
                    <span className="mt-3 inline-block text-xs font-semibold px-3 py-1 bg-white/20 rounded-full">View Profile &rarr;</span>
                </button>
            ))}
        </div>
    </div>
);


// --- OTHER VIEWS ---

const LiveMatchView = ({ score, match }) => (
    <div className="space-y-8">
        <LiveScoreboard score={score} match={match} />
        <p className="text-gray-400 text-sm">{match.toss}</p>
        <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
                <FanEngagement matchId={match.id} />
                <div className="bg-gray-800 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-2">Social Stream (#JPL9)</h3>
                    <p className="text-sm text-gray-500">Twitter/X feed placeholder for official JPL content and fan chatter.</p>
                    <div className="h-24 bg-gray-700/50 rounded mt-2 flex items-center justify-center text-gray-500 text-xs">Live feed content goes here...</div>
                </div>
            </div>
            <div className="space-y-4">
                <div className="bg-gray-800 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-2">Live Commentary</h3>
                    <div className="h-64 overflow-y-auto space-y-2 text-sm text-gray-300">
                        <p><span className="font-bold text-yellow-400">1.2</span> - <span className="text-green-400">FOUR!</span> A. Shah drives wide of mid-off.</p>
                        <p><span className="font-bold text-yellow-400">1.1</span> - Dot ball. Excellent line from S. Patni.</p>
                        <p><span className="font-bold text-yellow-400">0.6</span> - Single. V. Mehta rotates the strike.</p>
                        <p><span className="font-bold text-yellow-400">0.5</span> - <span className="text-red-400">WICKET!</span> V. Mehta run out. Oh dear, a mix-up!</p>
                        <p className="text-xs text-gray-500 text-center">--- Innings Break ---</p>
                    </div>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-2">Video Highlights (Placeholder)</h3>
                    <div className="h-40 bg-gray-700/50 rounded flex items-center justify-center text-gray-500 text-xs">Video Player: Match Highlights</div>
                </div>
            </div>
        </div>
    </div>
);

const FantasyHubView = ({ playerList, setPlayerList }) => {
    const { fantasyTeam, isLoading: isFantasyLoading, saveTeam } = useFantasyTeam();
    const { isAuthReady, userId } = useFirebase();
    const [teamName, setTeamName] = useState(fantasyTeam?.name || 'My JPL XI');
    const [maxCredits] = useState(100);
    const [alertMessage, setAlertMessage] = useState('');

    useEffect(() => {
        if (fantasyTeam) {
            setTeamName(fantasyTeam.name);
            setPlayerList(fantasyTeam.players);
        } else {
            // Reset to initial if no saved team
            setPlayerList(initialPlayerList.map(p => ({ ...p, selected: 0 })));
            setTeamName('My JPL XI');
        }
    }, [fantasyTeam, setPlayerList]);

    const togglePlayer = useCallback((id) => {
        setPlayerList(prevList => {
            const player = prevList.find(p => p.id === id);
            if (!player) return prevList;

            const isSelected = player.selected === 1;
            const currentSelectedCount = prevList.filter(p => p.selected === 1).length;

            if (isSelected) {
                return prevList.map(p => p.id === id ? { ...p, selected: 0 } : p);
            } else if (currentSelectedCount < 11) {
                return prevList.map(p => p.id === id ? { ...p, selected: 1 } : p);
            } else {
                setAlertMessage('Maximum of 11 players reached.');
                setTimeout(() => setAlertMessage(''), 3000);
                return prevList;
            }
        });
    }, [setPlayerList]);

    const toggleCaptain = (id, role) => {
        setPlayerList(prevList => {
            let newPlayers = prevList.map(p => ({ ...p }));
            const targetPlayer = newPlayers.find(p => p.id === id);

            if (!targetPlayer || targetPlayer.selected !== 1) return prevList;

            if (targetPlayer.role === role) {
                // Remove role if clicked again
                targetPlayer.role = initialPlayerList.find(p => p.id === id).role;
            } else {
                // Assign new role (CAP or VC)
                // Clear the existing CAP or VC
                newPlayers = newPlayers.map(p => {
                    if (p.role === role) {
                        return { ...p, role: initialPlayerList.find(i => i.id === p.id).role };
                    }
                    return p;
                });
                // Assign the new role
                newPlayers.find(p => p.id === id).role = role;
            }

            return newPlayers;
        });
    };
    
    const selectedPlayers = playerList.filter(p => p.selected === 1);
    const totalCreditsSpent = selectedPlayers.reduce((sum, p) => sum + p.credit, 0).toFixed(1);
    const remainingCredits = (maxCredits - totalCreditsSpent).toFixed(1);

    // FLAMES AI C/VC SUGGESTION LOGIC (based on Form score)
    const aiCvcSuggestion = useMemo(() => {
        const eligiblePlayers = selectedPlayers.filter(p => p.role !== 'CAP' && p.role !== 'VC');
        if (eligiblePlayers.length < 2) return { cap: 'N/A', vc: 'N/A' };

        const sortedByForm = [...eligiblePlayers].sort((a, b) => b.form - a.form);

        // Captain is the highest performer
        const cap = sortedByForm[0];
        // VC is the second highest performer
        const vc = sortedByForm[1];

        return {
            cap: cap ? cap.name : 'N/A',
            vc: vc ? vc.name : 'N/A'
        };
    }, [selectedPlayers]);

    const showAiSuggestion = () => {
        setAlertMessage(`FLAMES AI Suggests: Captain: ${aiCvcSuggestion.cap}, Vice-Captain: ${aiCvcSuggestion.vc}`);
        setTimeout(() => setAlertMessage(''), 5000);
    };


    const handleSaveTeam = async () => {
        if (!isAuthReady || !userId) {
            setAlertMessage('Authentication is not complete. Cannot save team.');
            return;
        }
        if (selectedPlayers.length !== 11) {
            setAlertMessage('Team must have exactly 11 players to save!');
            return;
        }
        const success = await saveTeam({ name: teamName, players: playerList });
        if (success) {
            setAlertMessage('Team saved successfully!');
        } else {
            setAlertMessage('Error saving team. Check console for details.');
        }
        setTimeout(() => setAlertMessage(''), 3000);
    };

    const smartFillTeam = () => {
        const sortedPlayers = [...playerList].sort((a, b) => b.form - a.form); // Sort by form (AI Heuristic)
        const newTeam = playerList.map(p => ({ ...p, selected: 0 }));
        let currentCredits = 0;
        let selectedCount = 0;

        for (const player of sortedPlayers) {
            if (selectedCount < 11 && currentCredits + player.credit <= maxCredits) {
                const index = newTeam.findIndex(p => p.id === player.id);
                if (index !== -1) {
                    newTeam[index].selected = 1;
                    currentCredits += player.credit;
                    selectedCount++;
                }
            }
        }
        setPlayerList(newTeam);
        setAlertMessage('Smart Fill applied based on current form and value!');
        setTimeout(() => setAlertMessage(''), 3000);
    };

    if (!isAuthReady) {
        return <div className="text-center py-10 text-xl text-yellow-400">Connecting to FLAMES AI Platform...</div>;
    }

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-white border-b border-yellow-400 pb-2">Fantasy Hub</h2>
            <div className="bg-gray-800 p-4 rounded-xl shadow-lg">
                <div className="flex justify-between items-center mb-4">
                    <input
                        type="text"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        className="text-2xl font-bold bg-transparent text-white border-b border-gray-600 focus:border-yellow-400 outline-none"
                    />
                    <button
                        onClick={handleSaveTeam}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
                    >
                        {isFantasyLoading ? 'Loading...' : 'Save Team'}
                    </button>
                </div>
                {alertMessage && (
                    <div className="p-2 mb-3 bg-yellow-500 text-gray-900 rounded-lg text-sm font-medium text-center">{alertMessage}</div>
                )}
                <div className="grid grid-cols-3 text-center text-sm font-medium">
                    <div className="p-2 rounded-l-lg bg-gray-700 text-gray-300">Players: <span className="text-white font-bold">{selectedPlayers.length}/11</span></div>
                    <div className="p-2 bg-gray-700 text-gray-300">Spent: <span className="text-white font-bold">{totalCreditsSpent}</span></div>
                    <div className={`p-2 rounded-r-lg font-bold ${remainingCredits < 0 ? 'bg-red-600' : 'bg-green-600'} text-white`}>
                        Remaining: {remainingCredits}
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={smartFillTeam} className="bg-yellow-600 hover:bg-yellow-700 text-gray-900 text-sm font-semibold py-2 px-4 rounded-full transition">
                        FLAMES AI: Smart Fill XI
                    </button>
                    <button 
                        onClick={showAiSuggestion}
                        disabled={selectedPlayers.length < 2}
                        className="bg-purple-600 disabled:bg-purple-800 hover:bg-purple-700 text-white text-sm font-semibold py-2 px-4 rounded-full transition"
                    >
                        FLAMES AI: C/VC Suggestion
                    </button>
                </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-xl shadow-lg">
                <h3 className="text-xl font-bold text-yellow-400 mb-4">Player Selection</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {playerList.map(player => (
                        <div key={player.id} className={`flex items-center p-3 rounded-lg transition duration-200 ${player.selected === 1 ? 'bg-gray-700 border border-yellow-400' : 'bg-gray-900/50'}`}>
                            <div className="flex-1">
                                <span className="font-semibold text-white">{player.name} ({player.team})</span>
                                <span className="text-xs ml-2 text-gray-400">| {player.role} | Credits: {player.credit}</span>
                                <span className="text-xs ml-2 text-green-400">| Form: {player.form}</span>
                            </div>
                            <button
                                onClick={() => togglePlayer(player.id)}
                                className={`text-sm py-1 px-3 rounded-full font-semibold transition ${player.selected === 1 ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white mr-2`}
                            >
                                {player.selected === 1 ? 'Remove' : 'Pick'}
                            </button>
                            {player.selected === 1 && (
                                <>
                                <button
                                    onClick={() => toggleCaptain(player.id, 'CAP')}
                                    className={`text-xs py-1 px-2 rounded-full font-bold transition ${player.role === 'CAP' ? 'bg-yellow-400 text-gray-900' : 'bg-gray-600 hover:bg-gray-500 text-white'}`}
                                >
                                    C
                                </button>
                                <button
                                    onClick={() => toggleCaptain(player.id, 'VC')}
                                    className={`text-xs py-1 px-2 rounded-full font-bold ml-1 transition ${player.role === 'VC' ? 'bg-yellow-400 text-gray-900' : 'bg-gray-600 hover:bg-gray-500 text-white'}`}
                                >
                                    VC
                                </button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="p-4 bg-gray-800 rounded-lg">
                <h3 className="text-xl font-bold text-white mb-2">Personalized Weekly Summary</h3>
                <p className="text-sm text-gray-400">FLAMES AI Report (Sample)</p>
                <ul className="text-sm mt-2 space-y-1 text-gray-300 list-disc pl-5">
                    <li><span className="text-green-400 font-semibold">Strengths:</span> Your team's middle order (M. Gandhi) is currently outperforming their salary projections by 15%.</li>
                    <li><span className="text-red-400 font-semibold">Weaknesses:</span> K. Soni (BB) has a strong track record against BAT heavy lineups; consider a replacement for this week's match against AA.</li>
                    <li><span className="text-yellow-400 font-semibold">Recommendation:</span> High-risk, high-reward transfer: Swap J. Kothari for P. Sanghvi based on venue-specific data.</li>
                </ul>
            </div>
        </div>
    );
};

const ScheduleView = () => (
    <div className="space-y-6">
        <h2 className="text-3xl font-bold text-white border-b border-yellow-400 pb-2">JPL Season 9 Schedule & Results</h2>
        <div className="bg-gray-800 p-4 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold text-yellow-400 mb-4">Upcoming Fixtures</h3>
            <div className="space-y-3">
                {[
                    { date: 'Nov 20', match: 'AA vs BB', venue: 'Indore', status: 'Upcoming', team: ALL_TEAMS[2].accent },
                    { date: 'Nov 21', match: 'DD vs KK', venue: 'Pune', status: 'Upcoming', team: ALL_TEAMS[3].accent },
                    { date: 'Nov 22', match: 'JJ vs DD', venue: 'Mumbai', status: 'Upcoming', team: ALL_TEAMS[0].accent },
                ].map((item, index) => (
                    <div key={index} className={`flex justify-between items-center p-3 rounded-lg bg-gray-900/50 border-l-4 ${item.team}`}>
                        <div className="text-gray-300">{item.date}</div>
                        <div className="text-white font-semibold">{item.match}</div>
                        <div className="text-gray-400 text-sm">{item.venue}</div>
                    </div>
                ))}
            </div>
        </div>
        <div className="bg-gray-800 p-4 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold text-yellow-400 mb-4">Completed Results</h3>
            <div className="space-y-3">
                {[
                    { result: 'MM beat AA by 5 wickets', venue: 'Delhi', team: ALL_TEAMS[1].accent },
                    { result: 'BB beat KK by 10 runs', venue: 'Bangalore', team: ALL_TEAMS[5].accent },
                ].map((item, index) => (
                    <div key={index} className={`flex justify-between items-center p-3 rounded-lg bg-gray-900/50 border-l-4 ${item.team}`}>
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
        <h2 className="text-3xl font-bold text-white border-b border-yellow-400 pb-2">Statistics Hub</h2>
        
        {/* Points Table */}
        <div className="bg-gray-800 p-4 rounded-xl shadow-lg overflow-x-auto">
            <h3 className="text-xl font-semibold text-yellow-400 mb-4">Points Table</h3>
            <table className="min-w-full text-left text-sm text-gray-300">
                <thead>
                    <tr className="bg-gray-700 text-white uppercase tracking-wider">
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
                        <tr key={team.team} className={`border-b border-gray-700 hover:bg-gray-700/50 ${team.accent.replace('border', 'text')}`}>
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

        {/* Leaderboards */}
        <div className="grid md:grid-cols-2 gap-6">
            <Leaderboard title="Orange Cap (Most Runs)" data={DUMMY_CAPS.orange} valueKey="runs" unit="Runs" capColor="bg-orange-500" />
            <Leaderboard title="Purple Cap (Most Wickets)" data={DUMMY_CAPS.purple} valueKey="wickets" unit="Wickets" capColor="bg-purple-500" />
        </div>
    </div>
);

const Leaderboard = ({ title, data, valueKey, unit, capColor }) => (
    <div className="bg-gray-800 p-4 rounded-xl shadow-lg">
        <h3 className={`text-xl font-bold text-white mb-4 flex items-center`}>
            <span className={`inline-block w-3 h-3 rounded-full mr-2 ${capColor}`}></span>
            {title}
        </h3>
        <ul className="space-y-3">
            {data.map((player, index) => (
                <li key={player.name} className="flex justify-between items-center p-3 bg-gray-900/50 rounded-lg">
                    <span className={`text-lg font-bold mr-2 ${player.teamColor.replace('bg-', 'text-')}`}>{index + 1}.</span>
                    <span className="flex-1 text-gray-200 font-medium">{player.name}</span>
                    <span className="text-yellow-400 font-bold">{player[valueKey]} {unit}</span>
                </li>
            ))}
        </ul>
    </div>
);

const NewsView = () => (
    <div className="space-y-6">
        <h2 className="text-3xl font-bold text-white border-b border-yellow-400 pb-2">Official JPL News & Editorials</h2>
        <div className="grid md:grid-cols-2 gap-6">
            {[
                { title: "Exclusive Interview: J. Kothari on Team Balance", excerpt: "The star all-rounder discusses the team's strategy and the challenges of a packed season.", color: 'bg-pink-700' },
                { title: "Match Report: Mumbai Mavericks Secure Top Spot", excerpt: "A deep dive into how MM defended a low total against Ahmedabad Aces to solidify their lead.", color: 'bg-blue-700' },
                { title: "FLAMES AI Feature: Predicting the Playoff Picture", excerpt: "Our analytics engine breaks down the probability of each team making it to the final four.", color: 'bg-orange-700' },
                { title: "Gallery: Top Catches of the Week", excerpt: "Relive the stunning fielding moments from the last seven days of JPL action.", color: 'bg-red-700' },
            ].map((article, index) => (
                <div key={index} className={`rounded-xl shadow-xl overflow-hidden ${article.color}`}>
                    <div className="p-4">
                        <h3 className="text-xl font-bold text-white mb-2">{article.title}</h3>
                        <p className="text-sm text-gray-200 mb-4">{article.excerpt}</p>
                        <a href="#" className="text-sm font-semibold text-yellow-300 hover:text-white transition">Read Full Article &rarr;</a>
                    </div>
                </div>
            ))}
        </div>
    </div>
);


// --- MAIN APP COMPONENT ---
const AppContent = () => {
    const [currentView, setView] = useState('LIVE');
    const [score, setScore] = useState(INITIAL_SCORE);
    const [playerList, setPlayerList] = useState(initialPlayerList);
    const [selectedTeamId, setSelectedTeamId] = useState(null);
    const [selectedPlayerId, setSelectedPlayerId] = useState(null);
    const { userId, isAuthReady } = useFirebase();

    // Utility function to navigate back to the Teams list from a deeper view
    const navigateToTeamsList = () => {
        setSelectedTeamId(null);
        setSelectedPlayerId(null);
        setView('TEAMS');
    };

    // Helper to ensure view changes reset the detail pages
    const handleViewChange = (view) => {
        if (view !== 'TEAMS') {
            setSelectedTeamId(null);
            setSelectedPlayerId(null);
        }
        setView(view);
    };

    // --- Live Match Simulation Effect (Frontend Demo) ---
    useEffect(() => {
        let timer;
        const runs = [0, 1, 2, 3, 4, 6];

        const simulateBall = () => {
            setScore(prev => {
                let newScore = { ...prev };
                const isSecondInnings = newScore.currentInnings === 2;
                const target = newScore.target;

                // 1. Simulate the ball outcome
                const outcome = Math.random() < 0.1 ? -1 : runs[Math.floor(Math.random() * runs.length)]; // 10% chance of Wicket (-1)

                // 2. Update runs and wickets for the current innings
                if (isSecondInnings) {
                    if (outcome === -1) newScore.wicketsB++;
                    else newScore.scoreB += outcome;
                    newScore.lastBall = outcome;
                } else {
                    if (outcome === -1) newScore.wicketsA++;
                    else newScore.scoreA += outcome;
                    newScore.lastBall = outcome;
                }

                // 3. Update Overs
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

                // 4. Check for Innings Change / Match End
                const maxOvers = 20;

                if (newScore.currentInnings === 1 && (newScore.wicketsA === 10 || newScore.oversA >= maxOvers)) {
                    newScore.currentInnings = 2;
                    newScore.target = newScore.scoreA + 1;
                    newScore.requiredRunRate = newScore.target / maxOvers;
                } else if (newScore.currentInnings === 2) {
                    const runsNeeded = target - newScore.scoreB;
                    const ballsRemaining = maxOvers * 6 - (Math.floor(newScore.oversB) * 6 + newBallCount);

                    if (newScore.scoreB >= target || newScore.wicketsB === 10 || newScore.oversB >= maxOvers) {
                        newScore.status = 'Completed'; // End match simulation
                        clearInterval(timer);
                    } else {
                        newScore.requiredRunRate = (runsNeeded / ballsRemaining) * 6;
                    }
                }

                return newScore;
            });
        };

        // Start the simulation loop
        if (score.status !== 'Completed') {
            timer = setInterval(simulateBall, 1000); // 1-second interval for "sub-second" updates
        }

        return () => clearInterval(timer);
    }, [score.status]);

    const renderView = () => {
        switch (currentView) {
            case 'LIVE':
                return <LiveMatchView score={score} match={MATCH_DATA} />;
            case 'FANTASY':
                return <FantasyHubView playerList={playerList} setPlayerList={setPlayerList} />;
            case 'TEAMS':
                if (selectedPlayerId) {
                    return <PlayerProfileView playerId={selectedPlayerId} setSelectedPlayerId={setSelectedPlayerId} setSelectedTeamId={setSelectedTeamId} />;
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
                return <LiveMatchView score={score} match={MATCH_DATA} />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 font-sans">
            <Header currentView={currentView} setView={handleViewChange} isAuthReady={isAuthReady} userId={userId} />
            <main className="max-w-7xl mx-auto py-24 px-4 sm:px-6 lg:px-8">
                {renderView()}
            </main>
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
