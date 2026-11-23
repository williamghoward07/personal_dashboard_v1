import AiQueryBar from './components/AiQueryBar'
import HomeGrid from './components/home/HomeGrid'
import HomeDate from './components/home/HomeDate'

// Stays a server component: the client boundary lives inside HomeGrid (it
// owns the settings read, the drag sensors and the edit-mode state), so
// nothing above it has to ship to the browser.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-360 flex-1 flex-col px-4 py-5 sm:px-8">
      <HomeGrid
        heading={(
          <div>
            <h1 className="font-display text-2xl font-semibold text-on-surface">Home</h1>
            <HomeDate />
          </div>
        )}
        query={<AiQueryBar />}
      />
    </main>
  )
}
