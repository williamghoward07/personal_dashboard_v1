export interface TimedBlockInput {
  id: string
  startMinutes: number
  endMinutes: number // must be > startMinutes
}

export interface TimedBlockLayout {
  id: string
  column: number // 0-indexed
  columnCount: number // total columns in this block's overlap cluster
}

// Google-Calendar-style side-by-side layout for same-day overlapping
// events: blocks that don't overlap in time share the narrowest possible
// column count (rather than every block in the day fighting for the same
// full-width slot), and every block in a mutually-overlapping cluster gets
// an equal-width share of that cluster's column count. Pure and
// Supabase-free, unit-testable without a DOM.
export function layoutOverlappingBlocks(blocksIn: TimedBlockInput[]): TimedBlockLayout[] {
  const blocks = blocksIn.slice().sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes)
  const layouts: TimedBlockLayout[] = []

  let cluster: TimedBlockInput[] = []
  let clusterEnd = -Infinity

  const flushCluster = () => {
    if (cluster.length === 0) return

    // Greedy interval-graph colouring: each column tracks the end time of
    // the block currently occupying it; a block reuses the first column
    // that's already free by its start time, otherwise it opens a new one.
    const columnEnds: number[] = []
    const assigned: { id: string; column: number }[] = []
    for (const block of cluster) {
      let column = columnEnds.findIndex((end) => end <= block.startMinutes)
      if (column === -1) {
        column = columnEnds.length
        columnEnds.push(block.endMinutes)
      } else {
        columnEnds[column] = block.endMinutes
      }
      assigned.push({ id: block.id, column })
    }

    const columnCount = columnEnds.length
    for (const a of assigned) layouts.push({ id: a.id, column: a.column, columnCount })
    cluster = []
  }

  for (const block of blocks) {
    if (cluster.length > 0 && block.startMinutes >= clusterEnd) {
      flushCluster()
      clusterEnd = -Infinity
    }
    cluster.push(block)
    clusterEnd = Math.max(clusterEnd, block.endMinutes)
  }
  flushCluster()

  return layouts
}
