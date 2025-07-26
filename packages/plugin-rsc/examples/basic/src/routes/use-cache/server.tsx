import { cache } from 'react'
import { revalidateCache } from '../../framework/use-cache-runtime'

export function TestUseCache() {
  return (
    <>
      <TestUseCacheFn />
      <TestUseCacheComponent />
      <TestUseCacheClosure />
      <TestReactCache />
    </>
  )
}

function TestUseCacheFn() {
  return (
    <form
      data-testid="test-use-cache-fn"
      action={async (formData) => {
        'use server'
        actionCount++
        const argument = formData.get('argument')
        await testFn(argument)
        if (argument === 'revalidate') {
          revalidateCache(testFn)
        }
      }}
    >
      <button>test-use-cache-fn</button>
      <input className="w-25" name="argument" placeholder="argument" />
      <span>
        (actionCount: {actionCount}, cacheFnCount: {cacheFnCount})
      </span>
    </form>
  )
}

let actionCount = 0
let cacheFnCount = 0

async function testFn(..._args: unknown[]) {
  'use cache'
  cacheFnCount++
}

function TestUseCacheComponent() {
  // NOTE: wrapping with `span` (or any jsx) is crucial because
  // raw string `children` would get included as cache key
  // and thus causes `TestComponent` to be evaluated in each render.
  return (
    <TestComponent>
      <span>{new Date().toISOString()}</span>
    </TestComponent>
  )
}

async function TestComponent(props: { children?: React.ReactNode }) {
  'use cache'
  return (
    <div data-testid="test-use-cache-component">
      [test-use-cache-component]{' '}
      <span data-testid="test-use-cache-component-static">
        (static: {new Date().toISOString()})
      </span>{' '}
      <span data-testid="test-use-cache-component-dynamic">
        (dynamic: {props.children})
      </span>
    </div>
  )
}

async function TestUseCacheClosure() {
  return (
    <div data-testid="test-use-cache-closure" className="flex gap-1">
      <form
        action={async (formData) => {
          'use server'
          actionCount2++
          outerFnArg = formData.get('outer') as string
          innerFnArg = formData.get('inner') as string
          await outerFn(outerFnArg)(innerFnArg)
        }}
      >
        <button>test-use-cache-closure</button>
        <input className="w-15" name="outer" placeholder="outer" />
        <input className="w-15" name="inner" placeholder="inner" />
      </form>
      <span>
        (actionCount: {actionCount2}, innerFnCount: {innerFnCount})
      </span>
    </div>
  )
}

function outerFn(outer: string) {
  async function innerFn(inner: string) {
    'use cache'
    innerFnCount++
    console.log({ outer, inner })
  }
  return innerFn
}

let outerFnArg = ''
let innerFnArg = ''
let innerFnCount = 0
let actionCount2 = 0

// New React.cache test case
function TestReactCache() {
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

// React.cache API test implementation

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
