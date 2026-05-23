import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { SignJWT } from "jose";

/**
 * Archilya Render E2E Test Skeleton
 *
 * Auth pattern: bypasses Firebase client auth by directly setting the signed
 * `archilya_panel_session` httpOnly cookie using the project's PANEL_SESSION_SECRET.
 * This matches the server-side session verification used by the dashboard layout.
 *
 * Environment requirement:
 *   PANEL_SESSION_SECRET – must match the value in .env.local
 *
 * data-testid attributes used / suggested:
 *   - Existing: scene-card-<dynamicId> (SceneUploader)
 *   - Suggested additions (documented here, NOT added to components):
 *     * scene-uploader-input
 *     * material-uploader-input
 *     * constraint-list-item
 *     * depth-map-generate-button
 *     * metric-lock-button
 *     * pipeline-start-council-button
 *     * quality-gate-approve-button
 *     * final-output-save-button
 */

const BASE_URL = "http://127.0.0.1:3000";
const SESSION_COOKIE_NAME = "archilya_panel_session";
const PANEL_SESSION_TYPE = "archilya-panel-session";
const PANEL_SESSION_ISSUER = "archilya-panel";
const PANEL_SESSION_AUDIENCE = "archilya-panel-user";

// A tiny 1×1 red PNG usable as a data-URL image seed
const MOCK_IMAGE_BASE64 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/* ------------------------------------------------------------------ */
/*  Auth helper                                                        */
/* ------------------------------------------------------------------ */

async function createSessionCookie(secret: string) {
  const secretKey = new TextEncoder().encode(secret);
  return new SignJWT({
    type: PANEL_SESSION_TYPE,
    uid: "e2e-test-user",
    email: "e2e@archilya.test",
    name: "E2E Test User",
    picture: null,
    emailVerified: true,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(PANEL_SESSION_ISSUER)
    .setAudience(PANEL_SESSION_AUDIENCE)
    .setExpirationTime("2h")
    .sign(secretKey);
}

async function authenticate(context: BrowserContext) {
  const secret = process.env.PANEL_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "PANEL_SESSION_SECRET env var is required. Add it to .env.local or export it before running E2E tests.",
    );
  }
  const value = await createSessionCookie(secret);
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      secure: false, // dev server is HTTP
      sameSite: "Lax",
    },
  ]);
}

/* ------------------------------------------------------------------ */
/*  API mocking helpers                                               */
/* ------------------------------------------------------------------ */

function mockAIPipeline(page: Page) {
  const functionsBase = "https://europe-west1-nng-toma.cloudfunctions.net";

  page.route(`${functionsBase}/startRenderPipeline`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { jobId: `job-${Date.now()}`, status: "queued" } }),
    });
  });

  page.route(`${functionsBase}/estimateDepth`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { jobId: `depth-${Date.now()}`, status: "queued" } }),
    });
  });

  page.route(`${functionsBase}/compareScenes`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { jobId: `compare-${Date.now()}`, status: "queued", sceneCount: 1 },
      }),
    });
  });

  // Called by useCredits when the user profile doc is missing
  page.route(`${functionsBase}/ensureUserProfile`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {} }),
    });
  });
}

/* ------------------------------------------------------------------ */
/*  localStorage seeding helpers                                       */
/* ------------------------------------------------------------------ */

async function seedIntakeDraft(page: Page) {
  await page.evaluate((image) => {
    const draft = {
      scenes: [
        {
          id: "e2e-scene-1",
          label: "Salon",
          direction: "north",
          type: "interior",
          thumbnailUrl: image,
          hasFurnishing: true,
          frameQuality: 85,
          order: 0,
          createdAt: Date.now(),
        },
      ],
      materials: [
        {
          id: "e2e-material-1",
          label: "Parke",
          category: "floor",
          order: 0,
          createdAt: Date.now(),
        },
      ],
      moodboards: [],
      clientReferences: [],
      lightPreference: "sunny",
    };
    window.localStorage.setItem("archilya-render-intake-draft", JSON.stringify(draft));
  }, MOCK_IMAGE_BASE64);
}

async function seedSpatialDraft(page: Page) {
  await page.evaluate((image) => {
    const draft = {
      depthMaps: {
        "e2e-scene-1": {
          sceneId: "e2e-scene-1",
          imageUrl: image,
          depthDataUrl: image,
          generatedAt: Date.now(),
        },
      },
      metricLocks: {
        "e2e-scene-1": {
          sceneId: "e2e-scene-1",
          aspectRatio: 1.5,
          estimatedDepth: 80,
          volumeScore: 82,
          isLocked: false,
        },
      },
      consistencyResult: {
        consistencyScore: 100,
        pairScores: [],
      },
    };
    window.localStorage.setItem("archilya-render-spatial-draft", JSON.stringify(draft));
  }, MOCK_IMAGE_BASE64);
}

async function seedPipelineDraft(page: Page) {
  await page.evaluate((image) => {
    const draft = {
      jobState: {
        jobId: "e2e-job-1",
        sessionId: "e2e-session-1",
        stages: [
          { id: 1, name: "Sahne Analizi", description: "", status: "APPROVED" },
          { id: 2, name: "Malzeme Eşleme", description: "", status: "APPROVED" },
          { id: 3, name: "Render Pass", description: "", status: "APPROVED" },
          { id: 4, name: "Kalite Kapısı", description: "", status: "ACTIVE" },
        ],
        agents: [],
        currentStageId: 4,
        overallProgress: 75,
        startedAt: Date.now(),
      },
      awaitingApproval: true,
      approvalStageId: 4,
      activeJobId: "e2e-job-1",
      outputImageUrl: image,
    };
    window.localStorage.setItem("archilya-render-pipeline-draft", JSON.stringify(draft));
  }, MOCK_IMAGE_BASE64);
}

async function clearRenderDrafts(page: Page) {
  await page.evaluate(() => {
    window.localStorage.removeItem("archilya-render-intake-draft");
    window.localStorage.removeItem("archilya-render-spatial-draft");
    window.localStorage.removeItem("archilya-render-pipeline-draft");
    window.localStorage.removeItem("archilya-render-saved-outputs");
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

test.describe("Archilya Render", () => {
  test.beforeEach(async ({ context, page }) => {
    test.skip(
      !process.env.PANEL_SESSION_SECRET,
      "PANEL_SESSION_SECRET env var is required for E2E auth",
    );
    await authenticate(context);
    await mockAIPipeline(page);
    await clearRenderDrafts(page);
  });

  test("page loads with correct title and intake stage", async ({ page }) => {
    await page.goto("/archilya-render");

    // Main heading is rendered
    await expect(page.locator("h1")).toBeVisible();

    // Intake stage should show the scene upload zone and material section
    await expect(page.locator('input[type="file"]').first()).toBeVisible();
    await expect(page.locator("section").filter({ has: page.locator("select") }).first()).toBeVisible();
  });

  test("can add a scene with image upload", async ({ page }) => {
    await page.goto("/archilya-render");

    const buffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );

    // SceneUploader exposes a hidden file input (data-testid: scene-uploader-input suggested)
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: "mock-scene.png",
      mimeType: "image/png",
      buffer,
    });

    // Scene card should appear (draggable grid item with image alt derived from file name)
    await expect(page.locator('img[alt="mock-scene"]')).toBeVisible();
  });

  test("can add a material", async ({ page }) => {
    await page.goto("/archilya-render");

    const buffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );

    // MaterialPalette exposes a hidden file input (data-testid: material-uploader-input suggested)
    const fileInputs = page.locator('input[type="file"]');
    // Second file input belongs to MaterialPalette
    await fileInputs.nth(1).setInputFiles({
      name: "mock-material.png",
      mimeType: "image/png",
      buffer,
    });

    // Material label input defaults to file name without extension
    await expect(page.locator('input[value="mock-material"]')).toBeVisible();
  });

  test("can submit intake and reach markup stage", async ({ page }) => {
    await seedIntakeDraft(page);
    await page.goto("/archilya-render");

    // Submit to auditor – button text falls back to the translation key when missing
    const submitButton = page.getByRole("button", { name: /submitToAuditor|Denetleniyor/i });
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // Audit runs locally (~1.25 s); wait for the proceed button
    const proceedButton = page.getByRole("button", { name: "Markup'a Geç" });
    await expect(proceedButton).toBeVisible({ timeout: 5000 });
    await proceedButton.click();

    await expect(page).toHaveURL(/stage=markup/);
    await expect(page.getByRole("heading", { name: /Kritik Okuyucu/i })).toBeVisible();
  });

  test("can add annotation on markup canvas", async ({ page }) => {
    await seedIntakeDraft(page);
    await page.goto("/archilya-render?stage=markup");

    // Wait for Fabric canvas to mount
    const canvas = page.locator("canvas").first();
    await canvas.waitFor();

    // Select circle tool (accessible name from title attribute)
    await page.getByRole("button", { name: /Daire/i }).click();

    // Draw a circle by clicking and dragging on the canvas
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas bounding box not found");

    await page.mouse.move(box.x + 50, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x + 150, box.y + 150);
    await page.mouse.up();

    // Constraint list should render a textarea for the new annotation
    await expect(
      page.locator("textarea").filter({ hasText: /^$/ }).first(),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder(/Açıklama ekleyin/i),
    ).toBeVisible();
  });

  test("can proceed through spatial stage", async ({ page }) => {
    await seedIntakeDraft(page);
    await seedSpatialDraft(page);
    await page.goto("/archilya-render?stage=spatial");

    await expect(page.getByRole("heading", { name: /Kütle Kilitleme/i })).toBeVisible();

    const lockButton = page.getByRole("button", { name: /Kütleyi Kilitle/i });
    const sendButton = page.getByRole("button", { name: /Konsey'e Gönder/i });

    await expect(lockButton).toBeEnabled();
    await expect(sendButton).toBeDisabled();

    await lockButton.click();
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    await expect(page).toHaveURL(/stage=pipeline/);
  });

  test("pipeline approval flow works", async ({ page }) => {
    await seedIntakeDraft(page);
    await seedSpatialDraft(page);
    await seedPipelineDraft(page);
    await page.goto("/archilya-render?stage=pipeline");

    // Quality Gate is visible because the seeded draft is awaiting approval at stage 4
    const approveButton = page.getByRole("button", { name: /Onayla ve Devam Et/i });
    await expect(approveButton).toBeVisible();
    await approveButton.click();

    // After final approval the completed output viewer should appear
    await expect(page.getByRole("heading", { name: /Çıktı/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Projeye Kaydet/i })).toBeVisible();
  });

  test("error states display correctly", async ({ page }) => {
    await page.goto("/archilya-render");

    // 1. Submit empty intake → audit should report critical errors and block proceeding
    const submitButton = page.getByRole("button", { name: /submitToAuditor|Denetleniyor/i });
    await submitButton.click();

    // Wait for the local audit to finish
    await expect(page.getByText(/critical/i)).toBeVisible({ timeout: 5000 });
    const proceedButton = page.getByRole("button", { name: "Markup'a Geç" });
    await expect(proceedButton).toBeDisabled();

    // 2. Upload an invalid file type to the scene uploader
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: "invalid.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an image"),
    });

    // No draggable scene card should have been added
    await expect(page.locator("[draggable='true']")).toHaveCount(0);
  });
});
