import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";

const headers = {
  Origin: process.env.E2E_BASE_URL || "http://localhost:3000",
  "X-Tenacom-Request": "1",
};

async function login(page: Page) {
  if (!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD)
    throw new Error("Dedicated E2E administrator credentials are required.");
  await page.goto("/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(process.env.E2E_ADMIN_EMAIL);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in to your workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Resource network", exact: true }),
  ).toBeVisible();
}

async function fillSubmission(page: Page, suffix: string) {
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: /sign in/i })).toHaveCount(0);
  await page
    .getByLabel("Full name", { exact: true })
    .fill(`Professional ${suffix}`);
  await page
    .getByLabel("Professional headline")
    .fill("Cross-industry systems specialist");
  await page
    .getByRole("button", { name: "Add location and more (optional)" })
    .click();
  await page.getByLabel("City or region").fill("Johannesburg");
  await page
    .getByLabel("Email address", { exact: true })
    .fill(`professional-${suffix}@example.test`);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "+ Python", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("checkbox").check();
}

async function checkAcknowledgement(page: Page) {
  const heading = page.getByRole("heading", {
    name: "Thank you!",
    exact: true,
  });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(
    page.getByText("Thank you for providing your details.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".submission-check svg path")).toBeVisible();
  await expect(page.locator(".submission-check")).toHaveCSS(
    "background-color",
    "rgb(22, 128, 74)",
  );
  await expect(page.locator(".submission-check")).toHaveCSS(
    "border-radius",
    "50%",
  );
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: /sign in/i })).toHaveCount(0);
  expect(new URL(page.url()).hash).toBe("");
  expect(await page.context().cookies()).toEqual([]);
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  expect((await page.request.get("/api/users")).status()).toBe(401);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
}

test("password-free mobile submission, staff profile management, assignment and hours", async ({
  page,
  browser,
}) => {
  const suffix = randomBytes(5).toString("hex");
  await login(page);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("link", { name: "Invite resources", exact: true })
    .click();
  await page
    .getByLabel("Label", { exact: true })
    .fill(`Browser test ${suffix}`);
  await page
    .getByRole("button", { name: "Create invitation & QR code" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your invitation is ready" }),
  ).toBeVisible();
  const invitationUrl = await page.getByLabel("Invitation link").inputValue();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download QR code" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("tenacom-invitation.png");
  expect(await download.failure()).toBeNull();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const resource = await mobile.newPage();
  await resource.goto(invitationUrl);
  await resource.screenshot({
    path: "test-results/mobile-onboarding.png",
    fullPage: true,
  });
  await fillSubmission(resource, suffix);
  const submitted = resource.waitForResponse(
    (r) =>
      r.url().endsWith("/api/onboarding") && r.request().method() === "POST",
  );
  await resource.getByRole("button", { name: "Submit details" }).click();
  const submission = await submitted;
  expect(submission.status()).toBe(201);
  expect(submission.headers()["set-cookie"]).toBeUndefined();
  expect(submission.request().postDataJSON()).not.toHaveProperty("password");
  await checkAcknowledgement(resource);
  await resource.screenshot({
    path: "test-results/mobile-thank-you.png",
    fullPage: true,
  });
  expect(
    (
      await resource.request.post("/api/auth/login", {
        headers,
        data: {
          email: `professional-${suffix}@example.test`,
          password: "no-resource-password-exists",
        },
      })
    ).status(),
  ).toBe(401);

  await page
    .getByRole("link", { name: "Resource network", exact: true })
    .click();
  await page.getByLabel("Search the network").fill(suffix);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: `Professional ${suffix}`, exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/desktop-network.png",
    fullPage: true,
  });
  await page
    .getByRole("article")
    .filter({ hasText: `Professional ${suffix}` })
    .getByRole("link", { name: "View profile" })
    .click();
  await page
    .getByLabel("A little about your work")
    .fill("I build reliable connected systems across industries.");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Profile details have been saved" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByLabel("Project code").fill(`E2E-${suffix}`);
  await page.getByLabel("Project name").fill(`Connected systems ${suffix}`);
  await page.getByLabel("Start date", { exact: true }).fill("2026-01-01");
  await page.getByRole("button", { name: "Save project" }).click();
  await page
    .getByRole("article")
    .filter({ hasText: `Connected systems ${suffix}` })
    .getByRole("link", { name: "Open project" })
    .click();
  await page.getByRole("button", { name: "Assign resource" }).click();
  await page.getByLabel("Find resource", { exact: true }).fill(suffix);
  await page.getByRole("button", { name: "Find", exact: true }).click();
  const resourceOption = page
    .getByLabel("Resource", { exact: true })
    .getByRole("option", { name: new RegExp(suffix) });
  await expect(resourceOption).toHaveCount(1);
  await page
    .getByLabel("Resource", { exact: true })
    .selectOption((await resourceOption.getAttribute("value")) as string);
  await page.getByLabel("Assignment role").fill("Systems engineer");
  await page.getByRole("button", { name: "Save assignment" }).click();
  await expect(
    page.getByRole("cell", { name: "Systems engineer" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Tracked hours", exact: true }).click();
  await page.route("**/api/assignments?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({
        title: "Assignments are temporarily unavailable.",
      }),
    }),
  );
  await page.getByRole("button", { name: "Record time" }).click();
  const form = page.getByRole("form", { name: "Record resource hours" });
  await form.getByLabel("Find resource", { exact: true }).fill(suffix);
  await form
    .getByRole("button", { name: "Find resource", exact: true })
    .click();
  const timeResourceOption = form
    .getByLabel("Resource", { exact: true })
    .getByRole("option", { name: new RegExp(suffix) });
  await expect(timeResourceOption).toHaveCount(1);
  await form
    .getByLabel("Resource", { exact: true })
    .selectOption((await timeResourceOption.getAttribute("value")) as string);
  await expect(
    form
      .getByRole("alert")
      .filter({ hasText: "Assignments are temporarily unavailable." }),
  ).toBeVisible();
  await expect(form.getByRole("button", { name: "Save time" })).toBeDisabled();
  await page.unroute("**/api/assignments?*");
  await form.getByRole("button", { name: "Reload assignments" }).click();
  const assignmentOption = form
    .getByLabel("Project assignment")
    .getByRole("option", { name: new RegExp(`Connected systems ${suffix}`) });
  await expect(assignmentOption).toHaveCount(1);
  await form
    .getByLabel("Project assignment")
    .selectOption((await assignmentOption.getAttribute("value")) as string);
  await form.getByLabel("Work date").fill("2026-01-02");
  await form.getByLabel("Time worked (minutes)").fill("90");
  await form
    .getByLabel("Work notes (optional)")
    .fill("Designed the monitoring system");
  await form.getByRole("button", { name: "Save time" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Time saved" }),
  ).toBeVisible();
  const report = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Hours by resource & project",
      exact: true,
    }),
  });
  await expect(
    report
      .getByRole("row")
      .filter({ hasText: `Professional ${suffix}` })
      .getByRole("cell")
      .last(),
  ).toHaveText(/^1[.,]5$/);
  await expect(
    page.getByRole("columnheader", { name: "Recorded by" }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "test-results/desktop-staff-hours.png",
    fullPage: true,
  });
  await mobile.close();
});

test("failed public submission retains details and only acknowledges a successful retry", async ({
  page,
  browser,
}) => {
  await login(page);
  const suffix = randomBytes(5).toString("hex");
  const invitation = await page.request.post("/api/invitations", {
    headers,
    data: { label: `Retry ${suffix}`, days: 1, maxUses: 1 },
  });
  expect(invitation.status()).toBe(200);
  const context = await browser.newContext();
  const publicPage = await context.newPage();
  await publicPage.goto(`/join#${(await invitation.json()).token}`);
  await fillSubmission(publicPage, suffix);
  await publicPage.route("**/api/onboarding", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({
        title: "Your details could not be saved. Please try again.",
      }),
    }),
  );
  await publicPage.getByRole("button", { name: "Submit details" }).click();
  await expect(
    publicPage
      .getByRole("alert")
      .filter({ hasText: "Your details could not be saved" }),
  ).toBeVisible();
  await expect(
    publicPage.getByRole("heading", { name: "Thank you!" }),
  ).toHaveCount(0);
  await expect(
    publicPage.getByText(`professional-${suffix}@example.test`, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(publicPage.getByRole("checkbox")).toBeChecked();
  await expect(
    publicPage.getByRole("button", { name: "Submit details" }),
  ).toBeEnabled();
  await publicPage.unroute("**/api/onboarding");
  await publicPage.getByRole("button", { name: "Submit details" }).click();
  await checkAcknowledgement(publicPage);
  await publicPage.screenshot({
    path: "test-results/desktop-thank-you.png",
    fullPage: true,
  });
  await context.close();
});

test("sign-in presents a useful error and labels", async ({ page }) => {
  await page.goto("/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("missing@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("incorrect-passphrase");
  await page.getByRole("button", { name: "Sign in to your workspace" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Unable to sign in" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in to your workspace" }),
  ).toBeEnabled();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
