import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import * as lamejs from "@breezystack/lamejs";
import AdminPanel from "./AdminPanel.jsx";
import LandingPage from "./LandingPage.jsx";
import ClassroomPanel from "./ClassroomPanel.jsx";
import ProfilePage from "./ProfilePage.jsx";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5002";

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

function blankTracks() {
  return [
    { name: "Kick", steps: Array(16).fill(false), volume: 1, pan: 0, muted: false },
    { name: "Snare", steps: Array(16).fill(false), volume: 1, pan: 0, muted: false },
    { name: "Hi-Hat", steps: Array(16).fill(false), volume: 1, pan: 0, muted: false }
  ];
}

function makeNoiseBuffer(context, duration) {
  const length = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const samples = buffer.getChannelData(0);

  for (let i = 0; i < length; i += 1) {
    samples[i] = Math.random() * 2 - 1;
  }

  return buffer;
}

function connectPan(context, gain, pan = 0) {
  const panner = context.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));
  gain.connect(panner);
  panner.connect(context.destination);
}

function playTrackSound(context, trackName, time, trackIndex, volume = 1, pan = 0) {
  if (!context || volume <= 0) return;

  const name = (trackName || "").toLowerCase();
  const level = Math.min(1, Math.max(0.01, volume));

  if (name.includes("kick")) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(150, time);
    oscillator.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    gain.gain.setValueAtTime(0.9 * level, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    oscillator.connect(gain);
    connectPan(context, gain, pan);
    oscillator.start(time);
    oscillator.stop(time + 0.23);
    return;
  }

  if (name.includes("snare")) {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    source.buffer = makeNoiseBuffer(context, 0.2);
    filter.type = "highpass";
    filter.frequency.value = 1400;
    gain.gain.setValueAtTime(0.45 * level, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    source.connect(filter);
    filter.connect(gain);
    connectPan(context, gain, pan);
    source.start(time);
    source.stop(time + 0.19);
    return;
  }

  if (name.includes("hat")) {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const duration = name.includes("open") ? 0.16 : 0.055;

    source.buffer = makeNoiseBuffer(context, duration);
    filter.type = "highpass";
    filter.frequency.value = 7000;
    gain.gain.setValueAtTime(0.28 * level, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    source.connect(filter);
    filter.connect(gain);
    connectPan(context, gain, pan);
    source.start(time);
    source.stop(time + duration + 0.01);
    return;
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.value = 110 + trackIndex * 55;
  gain.gain.setValueAtTime(0.2 * level, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

  oscillator.connect(gain);
  connectPan(context, gain, pan);
  oscillator.start(time);
  oscillator.stop(time + 0.17);
}

function toInt16(samples) {
  const output = new Int16Array(samples.length);

  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    output[i] = sample < 0 ? sample * 32768 : sample * 32767;
  }

  return output;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [bpmDraft, setBpmDraft] = useState(120);
  const [presence, setPresence] = useState([]);
  const [connection, setConnection] = useState("Disconnected");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const [showAdmin, setShowAdmin] = useState(false);
  const [showClassroom, setShowClassroom] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [showProfile, setShowProfile] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [masterVolume, setMasterVolume] = useState(0.8);

  const socketRef = useRef(null);
  const projectRef = useRef(null);
  const stepRef = useRef(0);
  const audioContextRef = useRef(null);
  const masterVolumeRef = useRef(0.8);
  const googleButtonRef = useRef(null);
  const toastTimerRef = useRef(null);

  function showToast(text) {
    setToast(text);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 3500);
  }

  async function loadProjects() {
    const data = await apiRequest("/api/projects");
    setProjects(data.projects || []);
  }

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    masterVolumeRef.current = masterVolume;
  }, [masterVolume]);

  useEffect(() => {
    if (!isPlaying || !project) {
      if (!project) {
        setIsPlaying(false);
        setCurrentStep(-1);
      }
      return;
    }

    const context = audioContextRef.current;
    if (!context) {
      setIsPlaying(false);
      return;
    }

    stepRef.current = 0;

    function playNextStep() {
      const currentProject = projectRef.current;
      if (!currentProject) return;

      const stepCount = currentProject.stepCount || 16;
      const step = stepRef.current % stepCount;
      const playTime = context.currentTime + 0.01;

      setCurrentStep(step);

      (currentProject.tracks || []).forEach((track, trackIndex) => {
        if (!track.muted && track.steps?.[step]) {
          playTrackSound(
            context,
            track.name,
            playTime,
            trackIndex,
            (track.volume ?? 1) * masterVolumeRef.current,
            track.pan ?? 0
          );
        }
      });

      stepRef.current = (step + 1) % stepCount;
    }

    const timerDuration = 60000 / (project.bpm || 120) / 4;
    playNextStep();
    const timer = window.setInterval(playNextStep, timerDuration);
    return () => window.clearInterval(timer);
  }, [isPlaying, project?._id, project?.bpm]);

  useEffect(() => {
    apiRequest("/api/auth/me")
      .then(async (data) => {
        setUser(data.user);
        setShowLanding(false);
        await loadProjects();
      })
      .catch(() => {
        // Not logged in; show the landing page.
      });
  }, []);

  useEffect(() => {
    if (user || showLanding) return undefined;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setMessage("Google sign-in needs VITE_GOOGLE_CLIENT_ID in frontend .env");
      return undefined;
    }

    let cancelled = false;
    let script = document.querySelector("script[data-google-identity]");
    const renderGoogleButton = () => {
      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => handleGoogleCredential(response.credential)
      });
      googleButtonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline", size: "large", shape: "rectangular",
        text: "continue_with", width: 320
      });
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else if (script) {
      script.addEventListener("load", renderGoogleButton, { once: true });
    } else {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = "true";
      script.onload = renderGoogleButton;
      script.onerror = () => setMessage("Could not load Google sign-in");
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      script?.removeEventListener("load", renderGoogleButton);
    };
  }, [user, showLanding]);
  useEffect(() => {
    if (!user || !project?._id) return;

    setConnection("Connecting...");
    setPresence([]);

    const socket = io(API_URL, { withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnection("Connected");
      socket.emit("project:join", { projectId: project._id }, (result) => {
        if (result?.error) {
          setMessage(result.error);
          return;
        }

        setProject(result.project);
        setProjectNameDraft(result.project.title || "");
        setBpmDraft(result.project.bpm);
        setMessage(`Joined "${result.project.title}"`);
      });
    });

    socket.on("connect_error", (error) => {
      setConnection("Connection failed");
      setMessage(error.message || "Could not connect to the live room");
    });

    socket.on("project:updated", ({ project: updatedProject, updatedBy }) => {
      setProject(updatedProject);
      setProjectNameDraft(updatedProject.title || "");
      setBpmDraft(updatedProject.bpm);

      setProjects((current) =>
        current.map((item) =>
          item._id === updatedProject._id
            ? {
                ...item,
                title: updatedProject.title,
                bpm: updatedProject.bpm,
                stepCount: updatedProject.stepCount,
                updatedAt: updatedProject.updatedAt
              }
            : item
        )
      );

      if (updatedBy?.id !== user.id) {
        setMessage(`${updatedBy?.name || "A collaborator"} updated the project`);
      }
    });

    socket.on("room:presence", setPresence);
    socket.on("disconnect", () => setConnection("Disconnected"));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, project?._id]);

  async function togglePlayback() {
    if (isPlaying) {
      setIsPlaying(false);
      setCurrentStep(-1);
      return;
    }

    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        setMessage("This browser does not support Web Audio");
        return;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }

      await audioContextRef.current.resume();
      setIsPlaying(true);
      setMessage("Playing in this browser");
    } catch (error) {
      setMessage(`Could not start audio: ${error.message}`);
    }
  }

  async function handleGoogleCredential(credential) {
    if (!credential) {
      setMessage("Google did not return a sign-in credential");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const data = await apiRequest("/api/auth/google", {
        method: "POST",
        body: JSON.stringify({ credential })
      });
      setUser(data.user);
      setShowLanding(false);
      showToast("Signed in with Google");
      await loadProjects();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function handleAuth(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const endpoint =
        authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const body =
        authMode === "register"
          ? { name, email, password }
          : { email, password };

      const data = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(body)
      });

      setUser(data.user);
      setShowLanding(false);
      setPassword("");
      await loadProjects();
      showToast(authMode === "register" ? "Account created successfully" : "Welcome back!");
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch {
      // Clear the local screen even if the request fails.
    }

    setIsPlaying(false);
    socketRef.current?.disconnect();
    setUser(null);
    setProjects([]);
    setProject(null);
    setPresence([]);
    setShowAdmin(false);
    setShowClassroom(false);
    setShowProfile(false);
    setShowLanding(true);
    setMessage("");
  }

  async function createProject() {
    const title = newProjectName.trim();

    if (!title) {
      setMessage("Enter a name for your beat first");
      return;
    }

    setBusy(true);
    setMessage("");
    setIsPlaying(false);

    try {
      const data = await apiRequest("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          title,
          bpm: 120,
          stepCount: 16,
          tracks: blankTracks()
        })
      });

      await loadProjects();
      setProject(data.project);
      setProjectNameDraft(data.project.title || title);
      setBpmDraft(data.project.bpm);
      setNewProjectName("");
      setMessage("Beat created and saved");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function openProject(projectId) {
    setBusy(true);
    setMessage("");
    setIsPlaying(false);
    setShowAdmin(false);
    setShowClassroom(false);

    try {
      const data = await apiRequest(`/api/projects/${projectId}`);
      setProject(data.project);
      setProjectNameDraft(data.project.title || "");
      setBpmDraft(data.project.bpm);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  function sendProjectUpdate(updates) {
    const socket = socketRef.current;

    if (!socket?.connected) {
      setMessage("The live room is not connected");
      return;
    }

    socket.emit("project:update", updates, (result) => {
      setMessage(
        result?.error ? result.error : "Saved and synced to the room"
      );
    });
  }

  function saveProjectName() {
    const title = projectNameDraft.trim();

    if (!title) {
      setMessage("Enter a name for this beat");
      return;
    }

    sendProjectUpdate({ title });
  }

  async function downloadMp3() {
    if (!project) return;

    const OfflineAudioContextClass =
      window.OfflineAudioContext || window.webkitOfflineAudioContext;

    if (!OfflineAudioContextClass) {
      setMessage("MP3 export is not supported in this browser");
      return;
    }

    setBusy(true);
    setMessage("Rendering four loops and creating MP3...");

    try {
      const sampleRate = 44100;
      const loopCount = 4;
      const stepCount = project.stepCount || 16;
      const bpm = project.bpm || 120;
      const stepDuration = 60 / bpm / 4;
      const renderDuration = stepCount * stepDuration * loopCount + 1;
      const frameCount = Math.ceil(renderDuration * sampleRate);
      const offline = new OfflineAudioContextClass(2, frameCount, sampleRate);

      for (let loop = 0; loop < loopCount; loop += 1) {
        for (let step = 0; step < stepCount; step += 1) {
          const time = (loop * stepCount + step) * stepDuration + 0.01;

          (project.tracks || []).forEach((track, trackIndex) => {
            if (!track.muted && track.steps?.[step]) {
              playTrackSound(
                offline,
                track.name,
                time,
                trackIndex,
                (track.volume ?? 1) * masterVolume,
                track.pan ?? 0
              );
            }
          });
        }
      }

      const rendered = await offline.startRendering();
      const encoder = new lamejs.Mp3Encoder(2, sampleRate, 192);
      const left = rendered.getChannelData(0);
      const right = rendered.getChannelData(1);
      const mp3Chunks = [];
      const blockSize = 1152;

      for (let offset = 0; offset < left.length; offset += blockSize) {
        const leftBlock = toInt16(left.subarray(offset, offset + blockSize));
        const rightBlock = toInt16(right.subarray(offset, offset + blockSize));
        const encoded = encoder.encodeBuffer(leftBlock, rightBlock);

        if (encoded.length) mp3Chunks.push(new Uint8Array(encoded));
      }

      const finalChunk = encoder.flush();
      if (finalChunk.length) mp3Chunks.push(new Uint8Array(finalChunk));

      const blob = new Blob(mp3Chunks, { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = (projectNameDraft.trim() || project.title || "beat")
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
        .trim();

      link.href = url;
      link.download = `${safeName || "beat"}.mp3`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      setMessage("MP3 downloaded");
    } catch (error) {
      setMessage(`Could not export MP3: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  function toggleStep(trackIndex, stepIndex) {
    setProject((current) => {
      if (!current) return current;

      const tracks = (current.tracks || []).map((track, index) => {
        if (index !== trackIndex) return track;

        const steps = Array.from(
          { length: current.stepCount },
          (_, i) => Boolean(track.steps?.[i])
        );
        steps[stepIndex] = !steps[stepIndex];
        return { ...track, steps };
      });

      return { ...current, tracks };
    });
  }

  function updateTrack(trackIndex, updates) {
    setProject((current) => {
      if (!current) return current;

      return {
        ...current,
        tracks: (current.tracks || []).map((track, index) =>
          index === trackIndex ? { ...track, ...updates } : track
        )
      };
    });
  }

  function savePattern() {
    if (project) sendProjectUpdate({ tracks: project.tracks });
  }

  if (!user && showLanding) {
    return (
      <LandingPage
        onLogin={() => {
          setAuthMode("login");
          setShowLanding(false);
          setMessage("");
        }}
        onRegister={() => {
          setAuthMode("register");
          setShowLanding(false);
          setMessage("");
        }}
      />
    );
  }

  if (!user) {
    return (
      <main className="auth-page">
        {toast && <div className="app-toast" role="status" aria-live="polite" style={{ position: "fixed", top: 20, right: 20, zIndex: 10000, padding: "14px 20px", borderRadius: 12, background: "#12372f", color: "#eafff7", boxShadow: "0 12px 32px rgba(0,0,0,.28)", fontWeight: 600 }}>{toast}</div>}
        <section className="auth-card">
          <button
            className="quiet-button"
            type="button"
            onClick={() => {
              setShowLanding(true);
              setMessage("");
            }}
          >
            ← Back to home
          </button>

          <div className="brand-mark">G</div>
          <p className="eyebrow">COLLABORATIVE BEAT CANVAS</p>
          <h1>Gridophonic</h1>
          <p className="muted">Sign in to open your studio and work on a beat.</p>

          <div className="auth-tabs">
            <button
              className={authMode === "login" ? "active" : ""}
              onClick={() => setAuthMode("login")}
              type="button"
            >
              Log in
            </button>
            <button
              className={authMode === "register" ? "active" : ""}
              onClick={() => setAuthMode("register")}
              type="button"
            >
              Register
            </button>
          </div>

          <form onSubmit={handleAuth} className="auth-form">
            {authMode === "register" && (
              <label>
                Name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  minLength={2}
                  required
                />
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </label>
            <button className="primary-button full-width" disabled={busy}>
              {busy
                ? "Please wait..."
                : authMode === "register"
                  ? "Create account"
                  : "Enter studio"}
            </button>
          </form>
          
          <div className="auth-divider"><span>OR</span></div>
          <div className="google-signin-container" ref={googleButtonRef} />
          {message && <p className="notice">{message}</p>}
        </section>
      </main>
    );
  }

  if (showProfile) {
    return (
      <ProfilePage
        onBack={() => setShowProfile(false)}
        onProfileUpdated={(updatedUser) =>
          setUser((currentUser) => ({ ...currentUser, ...updatedUser }))
        }
      />
    );
  }
  return (
    <main className="studio">
      {toast && <div className="app-toast" role="status" aria-live="polite" style={{ position: "fixed", top: 20, right: 20, zIndex: 10000, padding: "14px 20px", borderRadius: 12, background: "#12372f", color: "#eafff7", boxShadow: "0 12px 32px rgba(0,0,0,.28)", fontWeight: 600 }}>{toast}</div>}
      <header className="topbar">
        <a
          className="wordmark"
          href="#studio"
          onClick={() => {
            setProject(null);
            setShowAdmin(false);
            setShowClassroom(false);
          }}
        >
          <span className="small-mark">G</span>
          Gridophonic
        </a>

        <div className="topbar-right">
          <span className={`connection ${connection === "Connected" ? "online" : ""}`}>
            <i />
            {connection}
          </span>
          <span className="user-name">{user.name}</span>
          <button
            className="quiet-button"
            type="button"
            onClick={() => setShowProfile(true)}
          >
            Profile
          </button>

          <button
            className="quiet-button"
            type="button"
            onClick={() => {
              setProject(null);
              setShowAdmin(false);
              setShowClassroom((current) => !current);
              setMessage("");
            }}
          >
            {showClassroom ? "Studio" : "Classroom"}
          </button>

          {user.role === "admin" && (
            <button
              className="quiet-button"
              type="button"
              onClick={() => {
                setProject(null);
                setShowClassroom(false);
                setShowAdmin((current) => !current);
                setMessage("");
              }}
            >
              {showAdmin ? "Studio" : "Admin"}
            </button>
          )}

          <button className="quiet-button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      {!project ? (
        showAdmin && user.role === "admin" ? (
          <AdminPanel />
        ) : showClassroom ? (
          <ClassroomPanel user={user} onOpenBeat={openProject} onProjectDeleted={loadProjects} />
        ) : (
          <section className="dashboard">
            <div className="dashboard-heading">
              <div>
                <p className="eyebrow">YOUR WORKSPACE</p>
                <h1>Projects</h1>
                <p className="muted">Pick up a beat or start a new one.</p>
              </div>

              <div className="new-project-control">
                <input
                  className="project-name-input"
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  maxLength={100}
                  placeholder="Name your beat"
                  aria-label="New beat name"
                />
                <button
                  className="primary-button"
                  onClick={createProject}
                  disabled={busy}
                >
                  {busy ? "Creating..." : "+ New project"}
                </button>
              </div>
            </div>

            {message && <p className="notice">{message}</p>}

            {projects.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">♫</div>
                <h2>Your studio is ready</h2>
                <p className="muted">Name a beat and create your first project.</p>
              </div>
            ) : (
              <div className="project-grid">
                {projects.map((item) => (
                  <button
                    className="project-card"
                    key={item._id}
                    onClick={() => openProject(item._id)}
                  >
                    <span className="project-card-icon">♫</span>
                    <span className="project-title">{item.title}</span>
                    <span className="project-meta">
                      {item.bpm} BPM <span>·</span> {item.stepCount} steps
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )
      ) : (
        <section className="sequencer-page">
          <div className="editor-heading">
            <button
              className="quiet-button"
              onClick={() => {
                setIsPlaying(false);
                setProject(null);
              }}
            >
              ← Projects
            </button>

            <div className="editor-title">
              <p className="eyebrow">LIVE PROJECT ROOM</p>
              <div className="project-title-control">
                <input
                  className="project-name-input"
                  value={projectNameDraft}
                  onChange={(event) => setProjectNameDraft(event.target.value)}
                  maxLength={100}
                  aria-label="Beat name"
                />
                <button
                  className="primary-button"
                  type="button"
                  onClick={saveProjectName}
                >
                  Save name
                </button>
              </div>
            </div>

            <div className="presence">
              {presence.map((person) => (
                <span className="avatar" title={person.name} key={person.id}>
                  {person.name?.slice(0, 1).toUpperCase()}
                </span>
              ))}
              <span className="presence-label">{presence.length} online</span>
            </div>
          </div>

          {message && <p className="notice">{message}</p>}

          <div className="transport">
            <div>
              <p className="eyebrow">TEMPO</p>
              <div className="tempo-control">
                <input
                  type="number"
                  min="40"
                  max="240"
                  value={bpmDraft}
                  onChange={(event) => setBpmDraft(event.target.value)}
                />
                <span>BPM</span>
                <button
                  className="primary-button"
                  onClick={() => sendProjectUpdate({ bpm: Number(bpmDraft) })}
                >
                  Save tempo
                </button>
              </div>
            </div>

            <button className="primary-button" onClick={togglePlayback}>
              {isPlaying ? "❚❚ Pause" : "▶ Play"}
            </button>

            <div className="master-control">
              <label htmlFor="master-volume">MASTER</label>
              <input
                id="master-volume"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={masterVolume}
                onChange={(event) => setMasterVolume(Number(event.target.value))}
              />
              <span>{Math.round(masterVolume * 100)}%</span>
            </div>

            <span className="room-status">
              <i />
              {connection}
            </span>
          </div>

          <div className="sequencer">
            <div className="grid-header">
              <span>TRACK</span>
              <span>LEVEL</span>
              <span>PAN / MUTE</span>
              {Array.from({ length: project.stepCount }, (_, index) => (
                <span
                  key={index}
                  className={index % 4 === 0 ? "bar-start" : ""}
                  style={
                    currentStep === index
                      ? { color: "#8bf0cf", textShadow: "0 0 10px #57d9ad" }
                      : undefined
                  }
                >
                  {index + 1}
                </span>
              ))}
            </div>

            {(project.tracks || []).map((track, trackIndex) => {
              const steps = Array.from(
                { length: project.stepCount },
                (_, i) => Boolean(track.steps?.[i])
              );
              const pan = track.pan ?? 0;

              return (
                <div className="track-row" key={`${track.name}-${trackIndex}`}>
                  <strong>{track.name || `Track ${trackIndex + 1}`}</strong>
                  <input
                    className="track-volume"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={track.volume ?? 1}
                    aria-label={`${track.name || "Track"} volume`}
                    onChange={(event) =>
                      updateTrack(trackIndex, {
                        volume: Number(event.target.value)
                      })
                    }
                  />

                  <div className="track-controls">
                    <input
                      className="track-pan"
                      type="range"
                      min="-1"
                      max="1"
                      step="0.01"
                      value={pan}
                      aria-label={`${track.name || "Track"} pan`}
                      title={
                        pan < -0.05
                          ? `Left ${Math.round(Math.abs(pan) * 100)}%`
                          : pan > 0.05
                            ? `Right ${Math.round(pan * 100)}%`
                            : "Center"
                      }
                      onChange={(event) =>
                        updateTrack(trackIndex, {
                          pan: Number(event.target.value)
                        })
                      }
                    />
                    <button
                      type="button"
                      className={`mute-button ${track.muted ? "is-muted" : ""}`}
                      onClick={() =>
                        updateTrack(trackIndex, { muted: !track.muted })
                      }
                    >
                      {track.muted ? "Muted" : "Mute"}
                    </button>
                  </div>

                  {steps.map((active, stepIndex) => (
                    <button
                      key={stepIndex}
                      type="button"
                      aria-label={`${track.name} step ${stepIndex + 1}`}
                      className={[
                        "step",
                        active ? "selected" : "",
                        stepIndex % 4 === 0 ? "bar-start" : ""
                      ].join(" ")}
                      style={
                        currentStep === stepIndex
                          ? {
                              outline: "2px solid #f1fff9",
                              outlineOffset: "2px"
                            }
                          : undefined
                      }
                      onClick={() => toggleStep(trackIndex, stepIndex)}
                    />
                  ))}
                </div>
              );
            })}

            {(!project.tracks || project.tracks.length === 0) && (
              <p className="muted">This project has no tracks yet.</p>
            )}
          </div>

          <div className="editor-actions">
            <span className="muted">
              Edit steps, volume, pan, and mute state, then save to sync the room.
            </span>
            <div className="editor-buttons">
              <button
                className="quiet-button"
                onClick={downloadMp3}
                disabled={busy}
              >
                {busy ? "Preparing MP3..." : "Download MP3"}
              </button>
              <button className="primary-button" onClick={savePattern}>
                Save pattern
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}




