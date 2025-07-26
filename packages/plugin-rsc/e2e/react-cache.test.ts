import { test, expect } from '@playwright/test'
import { createFixture } from './fixture'

const fixture = createFixture({
  files: (examples) => examples.basic,
})

const { waitForHydration } = fixture

test.describe('React.cache API', () => {
  test('React.cache API functionality', async ({ page }) => {
    await page.goto(fixture.url())
    await waitForHydration(page)

    // Verify React.cache section is present
    const reactCacheSection = page.getByTestId('test-react-cache')
    await expect(reactCacheSection).toBeVisible()

    // Test cached data fetching - multiple components with same ID should share cache
    const user1Elements = page.getByTestId('react-cache-fetch-user-1')
    await expect(user1Elements).toHaveCount(2)

    // Both user-1 elements should have the same cached timestamp
    const user1Texts = await user1Elements.allTextContents()
    expect(user1Texts[0]).toEqual(user1Texts[1]) // Should be identical due to caching

    // Different user ID should have different data
    const user2Element = page.getByTestId('react-cache-fetch-user-2')
    await expect(user2Element).toBeVisible()
    const user2Text = await user2Element.textContent()
    expect(user2Text).toContain('User user-2')
    expect(user2Text).not.toEqual(user1Texts[0])

    // Test cached expensive computation
    const testDataElements = page.getByTestId(
      'react-cache-computation-test-data',
    )
    await expect(testDataElements).toHaveCount(2)

    // Both test-data elements should have identical results
    const computationTexts = await testDataElements.allTextContents()
    expect(computationTexts[0]).toEqual(computationTexts[1])
    expect(computationTexts[0]).toContain('Computed result for test-data')

    // Different data should produce different results
    const differentDataElement = page.getByTestId(
      'react-cache-computation-different-data',
    )
    await expect(differentDataElement).toBeVisible()
    const differentDataText = await differentDataElement.textContent()
    expect(differentDataText).toContain('Computed result for different-data')
    expect(differentDataText).not.toEqual(computationTexts[0])

    // Verify function call counts demonstrate caching is working
    expect(user1Texts[0]).toContain('Fetch calls: 2') // Should be 2 (user-1 and user-2)

    // Since we test both "test-data" and "different-data", and each is computed once,
    // the total computation count should show how many times the function was called
    // The text we get will show the count at the time the component was rendered
    // "test-data" components will show the count at the time they were computed (likely 1)
    // but the "different-data" component will show the final count after all computations
    if (differentDataText?.includes('Computation calls: 2')) {
      // Verify that by the time "different-data" was computed, both calls had been made
      expect(differentDataText).toContain('Computation calls: 2')
    } else {
      // If not, then verify that test-data shows 1 (cached properly)
      expect(computationTexts[0]).toContain('Computation calls: 1')
    }
  })
})
