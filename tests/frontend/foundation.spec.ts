import { test, expect } from "@playwright/test";
for (const [product, base] of [
  ["RAES", "http://localhost:3200"],
  ["Credenly", "http://localhost:3203"],
]) {
  test(`${product}: galería, estados, etiquetas y ancho fluido`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.name));
    await page.goto(`${base}/design-system`);
    await expect(
      page.getByRole("heading", { name: "Una identidad, dos experiencias" }),
    ).toBeVisible();
    await expect(
      page.getByText("Revocada", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Anulada", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByRole("article")).toContainText(
      "Institución de demostración",
    );
    await expect(page.getByLabel("Campo con error")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(
      page.getByRole("button", { name: "No disponible" }),
    ).toBeDisabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator("input")
        .evaluateAll((inputs) =>
          inputs.every((i) => (i as HTMLInputElement).labels?.length),
        ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/${product}-${page.viewportSize()!.width}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}
test("login: teclado, foco visible, labels y ausencia de storage de sesión", async ({
  page,
}) => {
  await page.goto("http://localhost:3200/login");
  const email = page.getByLabel("Correo institucional");
  await expect(email).toBeVisible();
  await email.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Contraseña", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  const submit = page.getByRole("button", {
    name: "Iniciar sesión",
    exact: true,
  });
  await expect(submit).toBeFocused();
  expect(
    await submit.evaluate((e) => getComputedStyle(e).outlineStyle),
  ).not.toBe("none");
  expect(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
  ).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
