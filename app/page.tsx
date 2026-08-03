import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { data, error } = await supabase.from('years').select('*')

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Study Copilot — Connection Test</h1>
      {error && <p>Error: {error.message}</p>}
      {data && (
        <pre>{JSON.stringify(data, null, 2)}</pre>
      )}
    </main>
  )
}