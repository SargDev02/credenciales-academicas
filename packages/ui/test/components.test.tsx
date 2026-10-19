import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup as render } from "react-dom/server";
import { Badge, Button, CredentialCard, Input, Alert, EmptyState, Skeleton } from "../src/index";

test("buttons have native semantics and pending disables duplicate submission",()=>{const html=render(<Button type="submit" busy>Continuar</Button>);assert.match(html,/type="submit"/);assert.match(html,/disabled=""/);assert.match(html,/aria-busy="true"/);assert.match(html,/role="status"/);});
test("input connects its real label, hint and validation error",()=>{const html=render(<Input id="email" name="email" label="Correo" hint="Correo de acceso" error="Revisa el correo"/>);assert.match(html,/for="email"/);assert.match(html,/aria-describedby="email-hint email-error"/);assert.match(html,/aria-invalid="true"/);});
for(const [label,tone] of [["Vigente","success"],["Revocada","danger"],["Anulada","warning"]] as const)test(`credential state ${label} remains visible as text`,()=>{const html=render(<CredentialCard category="Certificado" title="Ejemplo" institution="Institución demo" status={<Badge tone={tone}>{label}</Badge>}/>);assert.match(html,new RegExp(label));assert.match(html,/<article/);assert.match(html,/<h3>Ejemplo/);});
test("errors, empty and loading states provide meaningful accessible content",()=>{assert.match(render(<Alert title="Error" tone="danger">Intenta de nuevo</Alert>),/role="alert"/);assert.match(render(<Skeleton/>),/Cargando contenido/);assert.match(render(<EmptyState title="Sin resultados">Cambia la búsqueda</EmptyState>),/Cambia la búsqueda/);});
