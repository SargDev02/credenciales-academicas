import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup as render } from "react-dom/server";
import {
  Badge,
  Button,
  CredentialCard,
  Input,
  Alert,
  EmptyState,
  Skeleton,
  MetricCard,
} from "../src/index";

test("metric card keeps a real zero visible with a labeled detail action", () => {
  const html = render(
    <MetricCard
      title="Indicador operativo"
      value={0}
      action={<a href="/detail">Ver detalle</a>}
    >
      <p>Sin registros en esta consulta</p>
    </MetricCard>,
  );
  assert.match(html, /<h2[^>]*>Indicador operativo<\/h2>/);
  assert.match(html, /class="ui-metric-value">0<\/p>/);
  assert.match(html, /href="\/detail"/);
  assert.ok(!html.includes("%"));
});

test("buttons have native semantics and pending disables duplicate submission", () => {
  const html = render(
    <Button type="submit" busy>
      Continuar
    </Button>,
  );
  assert.match(html, /type="submit"/);
  assert.match(html, /disabled=""/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /role="status"/);
});
test("input connects its real label, hint and validation error", () => {
  const html = render(
    <Input
      id="email"
      name="email"
      label="Correo"
      hint="Correo de acceso"
      error="Revisa el correo"
    />,
  );
  assert.match(html, /for="email"/);
  assert.match(html, /aria-describedby="email-hint email-error"/);
  assert.match(html, /aria-invalid="true"/);
});
for (const [label, tone] of [
  ["Vigente", "success"],
  ["Revocada", "danger"],
  ["Anulada", "warning"],
] as const)
  test(`credential state ${label} remains visible as text`, () => {
    const html = render(
      <CredentialCard
        category="Certificado"
        title="Ejemplo"
        institution="Institución demo"
        status={<Badge tone={tone}>{label}</Badge>}
      />,
    );
    assert.match(html, new RegExp(label));
    assert.match(html, /<article/);
    assert.match(html, /<h3>Ejemplo/);
  });
test("errors, empty and loading states provide meaningful accessible content", () => {
  assert.match(
    render(
      <Alert title="Error" tone="danger">
        Intenta de nuevo
      </Alert>,
    ),
    /role="alert"/,
  );
  assert.match(render(<Skeleton />), /Cargando contenido/);
  assert.match(
    render(<EmptyState title="Sin resultados">Cambia la búsqueda</EmptyState>),
    /Cambia la búsqueda/,
  );
});

test("text tokens meet AA contrast on their actual surfaces", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(
    new URL("../src/styles.css", import.meta.url),
    "utf8",
  );
  function color(name: string) {
    const hex = css.match(
      new RegExp(`--color-${name}:\\s*(#[0-9a-f]{3}(?:[0-9a-f]{3})?)`, "i"),
    )?.[1];
    assert.ok(hex, `Missing token ${name}`);
    const full =
      hex.length === 4
        ? "#" + [...hex.slice(1)].map((c) => c + c).join("")
        : hex;
    const rgb = [1, 3, 5]
      .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
  }
  for (const [a, b] of [
    ["brand-600", "surface"],
    ["text-primary", "surface"],
    ["text-muted", "surface"],
    ["success-text", "success-soft"],
    ["danger", "danger-soft"],
    ["warning-text", "warning-soft"],
  ]) {
    const x = color(a!);
    const y = color(b!);
    assert.ok(
      (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) >= 4.5,
      `${a} / ${b} fails AA`,
    );
  }
});
