import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";

test("Manager manages password-free Resources and records hours without Admin privileges", async ({
  page,
  request,
}) => {
  const suffix = randomBytes(5).toString("hex");
  const password = randomBytes(20).toString("hex");
  const headers = {
    Origin: process.env.E2E_BASE_URL || "http://localhost:3000",
    "X-Tenacom-Request": "1",
  };
  const login = await request.post("/api/auth/login", {
    headers,
    data: {
      email: process.env.E2E_ADMIN_EMAIL,
      password: process.env.E2E_ADMIN_PASSWORD,
    },
  });
  expect(login.status()).toBe(200);
  const managerEmail = `manager-${suffix}@example.test`;
  expect(
    (
      await request.post("/api/users", {
        headers,
        data: {
          email: managerEmail,
          name: `Manager ${suffix}`,
          role: "Manager",
          password,
        },
      })
    ).status(),
  ).toBe(201);
  const projectResponse = await request.post("/api/projects", {
    headers,
    data: {
      code: `MAN-${suffix}`,
      name: `Manager project ${suffix}`,
      description: "",
      status: "Active",
      startDate: "2026-01-01",
      endDate: null,
      version: 0,
    },
  });
  expect(projectResponse.status()).toBe(201);
  const project = await projectResponse.json();
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(managerEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to your workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Resource network", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add selected to Project" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("checkbox", {
      name: "Select active resources on this page",
    }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "People & access", exact: true })
    .click();
  await page.getByRole("button", { name: "Create person" }).click();
  await expect(
    page.getByLabel("Role", { exact: true }).locator("option"),
  ).toHaveText(["Resource"]);
  await page
    .getByLabel("Full name", { exact: true })
    .fill(`Managed resource ${suffix}`);
  await page
    .getByLabel("Email", { exact: true })
    .fill(`managed-${suffix}@example.test`);
  await expect(page.getByLabel("Initial password")).toHaveCount(0);
  await page.getByRole("button", { name: "Save person" }).click();
  await page
    .getByRole("form", { name: "Resources filters" })
    .getByLabel("Find resource")
    .fill(suffix);
  await page
    .getByRole("form", { name: "Resources filters" })
    .getByRole("button", { name: "Search", exact: true })
    .click();
  const row = page
    .getByRole("row")
    .filter({ hasText: `Managed resource ${suffix}` });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Profile only");
  const people = await page.request.get(`/api/resources?q=${suffix}`);
  const resource = (await people.json()).items[0];
  await row
    .getByRole("link", { name: `Managed resource ${suffix}`, exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Resource projects" }),
  ).toContainText("An administrator can add this resource to a project.");
  await page.getByRole("link", { name: "Back to list", exact: false }).click();
  const assignment = await request.post(
    `/api/projects/${project.id}/assignments`,
    {
      headers,
      data: {
        resourceId: resource.id,
        roleDescription: "Manager recorded work",
        startDate: "2026-01-01",
        endDate: null,
        version: 0,
      },
    },
  );
  expect(assignment.status()).toBe(200);
  await row
    .getByRole("button", {
      name: `Actions for Managed resource ${suffix}`,
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Deactivate person", exact: true })
    .click();
  await expect(row).toContainText("Deactivated");
  expect(
    (
      await page.request.post("/api/users", {
        headers,
        data: {
          email: `forbidden-${suffix}@example.test`,
          name: "Forbidden admin",
          role: "Admin",
          password,
        },
      })
    ).status(),
  ).toBe(403);
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create project" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Tracked hours", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hours by resource & project" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Record time" }).click();
  const form = page.getByRole("form", { name: "Record resource hours" });
  await form.getByLabel("Find resource", { exact: true }).fill(suffix);
  await form
    .getByRole("button", { name: "Find resource", exact: true })
    .click();
  await expect(
    form
      .getByLabel("Resource", { exact: true })
      .getByRole("option", { name: new RegExp(suffix) }),
  ).toHaveCount(1);
  await form.getByLabel("Resource", { exact: true }).selectOption(resource.id);
  await expect(
    form
      .getByLabel("Project assignment")
      .getByRole("option", { name: new RegExp(suffix) }),
  ).toHaveCount(1);
  await form
    .getByLabel("Project assignment")
    .selectOption((await assignment.json()).id);
  await form.getByLabel("Work date").fill("2026-01-02");
  await form.getByLabel("Time worked (minutes)").fill("60");
  await form.getByRole("button", { name: "Save time" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Time saved" }),
  ).toBeVisible();
  const entries = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Time entries", exact: true }),
  });
  await expect(
    entries.getByRole("row").filter({ hasText: `Managed resource ${suffix}` }),
  ).toContainText(`Manager ${suffix}`);
});

test("Network renders recoverable server errors without stale people", async ({
  page,
}) => {
  const headers = {
    Origin: process.env.E2E_BASE_URL || "http://localhost:3000",
    "X-Tenacom-Request": "1",
  };
  expect(
    (
      await page.request.post("/api/auth/login", {
        headers,
        data: {
          email: process.env.E2E_ADMIN_EMAIL,
          password: process.env.E2E_ADMIN_PASSWORD,
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.route("**/api/resources?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({
        title: "The network is temporarily unavailable.",
      }),
    }),
  );
  await page.goto("/network");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "The network is temporarily unavailable." }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.unroute("**/api/resources?**");
  await page
    .getByLabel("Search the network")
    .fill("no-match-" + randomBytes(10).toString("hex"));
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByText("No resources match these filters.", { exact: false }),
  ).toBeVisible();
});
