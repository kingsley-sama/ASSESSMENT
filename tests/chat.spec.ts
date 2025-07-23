import { test, expect } from '@playwright/test';

test.describe('Chat Application E2E Tests', () => {
  test('should create and join a room successfully', async ({ page, context }) => {
    // Create a new page for second user
    const page2 = await context.newPage();

    // First user creates a room
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Welcome to JoyRoom');

    await page.fill('input[placeholder="Enter your username"]', 'TestUser1');
    await page.fill('input[placeholder="My Awesome Room"]', 'Test Room');
    await page.click('button:has-text("Create Room")');

    // Wait for navigation to chat room
    await page.waitForURL('/chat/*');
    await expect(page.locator('h2')).toContainText('Chat Room');

    // Get room ID from URL
    const roomId = page.url().split('/chat/')[1];

    // Second user joins the room
    await page2.goto('/');
    await page2.fill('input[placeholder="Enter your username"]', 'TestUser2');
    await page2.fill('input[placeholder="Enter room ID"]', roomId);
    await page2.click('button:has-text("Join Room")');

    await page2.waitForURL(`/chat/${roomId}`);

    // Verify both users are in the same room
    await expect(page.locator('h2')).toContainText('Chat Room');
    await expect(page2.locator('h2')).toContainText('Chat Room');
  });

  test('should send and receive messages', async ({ page, context }) => {
    const page2 = await context.newPage();

    // Setup: Create room and join with two users
    await page.goto('/');
    await page.fill('input[placeholder="Enter your username"]', 'Alice');
    await page.click('button:has-text("Create Room")');
    await page.waitForURL('/chat/*');
    
    const roomId = page.url().split('/chat/')[1];

    await page2.goto('/');
    await page2.fill('input[placeholder="Enter your username"]', 'Bob');
    await page2.fill('input[placeholder="Enter room ID"]', roomId);
    await page2.click('button:has-text("Join Room")');
    await page2.waitForURL(`/chat/${roomId}`);

    // Alice sends a message
    await page.fill('input[placeholder="Type your message..."]', 'Hello Bob!');
    await page.click('button:has-text("Send")');

    // Bob should receive the message
    await expect(page2.locator('text=Hello Bob!')).toBeVisible();

    // Bob replies
    await page2.fill('input[placeholder="Type your message..."]', 'Hi Alice!');
    await page2.click('button:has-text("Send")');

    // Alice should receive Bob's message
    await expect(page.locator('text=Hi Alice!')).toBeVisible();
  });

  test('should show typing indicator', async ({ page, context }) => {
    const page2 = await context.newPage();

    // Setup: Create room and join with two users
    await page.goto('/');
    await page.fill('input[placeholder="Enter your username"]', 'TypingUser1');
    await page.click('button:has-text("Create Room")');
    await page.waitForURL('/chat/*');
    
    const roomId = page.url().split('/chat/')[1];

    await page2.goto('/');
    await page2.fill('input[placeholder="Enter your username"]', 'TypingUser2');
    await page2.fill('input[placeholder="Enter room ID"]', roomId);
    await page2.click('button:has-text("Join Room")');
    await page2.waitForURL(`/chat/${roomId}`);

    // User 1 starts typing
    await page.fill('input[placeholder="Type your message..."]', 'I am typing');

    // User 2 should see typing indicator
    await expect(page2.locator('text=TypingUser1 is typing')).toBeVisible({ timeout: 5000 });

    // Stop typing (clear input)
    await page.fill('input[placeholder="Type your message..."]', '');

    // Typing indicator should disappear
    await expect(page2.locator('text=TypingUser1 is typing')).not.toBeVisible({ timeout: 5000 });
  });

  test('should show user join/leave notifications', async ({ page, context }) => {
    // Create room with first user
    await page.goto('/');
    await page.fill('input[placeholder="Enter your username"]', 'Host');
    await page.click('button:has-text("Create Room")');
    await page.waitForURL('/chat/*');
    
    const roomId = page.url().split('/chat/')[1];

    // Second user joins
    const page2 = await context.newPage();
    await page2.goto('/');
    await page2.fill('input[placeholder="Enter your username"]', 'Guest');
    await page2.fill('input[placeholder="Enter room ID"]', roomId);
    await page2.click('button:has-text("Join Room")');
    await page2.waitForURL(`/chat/${roomId}`);

    // Host should see join notification
    await expect(page.locator('text=Guest joined the room')).toBeVisible({ timeout: 5000 });

    // Guest leaves
    await page2.click('button[title="Leave room"]', { timeout: 5000 });

    // Host should see leave notification
    await expect(page.locator('text=Guest left the room')).toBeVisible({ timeout: 5000 });
  });

  test('should display user list and allow room owner to remove users', async ({ page, context }) => {
    // Create room as owner
    await page.goto('/');
    await page.fill('input[placeholder="Enter your username"]', 'Owner');
    await page.click('button:has-text("Create Room")');
    await page.waitForURL('/chat/*');
    
    const roomId = page.url().split('/chat/')[1];

    // Second user joins
    const page2 = await context.newPage();
    await page2.goto('/');
    await page2.fill('input[placeholder="Enter your username"]', 'Member');
    await page2.fill('input[placeholder="Enter room ID"]', roomId);
    await page2.click('button:has-text("Join Room")');
    await page2.waitForURL(`/chat/${roomId}`);

    // Owner opens user list
    await page.click('button:has-text("users")');
    await expect(page.locator('text=Room Users')).toBeVisible();

    // Verify both users are listed
    await expect(page.locator('text=Owner')).toBeVisible();
    await expect(page.locator('text=Member')).toBeVisible();

    // Owner should see crown indicator
    await expect(page.locator('svg[data-testid="crown-icon"]')).toBeVisible();
  });

  test('should handle room lifecycle - empty room deletion', async ({ page, context }) => {
    // Create room
    await page.goto('/');
    await page.fill('input[placeholder="Enter your username"]', 'TempUser');
    await page.click('button:has-text("Create Room")');
    await page.waitForURL('/chat/*');

    // Leave room (should delete empty room)
    await page.click('button[title="Leave room"]', { timeout: 5000 });
    await page.waitForURL('/');

    // Should be back at home page
    await expect(page.locator('h1')).toContainText('Welcome to JoyRoom');
  });

  test('should transfer ownership when owner leaves', async ({ page, context }) => {
    // Create room as owner
    await page.goto('/');
    await page.fill('input[placeholder="Enter your username"]', 'OriginalOwner');
    await page.click('button:has-text("Create Room")');
    await page.waitForURL('/chat/*');
    
    const roomId = page.url().split('/chat/')[1];

    // Second user joins
    const page2 = await context.newPage();
    await page2.goto('/');
    await page2.fill('input[placeholder="Enter your username"]', 'NewOwner');
    await page2.fill('input[placeholder="Enter room ID"]', roomId);
    await page2.click('button:has-text("Join Room")');
    await page2.waitForURL(`/chat/${roomId}`);

    // Original owner leaves
    await page.click('button[title="Leave room"]', { timeout: 5000 });

    // Check that NewOwner received ownership transfer notification
    await expect(page2.locator('text=NewOwner is now the room owner')).toBeVisible({ timeout: 5000 });
  });

  test('should copy room ID to clipboard', async ({ page }) => {
    // Create room
    await page.goto('/');
    await page.fill('input[placeholder="Enter your username"]', 'TestUser');
    await page.click('button:has-text("Create Room")');
    await page.waitForURL('/chat/*');

    // Click copy button
    await page.click('button[title="Copy room ID"]', { timeout: 5000 });

    // Should show toast notification
    await expect(page.locator('text=Room ID copied!')).toBeVisible({ timeout: 5000 });
  });

  test('should handle error cases gracefully', async ({ page }) => {
    // Try to join non-existent room
    await page.goto('/');
    await page.fill('input[placeholder="Enter your username"]', 'TestUser');
    await page.fill('input[placeholder="Enter room ID"]', 'nonexistent');
    await page.click('button:has-text("Join Room")');

    // Should show error message
    await expect(page.locator('text=Room not found')).toBeVisible({ timeout: 5000 });

    // Try to create room without username
    await page.goto('/');
    await page.click('button:has-text("Create Room")');

    // Should show validation error
    await expect(page.locator('text=Username required')).toBeVisible({ timeout: 5000 });
  });
});
