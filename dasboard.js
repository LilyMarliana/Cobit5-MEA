import React, { useState, useEffect, useCallback, createContext, useContext, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    addDoc, 
    collection, 
    query, 
    onSnapshot, 
    serverTimestamp,
    setLogLevel
} from 'firebase/firestore';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    Tooltip, 
    Legend, 
    ResponsiveContainer, 
    RadarChart, 
    PolarGrid, 
    PolarAngleAxis, 
    PolarRadiusAxis, 
    Radar 
} from 'recharts';
import { 
    LayoutDashboard, 
    FileText, 
    BarChart2, 
    Info, 
    ChevronDown, 
    Check, 
    Loader2, 
    ArrowRight, 
    Activity, 
    Target, 
    ClipboardCheck,
    User,
    LogOut,
    PlayCircle
} from 'lucide-react';

// --- KONFIGURASI FIREBASE ---
// Variabel global __app_id dan __firebase_config akan disediakan oleh environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-cobit-app';
const firebaseConfig = JSON.parse(
    typeof __firebase_config !== 'undefined' 
    ? __firebase_config 
    : '{}'
);

let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    setLogLevel('Debug');
} catch (e) {
    console.error("Error initializing Firebase:", e);
}

// --- KONSTANTA & DATA ASSESSMENT ---
const MEA_DOMAINS = {
    "MEA01": "Monitor, Evaluate and Assess Performance and Conformance",
    "MEA02": "Monitor, Evaluate and Assess the System of Internal Control",
    "MEA03": "Monitor, Evaluate and Assess Conformance with External Requirements"
};

const MATURITY_LEVELS = [
    { level: 0, title: "Incomplete", description: "Proses tidak diimplementasikan atau gagal mencapai tujuannya." },
    { level: 1, title: "Performed", description: "Proses diimplementasikan dan mencapai tujuannya." },
    { level: 2, title: "Managed", description: "Proses diimplementasikan, dikelola (direncanakan, dipantau, disesuaikan) dan hasilnya ditetapkan, dikendalikan, dan dipelihara." },
    { level: 3, title: "Established", description: "Proses terkelola diimplementasikan menggunakan proses standar yang disesuaikan dan didefinisikan." },
    { level: 4, title: "Predictable", description: "Proses yang ditetapkan beroperasi dalam batas yang ditentukan untuk mencapai hasil yang diharapkan." },
    { level: 5, title: "Optimizing", description: "Proses yang dapat diprediksi terus ditingkatkan untuk memenuhi tujuan bisnis saat ini dan yang akan datang." }
];

// Pertanyaan disederhanakan untuk demo, berdasarkan Capability Model COBIT 5
// -- EDIT: Mengganti pertanyaan demo dengan daftar proses MEA dari gambar --
const ASSESSMENT_QUESTIONS = [
    // MEA01: Monitor, Evaluate and Assess Performance and Conformance
    { 
        domain: "MEA01", 
        id: "MEA01.01", 
        text: "Apakah pendekatan pemantauan telah ditetapkan?",
        attribute: "MEA01.01 Establish a monitoring approach."
    },
    { 
        domain: "MEA01", 
        id: "MEA01.02", 
        text: "Apakah target kinerja dan kesesuaian (conformance) telah ditetapkan?",
        attribute: "MEA01.02 Set performance and conformance targets."
    },
    { 
        domain: "MEA01", 
        id: "MEA01.03", 
        text: "Apakah data kinerja dan kesesuaian dikumpulkan dan diproses?",
        attribute: "MEA01.03 Collect and process performance and conformance data."
    },
    { 
        domain: "MEA01", 
        id: "MEA01.04", 
        text: "Apakah kinerja dianalisis dan dilaporkan?",
        attribute: "MEA01.04 Analyse and report performance."
    },
    { 
        domain: "MEA01", 
        id: "MEA01.05", 
        text: "Apakah implementasi tindakan korektif telah dipastikan?",
        attribute: "MEA01.05 Ensure the implementation of corrective actions."
    },

    // MEA02: Monitor, Evaluate and Assess the System of Internal Control
    { 
        domain: "MEA02", 
        id: "MEA02.01", 
        text: "Apakah kontrol internal dipantau?",
        attribute: "MEA02.01 Monitor internal controls."
    },
    { 
        domain: "MEA02", 
        id: "MEA02.02", 
        text: "Apakah efektivitas kontrol proses bisnis ditinjau ulang?",
        attribute: "MEA02.02 Review business process controls effectiveness."
    },
    { 
        domain: "MEA02", 
        id: "MEA02.03", 
        text: "Apakah self-assessment kontrol dilakukan?",
        attribute: "MEA02.03 Perform control self-assessments."
    },
    { 
        domain: "MEA02", 
        id: "MEA02.04", 
        text: "Apakah kekurangan kontrol diidentifikasi dan dilaporkan?",
        attribute: "MEA02.04 Identify and report control deficiencies."
    },
    { 
        domain: "MEA02", 
        id: "MEA02.05", 
        text: "Apakah dipastikan penyedia jaminan (assurance) independen dan berkualitas?",
        attribute: "MEA02.05 Ensure that assurance providers are independent and qualified."
    },
    { 
        domain: "MEA02", 
        id: "MEA02.06", 
        text: "Apakah inisiatif jaminan (assurance) direncanakan?",
        attribute: "MEA02.06 Plan assurance initiatives."
    },
    { 
        domain: "MEA02", 
        id: "MEA02.07", 
        text: "Apakah ruang lingkup inisiatif jaminan (assurance) ditetapkan?",
        attribute: "MEA02.07 Scope assurance initiatives."
    },
    { 
        domain: "MEA02", 
        id: "MEA02.08", 
        text: "Apakah inisiatif jaminan (assurance) dilaksanakan?",
        attribute: "MEA02.08 Execute assurance initiatives."
    },

    // MEA03: Monitor, Evaluate and Assess Conformance with External Requirements
    { 
        domain: "MEA03", 
        id: "MEA03.01", 
        text: "Apakah persyaratan kepatuhan eksternal diidentifikasi?",
        attribute: "MEA03.01 Identify external compliance requirements."
    },
    { 
        domain: "MEA03", 
        id: "MEA03.02", 
        text: "Apakah respons terhadap persyaratan eksternal dioptimalkan?",
        attribute: "MEA03.02 Optimise response to external requirements."
    },
    { 
        domain: "MEA03", 
        id: "MEA03.03", 
        text: "Apakah kepatuhan eksternal dikonfirmasi?",
        attribute: "MEA03.03 Confirm external compliance."
    },
    { 
        domain: "MEA03", 
        id: "MEA03.04", 
        text: "Apakah jaminan (assurance) kepatuhan eksternal diperoleh?",
        attribute: "MEA03.04 Obtain assurance of external compliance."
    },
];

// --- HOOKS & CONTEXT ---
const AuthContext = createContext();

const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    useEffect(() => {
        if (!auth) return;

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                setIsAuthReady(true);
            } else {
                try {
                    const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                    if (token) {
                        await signInWithCustomToken(auth, token);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    console.error("Error signing in:", error);
                    setIsAuthReady(true); // Tetap lanjut meski error, userId akan null
                }
            }
        });

        return () => unsubscribe();
    }, []);

    const value = { userId, isAuthReady };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const AppDataContext = createContext();

const useAppData = () => useContext(AppDataContext);

const AppDataProvider = ({ children }) => {
    const { userId, isAuthReady } = useAuth();
    const [assessments, setAssessments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isAuthReady || !userId || !db) {
            if (isAuthReady) setLoading(false);
            return;
        }

        const assessmentsCol = collection(db, 'artifacts', appId, 'users', userId, 'assessments');
        const q = query(assessmentsCol);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            // Sort in JS, descending by date
            data.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                return dateB - dateA;
            });
            setAssessments(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching assessments:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isAuthReady, userId]);

    const addAssessment = async (assessmentData) => {
        if (!userId || !db) {
            console.error("User not authenticated or DB not initialized");
            return null;
        }
        try {
            const assessmentsCol = collection(db, 'artifacts', appId, 'users', userId, 'assessments');
            const docRef = await addDoc(assessmentsCol, {
                ...assessmentData,
                createdAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error("Error adding assessment:", error);
            return null;
        }
    };

    const value = { assessments, loading, addAssessment };

    return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

// --- KOMPONEN UTAMA (HALAMAN) ---
function App() {
    const [currentPage, setCurrentPage] = useState('dashboard');
    const { isAuthReady } = useAuth();

    if (!isAuthReady) {
        return <LoadingScreen />;
    }

    return (
        <AppDataProvider>
            <div className="flex h-screen bg-slate-100 font-sans">
                <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
                <main className="flex-1 overflow-y-auto">
                    <Header />
                    <div className="p-6 md:p-10">
                        <PageContent currentPage={currentPage} setCurrentPage={setCurrentPage} />
                    </div>
                </main>
            </div>
        </AppDataProvider>
    );
}

const PageContent = ({ currentPage, setCurrentPage }) => {
    const { assessments, loading, addAssessment } = useAppData();
    const [selectedAssessmentId, setSelectedAssessmentId] = useState(null);

    const handleViewReport = (id) => {
        setSelectedAssessmentId(id);
        setCurrentPage('report');
    };

    const handleAssessmentComplete = (newAssessmentId) => {
        setSelectedAssessmentId(newAssessmentId);
        setCurrentPage('report');
    };

    switch (currentPage) {
        case 'dashboard':
            return <DashboardPage setCurrentPage={setCurrentPage} onStartAssessment={() => setCurrentPage('assessment')} onViewReport={handleViewReport} />;
        case 'assessment':
            return <AssessmentPage onAssessmentComplete={handleAssessmentComplete} addAssessment={addAssessment} />;
        case 'report':
            return <ReportPage assessments={assessments} loading={loading} selectedId={selectedAssessmentId} onSelectAssessment={setSelectedAssessmentId} />;
        case 'info':
            return <InfoPage />;
        default:
            return <DashboardPage setCurrentPage={setCurrentPage} />;
    }
};

const LoadingScreen = () => (
    <div className="flex h-screen w-full items-center justify-center bg-slate-900 text-white">
        <Loader2 className="mr-2 h-8 w-8 animate-spin" />
        <span className="text-xl font-medium">Memuat Aplikasi...</span>
    </div>
);

// --- KOMPONEN UI (HEADER, SIDEBAR) ---
const Sidebar = ({ currentPage, setCurrentPage }) => {
    const navItems = [
        { name: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { name: 'assessment', label: 'Mulai Assessment', icon: PlayCircle },
        { name: 'report', label: 'Laporan', icon: BarChart2 },
        { name: 'info', label: 'Info COBIT 5', icon: Info },
    ];

    return (
        <nav className="flex w-64 flex-col bg-slate-900 text-white">
            <div className="flex h-16 items-center justify-center px-6 shadow-md">
                <Activity className="h-6 w-6 text-blue-400" />
                <span className="ml-3 text-xl font-semibold">COBIT 5 MEA</span>
            </div>
            <div className="flex-1 overflow-y-auto">
                <ul className="space-y-2 p-4">
                    {navItems.map((item) => (
                        <li key={item.name}>
                            <Button
                                variant={currentPage === item.name ? 'secondary' : 'ghost'}
                                className="w-full justify-start text-base"
                                onClick={() => setCurrentPage(item.name)}
                            >
                                <item.icon className="mr-3 h-5 w-5" />
                                {item.label}
                            </Button>
                        </li>
                    ))}
                </ul>
            </div>
            <div className="p-4 border-t border-slate-700">
                <Button variant="ghost" className="w-full justify-start text-base text-slate-400 hover:text-white">
                    <LogOut className="mr-3 h-5 w-5" />
                    Logout
                </Button>
            </div>
        </nav>
    );
};

const Header = () => {
    const { userId } = useAuth();
    return (
        <header className="flex h-16 items-center justify-end border-b bg-white px-6">
            <div className="flex items-center">
                <span className="mr-3 text-sm text-slate-600">Konsultan TI</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-white">
                    <User className="h-5 w-5" />
                </div>
            </div>
        </header>
    );
};

// --- KOMPONEN HALAMAN ---
const DashboardPage = ({ setCurrentPage, onStartAssessment, onViewReport }) => {
    const { assessments, loading } = useAppData();

    const latestAssessment = assessments?.[0];

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-slate-800">Dashboard Konsultan</h1>
            
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="md:col-span-2 lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Mulai Assessment Baru</CardTitle>
                        <CardDescription>Evaluasi maturity level proses TI klien Anda menggunakan COBIT 5 domain MEA.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="mb-4 text-sm text-slate-600">Klik untuk memulai pengisian kuesioner interaktif.</p>
                        <Button className="w-full" onClick={onStartAssessment}>
                            Mulai Assessment <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Assessment Terakhir</CardTitle>
                        {loading && <CardDescription>Memuat data...</CardDescription>}
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex justify-center items-center h-24">
                                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                            </div>
                        ) : latestAssessment ? (
                            <div className="space-y-3">
                                <h3 className="text-lg font-semibold text-blue-700">{latestAssessment.name}</h3>
                                <p className="text-sm text-slate-500">
                                    Dilakukan pada: {new Date(latestAssessment.createdAt?.toDate()).toLocaleString('id-ID')}
                                </p>
                                <div className="flex items-baseline">
                                    <span className="text-4xl font-bold text-slate-800">{latestAssessment.totalScore.toFixed(1)}</span>
                                    <span className="ml-1 text-sm text-slate-500">/ 5.0</span>
                                </div>
                                <Button variant="outline" className="w-full" onClick={() => onViewReport(latestAssessment.id)}>
                                    Lihat Laporan Detail
                                </Button>
                            </div>
                        ) : (
                            <p className="text-center text-slate-500">Belum ada assessment yang dilakukan.</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <Activity className="mr-2 h-5 w-5 text-blue-600" />
                            MEA01
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <h4 className="font-semibold">{MEA_DOMAINS.MEA01}</h4>
                        <p className="mt-2 text-sm text-slate-600">Fokus pada pemantauan kinerja dan kesesuaian untuk memastikan TI memberikan nilai.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <Target className="mr-2 h-5 w-5 text-green-600" />
                            MEA02
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <h4 className="font-semibold">{MEA_DOMAINS.MEA02}</h4>
                        <p className="mt-2 text-sm text-slate-600">Memantau efektivitas sistem kontrol internal untuk manajemen risiko.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <ClipboardCheck className="mr-2 h-5 w-5 text-red-600" />
                            MEA03
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <h4 className="font-semibold">{MEA_DOMAINS.MEA03}</h4>
                        <p className="mt-2 text-sm text-slate-600">Memastikan kepatuhan terhadap hukum, regulasi, dan kebijakan eksternal.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

const AssessmentPage = ({ onAssessmentComplete, addAssessment }) => {
    const [assessmentName, setAssessmentName] = useState("");
    const [answers, setAnswers] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleAnswerChange = (questionId, value) => {
        setAnswers(prev => ({ ...prev, [questionId]: parseInt(value, 10) }));
    };

    const calculateScores = () => {
        let scores = {};
        let counts = {};
        let totalSum = 0;
        let totalCount = 0;

        ASSESSMENT_QUESTIONS.forEach(q => {
            const score = answers[q.id] || 0;
            if (!scores[q.domain]) {
                scores[q.domain] = 0;
                counts[q.domain] = 0;
            }
            scores[q.domain] += score;
            counts[q.domain]++;
            totalSum += score;
            totalCount++;
        });

        let domainScores = {};
        for (const domain in scores) {
            domainScores[domain] = (scores[domain] / counts[domain]) || 0;
        }

        const totalScore = (totalSum / totalCount) || 0;

        return { domainScores, totalScore };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!assessmentName.trim()) {
            setError("Nama klien atau proyek tidak boleh kosong.");
            return;
        }

        const answeredQuestions = Object.keys(answers).length;
        if (answeredQuestions < ASSESSMENT_QUESTIONS.length) {
            setError(`Harap jawab semua ${ASSESSMENT_QUESTIONS.length} pertanyaan.`);
            return;
        }

        setIsSubmitting(true);
        const { domainScores, totalScore } = calculateScores();
        
        const assessmentData = {
            name: assessmentName,
            answers,
            scores: domainScores,
            totalScore,
        };

        const newId = await addAssessment(assessmentData);

        if (newId) {
            onAssessmentComplete(newId);
        } else {
            setError("Gagal menyimpan assessment. Coba lagi.");
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-slate-800">Assessment Maturity Level (MEA)</h1>
            <p className="text-lg text-slate-600">
                Isi kuesioner berikut untuk menilai maturity level proses TI berdasarkan domain MEA COBIT 5.
                Beri nilai dari 0 (Incomplete) hingga 5 (Optimizing) untuk setiap pernyataan.
            </p>

            <form onSubmit={handleSubmit} className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Informasi Assessment</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Label htmlFor="assessmentName">Nama Klien / Proyek</Label>
                        <Input
                            id="assessmentName"
                            value={assessmentName}
                            onChange={(e) => setAssessmentName(e.target.value)}
                            placeholder="Contoh: PT. Jaya Abadi - Q4 2025"
                        />
                    </CardContent>
                </Card>

                {Object.keys(MEA_DOMAINS).map(domainKey => (
                    <Card key={domainKey}>
                        <CardHeader>
                            <CardTitle>{domainKey}: {MEA_DOMAINS[domainKey]}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {ASSESSMENT_QUESTIONS.filter(q => q.domain === domainKey).map((q, index) => (
                                <div key={q.id} className="border-t pt-4">
                                    <Label htmlFor={q.id} className="text-base block mb-2">
                                        <span className="font-semibold">{q.id}:</span> {q.text}
                                    </Label>
                                    <p className="text-xs text-slate-500 mb-2">{q.attribute}</p>
                                    <Select onValueChange={(value) => handleAnswerChange(q.id, value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih maturity level..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {MATURITY_LEVELS.map(level => (
                                                <SelectItem key={level.level} value={level.level}>
                                                    Level {level.level}: {level.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                ))}
                
                {error && (
                    <div className="text-red-600 font-medium p-3 bg-red-100 rounded-md">
                        {error}
                    </div>
                )}

                <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Check className="mr-2 h-4 w-4" />
                    )}
                    Selesai & Hitung Hasil
                </Button>
            </form>
        </div>
    );
};

const ReportPage = ({ assessments, loading, selectedId, onSelectAssessment }) => {
    const selectedAssessment = useMemo(() => {
        if (selectedId) {
            return assessments.find(a => a.id === selectedId) || null;
        }
        return assessments[0] || null; // Tampilkan yang terbaru jika tidak ada yg dipilih
    }, [assessments, selectedId]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-3 text-lg text-slate-600">Memuat Laporan...</span>
            </div>
        );
    }

    if (assessments.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Laporan Assessment</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-center text-slate-500">Belum ada data assessment. Silakan lakukan assessment terlebih dahulu.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-slate-800">Laporan Hasil Assessment</h1>
            <div className="flex flex-col lg:flex-row gap-6">
                {/* --- Daftar Assessment --- */}
                <div className="lg:w-1/3">
                    <Card>
                        <CardHeader>
                            <CardTitle>Riwayat Assessment</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 max-h-[70vh] overflow-y-auto">
                            {assessments.map(a => (
                                <button
                                    key={a.id}
                                    onClick={() => onSelectAssessment(a.id)}
                                    className={`w-full text-left p-3 rounded-md border ${
                                        selectedAssessment?.id === a.id
                                            ? 'bg-blue-100 border-blue-300'
                                            : 'bg-white hover:bg-slate-50 border-slate-200'
                                    }`}
                                >
                                    <h4 className="font-semibold text-blue-800">{a.name}</h4>
                                    <p className="text-xs text-slate-500">
                                        {new Date(a.createdAt?.toDate()).toLocaleString('id-ID')}
                                    </p>
                                    <p className="text-sm font-bold text-slate-700 mt-1">
                                        Skor Total: {a.totalScore.toFixed(1)}
                                    </p>
                                </button>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* --- Detail Laporan --- */}
                <div className="lg:w-2/3 space-y-6">
                    {selectedAssessment ? (
                        <ReportDetail assessment={selectedAssessment} />
                    ) : (
                        <Card>
                            <CardContent className="p-10 text-center">
                                <p className="text-slate-500">Pilih salah satu assessment dari daftar untuk melihat detail.</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

const ReportDetail = ({ assessment }) => {
    const { name, totalScore, scores, createdAt } = assessment;

    const maturity = MATURITY_LEVELS.find(m => m.level === Math.floor(totalScore)) || MATURITY_LEVELS[0];

    const chartData = Object.keys(scores).map(domainKey => ({
        domain: domainKey,
        Skor: scores[domainKey],
        fullMark: 5,
    }));

    const getRecommendations = (score, domain) => {
        if (score < 2) return `[${domain}] Mendesak: Fokus pada implementasi dasar dan pencatatan proses. Definisikan metrik kinerja awal.`;
        if (score < 3) return `[${domain}] Prioritas: Standarisasi proses yang ada. Pastikan proses dikelola, dipantau, dan hasilnya dikendalikan.`;
        if (score < 4) return `[${domain}] Perbaikan: Terapkan proses yang telah terdefinisi dengan baik dan terukur. Gunakan data untuk mengelola proses.`;
        if (score < 5) return `[${domain}] Optimisasi: Fokus pada prediksi kinerja proses dan lakukan perbaikan berkelanjutan (CI) secara proaktif.`;
        return `[${domain}] Unggul: Pertahankan kinerja dan terus lakukan inovasi pada proses.`;
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl text-blue-800">{name}</CardTitle>
                    <CardDescription>
                        Laporan Dibuat: {new Date(createdAt?.toDate()).toLocaleString('id-ID')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-lg text-slate-600">Total Maturity Level</p>
                    <p className="text-7xl font-bold text-slate-800 my-2">{totalScore.toFixed(1)}</p>
                    <p className="text-2xl font-semibold text-blue-700">Level {maturity.level}: {maturity.title}</p>
                    <p className="mt-2 text-slate-600 max-w-md mx-auto">{maturity.description}</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Visualisasi Skor per Domain</CardTitle>
                </CardHeader>
                <CardContent className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="domain" />
                            <PolarRadiusAxis angle={30} domain={[0, 5]} />
                            <Radar name={name} dataKey="Skor" stroke="#3b82f6" fill="#60a5fa" fillOpacity={0.6} />
                            <Tooltip />
                            <Legend />
                        </RadarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Rekomendasi Otomatis</CardTitle>
                    <CardDescription>Rekomendasi perbaikan berdasarkan skor maturity level.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="list-disc space-y-3 pl-5">
                        {Object.keys(scores).map(domainKey => (
                            <li key={domainKey} className="text-sm">
                                <span className="font-semibold">{getRecommendations(scores[domainKey], domainKey)}</span>
                                <span className="text-slate-500"> (Skor: {scores[domainKey].toFixed(1)})</span>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        </>
    );
};

const InfoPage = () => {
    const [activeTab, setActiveTab] = useState('principles');

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold text-slate-800">Knowledge Base: COBIT 5</h1>
            
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="principles">5 Prinsip COBIT 5</TabsTrigger>
                    <TabsTrigger value="enablers">7 Enabler COBIT 5</TabsTrigger>
                    <TabsTrigger value="mea">Fokus: Domain MEA</TabsTrigger>
                </TabsList>
                <TabsContent value="principles">
                    <Card>
                        <CardHeader>
                            <CardTitle>5 Prinsip Kunci COBIT 5</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <InfoItem title="1. Meeting Stakeholder Needs">
                                Menciptakan nilai bagi pemangku kepentingan dengan menyeimbangkan realisasi manfaat, optimalisasi risiko, dan penggunaan sumber daya.
                            </InfoItem>
                            <InfoItem title="2. Covering the Enterprise End-to-End">
                                Mengintegrasikan tata kelola TI ke dalam tata kelola perusahaan secara menyeluruh.
                            </InfoItem>
                            <InfoItem title="3. Applying a Single Integrated Framework">
                                Berfungsi sebagai kerangka kerja tunggal yang terintegrasi dengan standar dan framework lain.
                            </InfoItem>
                            <InfoItem title="4. Enabling a Holistic Approach">
                                Menggunakan serangkaian 'enabler' yang saling berhubungan untuk mendukung tata kelola dan manajemen TI.
                            </InfoItem>
                            <InfoItem title="5. Separating Governance from Management">
                                Membedakan secara jelas antara aktivitas tata kelola (Governance - EDM) dan manajemen (Management - PBRM).
                            </InfoItem>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="enablers">
                    <Card>
                        <CardHeader>
                            <CardTitle>7 Enabler COBIT 5</CardTitle>
                            <CardDescription>Faktor-faktor yang mempengaruhi keberhasilan tata kelola dan manajemen TI.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Principles, Policies, and Frameworks</li>
                                <li>Processes</li>
                                <li>Organisational Structures</li>
                                <li>Culture, Ethics, and Behaviour</li>
                                <li>Information</li>
                                <li>Services, Infrastructure, and Applications</li>
                                <li>People, Skills, and Competencies</li>
                            </ul>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="mea">
                    <Card>
                        <CardHeader>
                            <CardTitle>Fokus Domain: Monitor, Evaluate and Assess (MEA)</CardTitle>
                            <CardDescription>Domain ini berfokus pada pemantauan semua proses untuk memastikan kinerja dan kesesuaian dengan tujuan.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <InfoItem title="MEA01: Monitor, Evaluate and Assess Performance and Conformance">
                                Memantau kinerja TI terhadap target, mengidentifikasi penyimpangan, dan melaporkannya kepada pemangku kepentingan.
                            </InfoItem>
                            <InfoItem title="MEA02: Monitor, Evaluate and Assess the System of Internal Control">
                                Memantau efektivitas kontrol internal untuk memastikan tujuan bisnis tercapai dan risiko dikelola.
                            </InfoItem>
                            <InfoItem title="MEA03: Monitor, Evaluate and Assess Conformance with External Requirements">
                                Memastikan bahwa perusahaan mematuhi semua persyaratan hukum, regulasi, dan kontraktual yang relevan.
                            </InfoItem>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

const InfoItem = ({ title, children }) => (
    <div className="border-l-4 border-blue-600 pl-4">
        <h4 className="font-semibold text-lg text-slate-800">{title}</h4>
        <p className="text-slate-600">{children}</p>
    </div>
);


// --- KOMPONEN UI (SHADCN/UI) ---
// Versi minimalis dari komponen shadcn/ui untuk demo satu file
// Menggunakan class Tailwind

const Button = React.forwardRef(({ className, variant, size, ...props }, ref) => {
    const variants = {
        default: "bg-slate-900 text-white hover:bg-slate-700",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline: "border border-slate-300 hover:bg-slate-100",
        secondary: "bg-blue-600 text-white hover:bg-blue-700",
        ghost: "hover:bg-slate-700 hover:text-white",
        link: "text-blue-600 underline-offset-4 hover:underline",
    };
    const sizes = {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
    };
    const baseClasses = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
    return (
        <button
            className={`${baseClasses} ${variants[variant || 'default']} ${sizes[size || 'default']} ${className || ''}`}
            ref={ref}
            {...props}
        />
    );
});

const Input = React.forwardRef(({ className, type, ...props }, ref) => (
    <input
        type={type}
        className={`flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className || ''}`}
        ref={ref}
        {...props}
    />
));

const Label = React.forwardRef(({ className, ...props }, ref) => (
    <label
        className={`text-sm font-medium leading-none text-slate-700 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className || ''}`}
        ref={ref}
        {...props}
    />
));

const Card = React.forwardRef(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={`rounded-lg border bg-white text-slate-900 shadow-sm ${className || ''}`}
        {...props}
    />
));

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
    <div ref={ref} className={`flex flex-col space-y-1.5 p-6 ${className || ''}`} {...props} />
));

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
    <h3 ref={ref} className={`text-xl font-semibold leading-none tracking-tight ${className || ''}`} {...props} />
));

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
    <p ref={ref} className={`text-sm text-slate-500 ${className || ''}`} {...props} />
));

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
    <div ref={ref} className={`p-6 pt-0 ${className || ''}`} {...props} />
));

const TabsContext = createContext();

const Tabs = ({ value, onValueChange, children }) => {
    return (
        <TabsContext.Provider value={{ value, onValueChange }}>
            <div className="space-y-4">{children}</div>
        </TabsContext.Provider>
    );
};

const TabsList = ({ children }) => (
    <div className="inline-flex h-10 items-center justify-center rounded-md bg-slate-200 p-1 text-slate-600">
        {children}
    </div>
);

const TabsTrigger = ({ value, children }) => {
    const { value: activeValue, onValueChange } = useContext(TabsContext);
    const isActive = activeValue === value;
    return (
        <button
            onClick={() => onValueChange(value)}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-4 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                isActive ? 'bg-white text-slate-900 shadow-sm' : 'hover:bg-slate-100'
            }`}
        >
            {children}
        </button>
    );
};

const TabsContent = ({ value, children }) => {
    const { value: activeValue } = useContext(TabsContext);
    return activeValue === value ? <div>{children}</div> : null;
};

// Komponen Select minimalis
const SelectContext = createContext();

const Select = ({ children, onValueChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedValue, setSelectedValue] = useState(null);

    const handleSelect = (value, label) => {
        setSelectedValue(label);
        onValueChange(value);
        setIsOpen(false);
    };

    return (
        <SelectContext.Provider value={{ isOpen, setIsOpen, selectedValue, handleSelect }}>
            <div className="relative">{children}</div>
        </SelectContext.Provider>
    );
};

const SelectTrigger = ({ children }) => {
    const { isOpen, setIsOpen, selectedValue } = useContext(SelectContext);
    return (
        <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
            {selectedValue ? <span>{selectedValue}</span> : <span className="text-slate-500">{children}</span>}
            <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
    );
};

const SelectValue = ({ placeholder }) => {
    const { selectedValue } = useContext(SelectContext);
    return selectedValue || <span className="text-slate-500">{placeholder}</span>;
};

const SelectContent = ({ children }) => {
    const { isOpen } = useContext(SelectContext);
    if (!isOpen) return null;
    return (
        <div className="absolute z-50 w-full mt-1 rounded-md border bg-white p-1 shadow-lg">
            {children}
        </div>
    );
};

const SelectItem = ({ value, children }) => {
    const { handleSelect } = useContext(SelectContext);
    return (
        <button
            type="button"
            onClick={() => handleSelect(value, children)}
            className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
        >
            {children}
        </button>
    );
};

export default function MainApp() {
    return (
        <AuthProvider>
            <App />
        </AuthProvider>
    );
}