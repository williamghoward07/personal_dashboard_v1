import AiQueryBar from './components/AiQueryBar'
import HomeGrid from './components/home/HomeGrid'

// Stays a server component: the client boundary lives inside HomeGrid (it
// owns the settings read, the drag sensors and the edit-mode state), so
// nothing above it has to ship to the browser.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-8 py-6">
      <AiQueryBar />
      <HomeGrid />
    </main>
  )
}
