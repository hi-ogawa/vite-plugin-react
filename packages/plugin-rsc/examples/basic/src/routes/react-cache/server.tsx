import { cache } from 'react'

export function TestReactCache() {
  return (
    <div data-testid="test-react-cache" className="flex gap-2 p-2 border">
      <div>
        <h3>React.cache API Test</h3>
        <ReactCacheDataFetch id="user-1" />
        <ReactCacheDataFetch id="user-1" />
        <ReactCacheDataFetch id="user-2" />
        <ReactCacheExpensiveComputation data="test-data" />
        <ReactCacheExpensiveComputation data="test-data" />
        <ReactCacheExpensiveComputation data="different-data" />
      </div>
    </div>
  )
}

// Mock data fetching function
async function fetchUserData(id: string) {
  fetchUserDataCallCount++
  await new Promise((resolve) => setTimeout(resolve, 100)) // Simulate network delay
  return {
    id,
    name: `User ${id}`,
    email: `${id}@example.com`,
    timestamp: new Date().toISOString(),
  }
}

// Mock expensive computation
function expensiveComputation(data: string) {
  expensiveComputationCallCount++
  // Simulate expensive computation
  let result = 0
  for (let i = 0; i < 1000000; i++) {
    result += i
  }
  return `Computed result for ${data}: ${result}`
}

// Create cached versions using React.cache
const cachedFetchUserData = cache(fetchUserData)
const cachedExpensiveComputation = cache(expensiveComputation)

let fetchUserDataCallCount = 0
let expensiveComputationCallCount = 0

async function ReactCacheDataFetch({ id }: { id: string }) {
  const userData = await cachedFetchUserData(id)
  return (
    <div data-testid={`react-cache-fetch-${id}`} className="mb-2">
      <strong>User:</strong> {userData.name} ({userData.email})
      <br />
      <small>
        Fetch calls: {fetchUserDataCallCount} | Cached at: {userData.timestamp}
      </small>
    </div>
  )
}

function ReactCacheExpensiveComputation({ data }: { data: string }) {
  const result = cachedExpensiveComputation(data)
  return (
    <div data-testid={`react-cache-computation-${data}`} className="mb-2">
      <strong>Result:</strong> {result}
      <br />
      <small>Computation calls: {expensiveComputationCallCount}</small>
    </div>
  )
}
