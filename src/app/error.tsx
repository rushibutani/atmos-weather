"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="center-state"><p className="eyebrow">Something went wrong</p><h1>Atmos hit some turbulence.</h1><button className="button primary" onClick={reset}>Try again</button></main>; }
