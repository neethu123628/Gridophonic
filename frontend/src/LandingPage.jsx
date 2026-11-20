const features = [
  {
    number: "01",
    title: "Build a beat, step by step",
    text: "Shape a rhythm with a clear, hands-on sequencer. Adjust tempo, volume, and pan as your idea takes shape."
  },
  {
    number: "02",
    title: "Make music together",
    text: "Invite collaborators into a shared project room and work on the same beat in real time."
  },
  {
    number: "03",
    title: "Keep every idea",
    text: "Save your patterns as projects and come back to them whenever inspiration returns."
  }
];

const reviews = [
  {
    quote: "It feels easy to turn a rhythm idea into something I can actually hear and share.",
    name: "Maya R.",
    role: "Independent producer"
  },
  {
    quote: "The shared room makes it simple to build a beat with a friend, even when we’re apart.",
    name: "Jordan K.",
    role: "Musician"
  },
  {
    quote: "A fun place to experiment. I can sketch a pattern in minutes and keep refining it.",
    name: "Alex T.",
    role: "Bedroom producer"
  }
];

function Waveform() {
  const heights = [22, 38, 28, 56, 34, 72, 42, 88, 45, 66, 30, 78, 50, 94, 38, 62, 30, 76, 42, 58, 26, 68, 36, 84, 48, 30, 60, 40, 74, 34, 54, 24];

  return (
    <div className="flex h-32 items-center justify-center gap-1.5 sm:gap-2" aria-hidden="true">
      {heights.map((height, index) => (
        <span
          key={index}
          className="landing-bar w-1.5 rounded-full bg-gradient-to-t from-violet-500 to-teal-300 sm:w-2"
          style={{ height: `${height}%`, animationDelay: `${index * 35}ms` }}
        />
      ))}
    </div>
  );
}

export default function LandingPage({ onLogin, onRegister }) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#080b12] text-slate-100">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#080b12]/80 backdrop-blur-xl">
        <nav className="mx-auto flex w-[min(1180px,92vw)] items-center justify-between py-4">
          <a href="#home" className="flex items-center gap-3 font-extrabold tracking-tight">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-300 to-violet-400 text-lg text-slate-950 shadow-lg shadow-teal-300/10">
              G
            </span>
            <span className="text-lg">Gridophonic</span>
          </a>

          <div className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <a className="transition hover:text-teal-200" href="#about">About</a>
            <a className="transition hover:text-teal-200" href="#features">Features</a>
            <a className="transition hover:text-teal-200" href="#reviews">Reviews</a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              className="rounded-xl px-3 py-2 text-sm text-slate-300 transition hover:text-white sm:px-4"
              onClick={onLogin}
            >
              Log in
            </button>
            <button
              className="rounded-xl bg-teal-300 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-teal-300/10 transition hover:-translate-y-0.5 hover:bg-teal-200 sm:px-5"
              onClick={onRegister}
            >
              Get started
            </button>
          </div>
        </nav>
      </header>

      <section id="home" className="relative isolate">
        <div className="pointer-events-none absolute -left-40 top-16 -z-10 h-96 w-96 rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="pointer-events-none absolute -right-40 top-40 -z-10 h-96 w-96 rounded-full bg-teal-400/10 blur-[120px]" />

        <div className="mx-auto grid min-h-[650px] w-[min(1180px,92vw)] items-center gap-12 py-20 md:grid-cols-[1.05fr_0.95fr] md:py-28">
          <div className="landing-reveal">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-200/20 bg-teal-200/5 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-teal-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-teal-300" />
              Your collaborative beat studio
            </p>

            <h1 className="max-w-3xl text-5xl font-extrabold leading-[1.04] tracking-[-0.06em] sm:text-6xl lg:text-7xl">
              Turn a rhythm
              <span className="block bg-gradient-to-r from-teal-200 via-cyan-200 to-violet-300 bg-clip-text text-transparent">
                into a shared sound.
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-base leading-8 text-slate-400 sm:text-lg">
              Create beats, shape every detail, and collaborate live in a studio made for your next idea.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <button
                className="rounded-xl bg-teal-300 px-6 py-3.5 font-bold text-slate-950 shadow-xl shadow-teal-300/10 transition hover:-translate-y-1 hover:bg-teal-200"
                onClick={onRegister}
              >
                Start creating <span aria-hidden="true">→</span>
              </button>
              <a
                className="rounded-xl border border-white/15 px-6 py-3.5 font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/5"
                href="#about"
              >
                Explore the studio
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-400">
              <span><span className="mr-2 text-teal-300">✓</span>Real-time collaboration</span>
              <span><span className="mr-2 text-teal-300">✓</span>Save your projects</span>
            </div>
          </div>

          <div className="landing-reveal landing-reveal-delay relative">
            <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-teal-300/10 to-violet-500/10 blur-2xl" />
            <div className="relative rounded-[1.75rem] border border-white/10 bg-[#111722]/90 p-5 shadow-2xl shadow-black/40 sm:p-7">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.18em] text-slate-500">SESSION 01</p>
                  <h2 className="mt-1 text-lg font-bold">Midnight Motion</h2>
                </div>
                <span className="rounded-lg border border-teal-200/20 bg-teal-200/5 px-3 py-2 font-mono text-xs text-teal-200">124 BPM</span>
              </div>

              <Waveform />

              <div className="space-y-3">
                {[
                  ["KICK", "w-3/4", "from-teal-300 to-cyan-300"],
                  ["SNARE", "w-1/2", "from-violet-400 to-fuchsia-300"],
                  ["HI-HAT", "w-2/3", "from-cyan-300 to-blue-300"]
                ].map(([label, width, gradient], row) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="w-14 font-mono text-[9px] tracking-wider text-slate-500">{label}</span>
                    <div className="grid flex-1 grid-cols-8 gap-1.5">
                      {Array.from({ length: 16 }, (_, index) => {
                        const active = (index + row * 3) % (row + 3) === 0;
                        return (
                          <span
                            key={index}
                            className={`aspect-square rounded-[4px] border ${
                              active
                                ? `border-transparent bg-gradient-to-br ${gradient} shadow-lg shadow-teal-300/10`
                                : "border-white/10 bg-white/[0.03]"
                            }`}
                          />
                        );
                      })}
                    </div>
                    <span className={`hidden h-1 rounded-full bg-gradient-to-r ${gradient} ${width} sm:block`} />
                  </div>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
                <div className="flex -space-x-2">
                  {["M", "J", "A"].map((letter, index) => (
                    <span
                      key={letter}
                      className={`grid h-8 w-8 place-items-center rounded-full border-2 border-[#111722] text-xs font-bold text-slate-950 ${
                        index === 1 ? "bg-violet-300" : index === 2 ? "bg-cyan-200" : "bg-teal-200"
                      }`}
                    >
                      {letter}
                    </span>
                  ))}
                  <span className="ml-3 self-center text-xs text-slate-500">3 producers online</span>
                </div>
                <span className="font-mono text-xs text-teal-200">● LIVE</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="border-y border-white/[0.07] bg-white/[0.02]">
        <div className="mx-auto grid w-[min(1180px,92vw)] gap-10 py-20 md:grid-cols-[0.7fr_1.3fr] md:py-28">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal-200">About Gridophonic</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">A studio that starts with a beat.</h2>
          </div>
          <div>
            <p className="text-lg leading-8 text-slate-400">
              Gridophonic is a browser-based beat studio for turning small ideas into complete rhythms. Build patterns with an intuitive step sequencer, shape your sound, and invite collaborators into your project room.
            </p>
            <p className="mt-5 leading-7 text-slate-500">
              Whether you are sketching alone or creating with friends, your projects stay organized and ready for the next session.
            </p>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto w-[min(1180px,92vw)] py-20 md:py-28">
        <div className="max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal-200">Made for making</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Your ideas, in rhythm.</h2>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.number}
              className="group rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-7 transition duration-300 hover:-translate-y-1 hover:border-teal-200/30"
            >
              <span className="font-mono text-xs text-teal-200">{feature.number}</span>
              <h3 className="mt-8 text-xl font-bold">{feature.title}</h3>
              <p className="mt-3 leading-7 text-slate-400">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="reviews" className="border-y border-white/[0.07] bg-[#0d121b]">
        <div className="mx-auto w-[min(1180px,92vw)] py-20 md:py-28">
          <div className="text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal-200">From the studio</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Made for the joy of creating.</h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {reviews.map((review) => (
              <figure key={review.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
                <div className="text-lg tracking-[0.18em] text-amber-300" aria-label="5 out of 5 stars">★★★★★</div>
                <blockquote className="mt-5 min-h-24 leading-7 text-slate-300">
                  “{review.quote}”
                </blockquote>
                <figcaption className="mt-6 border-t border-white/10 pt-5">
                  <div className="font-semibold">{review.name}</div>
                  <div className="mt-1 text-sm text-slate-500">{review.role}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-[min(1180px,92vw)] py-20 md:py-24">
        <div className="relative overflow-hidden rounded-3xl border border-teal-100/15 bg-gradient-to-br from-teal-300/10 via-[#111722] to-violet-500/10 px-6 py-12 text-center sm:px-12">
          <div className="pointer-events-none absolute -right-12 -top-20 h-60 w-60 rounded-full bg-violet-400/10 blur-3xl" />
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-teal-200">Your next beat starts here</p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Make room for a new idea.</h2>
          <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-400">Open your studio, build a pattern, and bring someone in to create with you.</p>
          <button
            className="relative mt-8 rounded-xl bg-teal-300 px-6 py-3.5 font-bold text-slate-950 transition hover:-translate-y-1 hover:bg-teal-200"
            onClick={onRegister}
          >
            Create your account <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#06080d]">
        <div className="mx-auto flex w-[min(1180px,92vw)] flex-col gap-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <a href="#home" className="flex items-center gap-2 font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-300 text-slate-950">G</span>
            Gridophonic
          </a>
          <div className="flex flex-wrap gap-5 text-sm text-slate-500">
            <a className="hover:text-teal-200" href="#about">About</a>
            <a className="hover:text-teal-200" href="#features">Features</a>
            <a className="hover:text-teal-200" href="#reviews">Reviews</a>
          </div>
          <p className="text-xs text-slate-600">© {new Date().getFullYear()} Gridophonic</p>
        </div>
      </footer>
    </main>
  );
}