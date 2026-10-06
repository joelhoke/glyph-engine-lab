/** Bound model initialization separately from the on-demand animation loops.
 * Negative priorities wait until their owner becomes visible again. */
export type ModelLoadTicket = {
  setPriority(priority: number): void
  finish(): void
}

export function createModelLoadQueue(limit = 2, defer: (run: () => void) => void = run => { setTimeout(run, 0) }) {
  const pending: Array<{ priority: number; start: () => void; running: boolean; done: boolean }> = []
  let running = 0
  let scheduled = false
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    defer(() => {
      scheduled = false
      pending.sort((a, b) => b.priority - a.priority)
      while (running < limit) {
        const index = pending.findIndex(job => !job.done && !job.running && job.priority >= 0)
        if (index < 0) break
        const job = pending.splice(index, 1)[0]
        job.running = true
        running++
        job.start()
      }
    })
  }
  return {
    enqueue(priority: number, start: () => void): ModelLoadTicket {
      const job = { priority, start, running: false, done: false }
      pending.push(job)
      schedule()
      return {
        setPriority(value) { if (!job.done) { job.priority = value; schedule() } },
        finish() {
          if (job.done) return
          job.done = true
          if (job.running) running--
          const index = pending.indexOf(job)
          if (index !== -1) pending.splice(index, 1)
          schedule()
        },
      }
    },
  }
}

export const homeModelLoads = createModelLoadQueue()

export function modelLoadPriority(active: boolean, highlighted: boolean, presentation: 'hero' | 'section', variant: string) {
  if (presentation === 'section') return active ? 30 : 5
  if (!active) return -1
  if (highlighted) return 40
  return variant === 'notebook' ? 15 : variant === 'work' ? 14 : 10
}
