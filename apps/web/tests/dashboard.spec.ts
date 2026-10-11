import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import type { Project, User } from "../src/lib/types";

const headers = {
  Origin: process.env.E2E_BASE_URL || "http://localhost:3000",
  "X-Tenacom-Request": "1",
};
async function login(page: Page) {
  const response = await page.request.post("/api/auth/login", {
    headers,
    data: {
      email: process.env.E2E_ADMIN_EMAIL,
      password: process.env.E2E_ADMIN_PASSWORD,
    },
  });
  expect(response.status()).toBe(200);
}
async function createResource(page: Page, name: string) {
  const response = await page.request.post("/api/users", {
    headers,
    data: {
      email: `${randomBytes(10).toString("hex")}@example.test`,
      name,
      role: "Resource",
    },
  });
  expect(response.status()).toBe(201);
  const { id } = await response.json();
  return (await (await page.request.get(`/api/users/${id}`)).json()) as User;
}
async function createProject(page: Page, name: string, status = "Active") {
  const response = await page.request.post("/api/projects", {
    headers,
    data: {
      code: `UX-${randomBytes(6).toString("hex")}`,
      name,
      description: "Dashboard acceptance test",
      status,
      startDate: "2026-01-01",
      endDate: null,
      version: 0,
    },
  });
  expect(response.status()).toBe(201);
  const { id } = await response.json();
  return (await (
    await page.request.get(`/api/projects/${id}`)
  ).json()) as Project;
}
async function searchNetwork(page: Page, query: string) {
  await page.getByLabel("Search the network").fill(query);
  await page
    .getByRole("form", { name: "Resource filters" })
    .getByRole("button", { name: "Search", exact: true })
    .click();
  await expect(page).toHaveURL((url) => url.searchParams.get("q") === query);
  await expect(
    page.getByRole("status").filter({ hasText: "Loading your workspace" }),
  ).toHaveCount(0);
}
async function chooseProject(page: Page, project: Project) {
  const dialog = page.getByRole("dialog", { name: "Add resources to project" });
  await dialog.getByLabel("Find project", { exact: true }).fill(project.code);
  await dialog
    .getByRole("button", { name: "Find project", exact: true })
    .click();
  await dialog.getByRole("radio", { name: new RegExp(project.name) }).check();
  await dialog.getByLabel("Assignment role").fill("Implementation specialist");
  return dialog;
}

test("resource selection survives searches, toggles, pagination and details; bulk assignment reports and retries partial failures", async ({
  page,
}) => {
  await login(page);
  const suffix = randomBytes(5).toString("hex");
  const resources: User[] = [];
  const termResponse = await page.request.post("/api/terms", {
    headers,
    data: { kind: "Skill", name: `UX skill ${suffix}` },
  });
  expect(termResponse.status()).toBe(200);
  const term = await termResponse.json();
  for (let i = 0; i < 22; i++) {
    const person = await createResource(
      page,
      `UX${suffix} ${String(i).padStart(2, "0")}`,
    );
    resources.push(person);
    const updated = await page.request.put(`/api/resources/${person.id}`, {
      headers,
      data: {
        name: person.name,
        headline: "Systems specialist",
        summary: "Professional experience",
        phone: "",
        location: "Cape Town",
        status: i % 2 ? "Limited" : "Available",
        terms: [{ termId: term.id, proficiency: "Advanced", years: 3 }],
        version: 1,
      },
    });
    expect(updated.status()).toBe(204);
  }
  const project = await createProject(page, `UX project ${suffix}`);
  const archived = await createProject(
    page,
    `UX archived ${suffix}`,
    "Archived",
  );
  expect(
    (
      await page.request.post(`/api/projects/${project.id}/assignments`, {
        headers,
        data: {
          resourceId: resources[0].id,
          roleDescription: "Existing work",
          startDate: "2026-01-01",
          endDate: "2026-01-31",
          version: 0,
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto(`/network?q=UX${suffix}`);
  await page
    .getByRole("checkbox", { name: `Select ${resources[0].name}`, exact: true })
    .check();
  const pager = page.getByRole("navigation", { name: "Resources pagination" });
  await pager.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("checkbox", {
      name: `Select ${resources[21].name}`,
      exact: true,
    })
    .check();
  await expect(
    page.getByText("2 resources selected", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Availability", { exact: true })
    .selectOption("Limited");
  await page.getByText("More filters", { exact: true }).click();
  await page
    .getByRole("button", { name: `Skill · ${term.name}`, exact: true })
    .click();
  await page.getByLabel("Sort by").selectOption("recent");
  await page
    .getByRole("checkbox", { name: "Include deactivated resources" })
    .check();
  await expect(
    page.getByText("2 resources selected", { exact: true }),
  ).toBeVisible();
  const profileLink = page.getByRole("link", {
    name: resources[21].name,
    exact: true,
  });
  await profileLink.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: resources[21].name, exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("main input, main select, main textarea"),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Back to list", exact: false }).click();
  await expect(page.getByLabel("Availability", { exact: true })).toHaveValue(
    "Limited",
  );
  await expect(page.getByLabel("Sort by")).toHaveValue("recent");
  await expect(
    page.getByRole("button", { name: `Skill · ${term.name}`, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByText("2 resources selected", { exact: true }),
  ).toBeVisible();
  await searchNetwork(page, `missing-${suffix}`);
  await expect(
    page.getByText("No resources match these filters.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("2 resources selected", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add selected to Project", exact: true })
    .click();
  const dialog = await chooseProject(page, project);
  await expect(
    dialog.getByRole("radio", { name: new RegExp(archived.name) }),
  ).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await dialog
    .getByRole("button", { name: "Assign 2 resources", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "1 assignments need attention",
  );
  await expect(
    dialog.getByText(/already has an overlapping assignment/),
  ).toBeVisible();
  await expect(
    dialog.getByRole("status").filter({ hasText: "1 of 2 resources assigned" }),
  ).toBeVisible();
  await dialog.getByLabel("Assignment start").fill("2026-02-01");
  await dialog
    .getByRole("button", { name: "Retry unsuccessful assignments" })
    .click();
  await expect(
    dialog.getByRole("status").filter({ hasText: "2 of 2 resources assigned" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByText("0 resources selected", { exact: true }),
  ).toBeVisible();
  const memberships = await (
    await page.request.get(`/api/assignments?projectId=${project.id}`)
  ).json();
  expect(
    memberships.items.filter(
      (x: { resourceId: string }) => x.resourceId === resources[21].id,
    ),
  ).toHaveLength(1);
  expect(
    memberships.items.filter(
      (x: { resourceId: string }) => x.resourceId === resources[0].id,
    ),
  ).toHaveLength(2);
  await page
    .getByRole("form", { name: "Resource filters" })
    .getByRole("button", { name: "Clear filters" })
    .click();
  await expect(page).toHaveURL(/\/network$/);
  await expect(page.getByLabel("Availability", { exact: true })).toHaveValue(
    "",
  );
});

test("read-only details require explicit edits; row actions do not navigate; removal preserves history", async ({
  page,
}) => {
  await login(page);
  const name = `Detail ${randomBytes(5).toString("hex")}`;
  const resource = await createResource(page, name);
  const project = await createProject(page, `${name} project`);
  await page.goto(`/network?q=${encodeURIComponent(name)}`);
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name, exact: true }) });
  await row
    .getByRole("checkbox", { name: `Select ${name}`, exact: true })
    .check();
  await expect(page).toHaveURL(/\/network\?/);
  await row
    .getByRole("button", { name: `Actions for ${name}`, exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Edit", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    row.getByRole("button", { name: `Actions for ${name}`, exact: true }),
  ).toBeFocused();
  await row
    .getByRole("cell", { name: "Location not added", exact: false })
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(
    page.locator("main input, main select, main textarea"),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: `Actions for ${name}`, exact: true })
    .click();
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page).toHaveURL(/\/edit\?/);
  await page
    .getByLabel("Professional headline")
    .fill("Updated professional role");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page).not.toHaveURL(/\/edit/);
  await expect(
    page.getByRole("heading", { name: "Updated professional role" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Actions for ${name}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add to Project", exact: true })
    .click();
  const dialog = await chooseProject(page, project);
  await dialog
    .getByRole("button", { name: "Assign 1 resource", exact: true })
    .click();
  await expect(
    dialog.getByRole("status").filter({ hasText: "1 of 1 resources assigned" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  const history = page.getByRole("region", { name: "Resource projects" });
  await expect(
    history.getByRole("link", { name: project.name, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Actions for ${name}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  expect(
    (await (await page.request.get(`/api/users/${resource.id}`)).json()).active,
  ).toBe(true);
  await page
    .getByRole("button", { name: `Actions for ${name}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Deactivate person", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "History has been retained" }),
  ).toBeVisible();
  await expect(
    history.getByRole("link", { name: project.name, exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Deactivated", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: `Actions for ${name}`, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add to Project", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Remove", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "test-results/dashboard-resource-mobile.png",
    fullPage: true,
  });
});

test("people tables use independent filters and staff details have an explicit editor", async ({
  page,
}) => {
  await login(page);
  const suffix = randomBytes(5).toString("hex");
  const staffName = `Staff ${suffix}`;
  const resourceName = `Person ${suffix}`;
  const staffResponse = await page.request.post("/api/users", {
    headers,
    data: {
      name: staffName,
      email: `staff-${suffix}@example.test`,
      role: "Manager",
      password: randomBytes(20).toString("hex"),
    },
  });
  expect(staffResponse.status()).toBe(201);
  await createResource(page, resourceName);
  await page.goto(`/users?staff_q=${suffix}&resources_q=${suffix}`);
  const staff = page.getByRole("region", {
    name: "Staff accounts",
    exact: true,
  });
  const resources = page.getByRole("region", {
    name: "Resources",
    exact: true,
  });
  await expect(
    staff.getByRole("link", { name: staffName, exact: true }),
  ).toBeVisible();
  await expect(
    staff.getByRole("link", { name: resourceName, exact: true }),
  ).toHaveCount(0);
  await expect(
    resources.getByRole("link", { name: resourceName, exact: true }),
  ).toBeVisible();
  await expect(
    resources.getByRole("link", { name: staffName, exact: true }),
  ).toHaveCount(0);
  await staff.getByLabel("Sort staff").selectOption("email");
  await resources.getByLabel("Resources status").selectOption("active");
  const href = await staff
    .getByRole("link", { name: staffName, exact: true })
    .getAttribute("href");
  await staff.getByRole("link", { name: staffName, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: staffName, exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("main input, main select, main textarea"),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: `Actions for ${staffName}`, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add to Project", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByLabel("Full name").fill(`${staffName} edited`);
  await page.getByRole("button", { name: "Save person", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: `${staffName} edited`, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "← People & access", exact: true })
    .click();
  await expect(staff.getByLabel("Sort staff")).toHaveValue("email");
  await expect(resources.getByLabel("Resources status")).toHaveValue("active");
  expect(href).toContain("/users/");
  await resources
    .getByRole("link", { name: resourceName, exact: true })
    .click();
  await expect(page).toHaveURL(/\/network\//);
  await page.getByRole("link", { name: "Back to list", exact: false }).click();
  await expect(page).toHaveURL(/\/users\?/);
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.screenshot({
    path: "test-results/dashboard-people-desktop.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("unfiltered assignment remains available and selection survives recoverable list/project failures", async ({
  page,
}) => {
  await login(page);
  const name = `Unfiltered ${randomBytes(5).toString("hex")}`;
  const resource = await createResource(page, name);
  const project = await createProject(page, `${name} project`);
  await page.goto(`/network?q=${encodeURIComponent(name)}`);
  await page
    .getByRole("checkbox", {
      name: "Select active resources on this page",
      exact: true,
    })
    .check();
  await expect(
    page.getByRole("checkbox", { name: `Select ${name}`, exact: true }),
  ).toBeChecked();
  await page
    .getByRole("form", { name: "Resource filters" })
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page).toHaveURL(/\/network$/);
  await expect(
    page.getByText("1 resource selected", { exact: true }),
  ).toBeVisible();
  await page.route("**/api/resources?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({ title: "Resource search unavailable." }),
    }),
  );
  await searchNetwork(page, name);
  await expect(
    page.getByRole("alert").filter({ hasText: "Resource search unavailable." }),
  ).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(0);
  await expect(
    page.getByText("1 resource selected", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/resources?**");
  await page
    .getByRole("button", { name: "Reload resources", exact: true })
    .click();
  await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  await page
    .getByRole("form", { name: "Resource filters" })
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.route("**/api/projects?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({ title: "Eligible projects unavailable." }),
    }),
  );
  await page
    .getByRole("button", { name: "Add selected to Project", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Add resources to project" });
  await expect(dialog.getByRole("alert")).toContainText(
    "Eligible projects unavailable.",
  );
  await expect(
    dialog.getByRole("button", { name: "Assign 1 resource", exact: true }),
  ).toBeDisabled();
  await page.unroute("**/api/projects?**");
  await dialog
    .getByRole("button", { name: "Reload projects", exact: true })
    .click();
  await chooseProject(page, project);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/dashboard-assignment-mobile.png",
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "Assign 1 resource", exact: true })
    .click();
  await expect(
    dialog.getByRole("status").filter({ hasText: "1 of 1 resources assigned" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  expect(
    (
      await (
        await page.request.get(
          `/api/assignments?projectId=${project.id}&resourceId=${resource.id}`,
        )
      ).json()
    ).total,
  ).toBe(1);
  await expect(
    page.getByText("0 resources selected", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .isDisabled();
});

test("shared destructive dialogs cancel, recover from errors, and confirm time removal and invitation revocation", async ({
  page,
}) => {
  await login(page);
  const name = `Confirmation ${randomBytes(5).toString("hex")}`;
  const resource = await createResource(page, name);
  const project = await createProject(page, `${name} project`);
  const assigned = await page.request.post(
    `/api/projects/${project.id}/assignments`,
    {
      headers,
      data: {
        resourceId: resource.id,
        roleDescription: "Testing",
        startDate: "2026-01-01",
        endDate: null,
        version: 0,
      },
    },
  );
  expect(assigned.status()).toBe(200);
  const assignmentId = (await assigned.json()).id;
  const time = await page.request.post("/api/time-entries", {
    headers,
    data: {
      assignmentId,
      workDate: "2026-01-02",
      minutes: 45,
      notes: "Confirmation workflow",
      version: 0,
    },
  });
  expect(time.status()).toBe(200);
  const timeId = (await time.json()).id;
  await page.goto("/hours");
  const section = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Time entries", exact: true }),
  });
  const row = section.getByRole("row").filter({ hasText: name });
  await row.getByRole("button", { name: "Remove", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Remove time entry?" })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(row).toBeVisible();
  await page.route(`**/api/time-entries/${timeId}?*`, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({ title: "Time correction unavailable." }),
    }),
  );
  await row.getByRole("button", { name: "Remove", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Remove time entry?" });
  await dialog
    .getByRole("button", { name: "Remove entry", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Time correction unavailable.",
  );
  await page.unroute(`**/api/time-entries/${timeId}?*`);
  await dialog
    .getByRole("button", { name: "Remove entry", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toHaveCount(0);
  expect(
    (
      await (
        await page.request.get(`/api/time-entries?resourceId=${resource.id}`)
      ).json()
    ).total,
  ).toBe(0);
  const invitation = await page.request.post("/api/invitations", {
    headers,
    data: { label: name, days: 1, maxUses: 1 },
  });
  expect(invitation.status()).toBe(200);
  await page.goto("/invitations");
  const invitationRow = page.getByRole("row").filter({ hasText: name });
  await invitationRow
    .getByRole("button", { name: "Revoke", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Revoke invitation?" })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(invitationRow).toContainText("Active");
  await invitationRow
    .getByRole("button", { name: "Revoke", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Revoke invitation?" })
    .getByRole("button", { name: "Revoke invitation", exact: true })
    .click();
  await expect(invitationRow).toContainText("Revoked");
});

test("valid assignment forms paginate and search with Enter without submitting; project details recover", async ({
  page,
}) => {
  await login(page);
  const suffix = randomBytes(5).toString("hex");
  const name = `Chooser ${suffix}`;
  const resource = await createResource(page, name);
  const projects: Project[] = [];
  for (let i = 0; i < 21; i++) {
    projects.push(
      await createProject(page, `${name} ${String(i).padStart(2, "0")}`),
    );
  }
  let writes = 0;
  await page.route("**/api/projects/*/assignments", async (route) => {
    if (route.request().method() === "POST") writes++;
    await route.continue();
  });
  await page.goto(`/network?q=${encodeURIComponent(name)}`);
  await page
    .getByRole("checkbox", { name: `Select ${name}`, exact: true })
    .check();
  await page
    .getByRole("button", { name: "Add selected to Project", exact: true })
    .click();
  const dialog = await chooseProject(page, projects[0]);
  await dialog.getByLabel("Find project", { exact: true }).fill(name);
  await dialog.getByLabel("Find project", { exact: true }).press("Enter");
  const projectsPager = dialog.getByRole("navigation", {
    name: "Eligible projects pagination",
  });
  await expect(projectsPager).toContainText("21 results · Page 1 of 2");
  await expect(
    projectsPager.getByRole("button", { name: "Next", exact: true }),
  ).toHaveAttribute("type", "button");
  await projectsPager
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(projectsPager).toContainText("Page 2 of 2");
  await projectsPager
    .getByRole("button", { name: "Previous", exact: true })
    .click();
  await expect(projectsPager).toContainText("Page 1 of 2");
  await dialog
    .getByLabel("Find project", { exact: true })
    .fill(`no-match-${suffix}`);
  await dialog.getByLabel("Find project", { exact: true }).press("Enter");
  await expect(projectsPager).toContainText("0 results · Page 1 of 1");
  await expect(
    dialog.getByText(`Selected project: ${projects[0].name}`, { exact: true }),
  ).toBeVisible();
  expect(writes).toBe(0);
  await dialog
    .getByRole("button", { name: "Assign 1 resource", exact: true })
    .click();
  await expect(
    dialog.getByRole("status").filter({ hasText: "1 of 1 resources assigned" }),
  ).toBeVisible();
  expect(writes).toBe(1);
  await dialog.getByRole("button", { name: "Done", exact: true }).click();

  const project = projects[1];
  await page.route(`**/api/projects/${project.id}`, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({ title: "Project details unavailable." }),
    }),
  );
  const back = `/projects?q=${encodeURIComponent(name)}`;
  await page.goto(`/projects/${project.id}?from=${encodeURIComponent(back)}`);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Project details unavailable.",
  );
  await expect(
    page.getByRole("link", { name: "← Projects", exact: true }),
  ).toHaveAttribute("href", back);
  await page.unroute(`**/api/projects/${project.id}`);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: project.name, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Assign resource", exact: false })
    .click();
  const form = page.locator("form").filter({
    has: page.getByRole("heading", {
      name: "Connect a resource to this project",
      exact: true,
    }),
  });
  await form.getByLabel("Find resource", { exact: true }).fill(name);
  await form.getByLabel("Find resource", { exact: true }).press("Enter");
  await expect(
    form
      .getByLabel("Resource", { exact: true })
      .getByRole("option", { name, exact: true }),
  ).toHaveCount(1);
  await form.getByLabel("Resource", { exact: true }).selectOption(resource.id);
  await form.getByLabel("Assignment role").fill("Keyboard workflow");
  await form.getByLabel("Find resource", { exact: true }).fill("");
  await form.getByLabel("Find resource", { exact: true }).press("Enter");
  const resourcesPager = form.getByRole("navigation", {
    name: "Resource choices pagination",
  });
  await expect(
    resourcesPager.getByRole("button", { name: "Next", exact: true }),
  ).toBeEnabled();
  await resourcesPager
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(resourcesPager).toContainText("Page 2 of");
  await expect(
    resourcesPager.getByRole("button", { name: "Previous", exact: true }),
  ).toHaveAttribute("type", "button");
  await form
    .getByLabel("Find resource", { exact: true })
    .fill(`no-match-${suffix}`);
  await form.getByLabel("Find resource", { exact: true }).press("Enter");
  await expect(resourcesPager).toContainText("0 results · Page 1 of 1");
  await expect(form.getByLabel("Resource", { exact: true })).toHaveValue(
    resource.id,
  );
  expect(writes).toBe(1);
  await form
    .getByRole("button", { name: "Save assignment", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Keyboard workflow", exact: true }),
  ).toBeVisible();
  expect(writes).toBe(2);
});

test("resource editor focuses one section and protects unsaved drafts when switching or cancelling", async ({
  page,
}) => {
  await login(page);
  const suffix = randomBytes(5).toString("hex");
  const person = await createResource(page, `Draft ${suffix}`);
  await page.goto(`/network/${person.id}/edit`);
  await page.getByLabel("Professional headline").fill("Unsaved draft");
  const sections = page.getByRole("navigation", { name: "Edit section" });
  await sections
    .getByRole("button", { name: "Contact & account", exact: true })
    .click();
  const discard = page.getByRole("dialog", {
    name: "Discard unsaved changes?",
  });
  await discard.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Professional headline")).toHaveValue(
    "Unsaved draft",
  );
  await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
  await sections
    .getByRole("button", { name: "Contact & account", exact: true })
    .click();
  await discard
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(page.getByLabel("Professional headline")).toHaveCount(0);
  const email = `draft-${suffix}@example.test`;
  await page.getByLabel("Email", { exact: true }).fill(email);
  await sections
    .getByRole("button", { name: "Profile review", exact: true })
    .click();
  await discard.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
  await page.getByRole("link", { name: "Cancel editing", exact: true }).click();
  await discard.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
  expect(
    (await (await page.request.get(`/api/users/${person.id}`)).json()).email,
  ).toBe(person.email);
  expect(
    (await (await page.request.get(`/api/resources/${person.id}`)).json())
      .headline,
  ).not.toBe("Unsaved draft");
  await page.getByRole("button", { name: "Save person", exact: true }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Contact and account settings saved." }),
  ).toBeVisible();
  expect(
    (await (await page.request.get(`/api/users/${person.id}`)).json()).email,
  ).toBe(email);
  await page.goto(`/network/${person.id}/edit`);
  await expect(page.getByLabel("Professional headline")).not.toHaveValue(
    "Unsaved draft",
  );
  await sections
    .getByRole("button", { name: "Profile review", exact: true })
    .click();
  await page.getByLabel("Feedback").fill("Reviewed draft protection");
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Review saved\.$/ }),
  ).toBeVisible();
});

test("editor deactivation and project archiving share cancellable confirmation and success feedback", async ({
  page,
}) => {
  await login(page);
  const name = `Editor confirmation ${randomBytes(5).toString("hex")}`;
  const person = await createResource(page, name);
  await page.goto(`/network/${person.id}/edit`);
  await page
    .getByRole("navigation", { name: "Edit section" })
    .getByRole("button", { name: "Contact & account", exact: true })
    .click();
  await page.getByLabel("Active", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Save person", exact: true }).click();
  const deactivate = page.getByRole("dialog", { name: "Deactivate person?" });
  await deactivate.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    (await (await page.request.get(`/api/users/${person.id}`)).json()).active,
  ).toBe(true);
  await page.getByRole("button", { name: "Save person", exact: true }).click();
  await deactivate
    .getByRole("button", { name: "Deactivate person", exact: true })
    .click();
  await expect(page.getByText("Deactivated", { exact: true })).toBeVisible();

  const project = await createProject(page, `${name} project`);
  await page.goto(`/projects/${project.id}`);
  await page
    .getByRole("button", { name: `Actions for ${project.name}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Status", { exact: true }).selectOption("Archived");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const archive = page.getByRole("dialog", { name: "Archive project?" });
  await archive.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    (await (await page.request.get(`/api/projects/${project.id}`)).json())
      .status,
  ).toBe("Active");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await archive
    .getByRole("button", { name: "Archive project", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Project saved\.$/ }),
  ).toBeVisible();
  await expect(page.getByText("Archived", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Assign resource", exact: false }),
  ).toHaveCount(0);
});
