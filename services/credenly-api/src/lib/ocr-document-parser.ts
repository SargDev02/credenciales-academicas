export type SupportedDocumentType =
  | "CC"
  | "TI"
  | "CE"
  | "PPT"
  | "PA";

export type ParsedIdentityDocument = {
  tipoDocumento: SupportedDocumentType | null;
  numeroDocumento: string | null;
  nombres: string | null;
  apellidos: string | null;
};

export type VerificationDecision = {
  estado: "APROBADA" | "REVISION" | "RECHAZADA";
  motivoRevision: string | null;
  motivoFallo: string | null;
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function cleanDocumentNumber(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
}

function nextMeaningfulLine(
  originalLines: string[],
  normalizedLines: string[],
  label: string,
): string | null {
  const index = normalizedLines.findIndex((line) =>
    line.includes(label),
  );

  if (index < 0) {
    return null;
  }

  const sameLine = originalLines[index]
    ?.replace(new RegExp(label, "i"), "")
    .replace(/^\s*[:#-]?\s*/, "")
    .trim();

  if (sameLine && sameLine.length >= 2) {
    return normalizeWhitespace(sameLine);
  }

  for (let i = index + 1; i < originalLines.length; i += 1) {
    const candidate = originalLines[i]?.trim();

    if (candidate && candidate.length >= 2) {
      return normalizeWhitespace(candidate);
    }
  }

  return null;
}

function detectDocumentType(
  normalizedText: string,
): SupportedDocumentType | null {
  if (
    normalizedText.includes("TARJETA DE IDENTIDAD") ||
    normalizedText.includes("TARJETA IDENTIDAD")
  ) {
    return "TI";
  }

  if (
    normalizedText.includes("CEDULA DE EXTRANJERIA") ||
    normalizedText.includes("CEDULA EXTRANJERIA")
  ) {
    return "CE";
  }

  if (
    normalizedText.includes("PERMISO POR PROTECCION TEMPORAL") ||
    normalizedText.includes("PERMISO PROTECCION TEMPORAL")
  ) {
    return "PPT";
  }

  if (normalizedText.includes("PASAPORTE")) {
    return "PA";
  }

  if (
    normalizedText.includes("CEDULA DE CIUDADANIA") ||
    normalizedText.includes("CEDULA CIUDADANIA") ||
    normalizedText.includes("C.C.")
  ) {
    return "CC";
  }

  return null;
}

function detectDocumentNumber(
  normalizedText: string,
): string | null {
  const labeledPatterns = [
    /(?:NUIP|NUMERO|N[O°])\s*[:#-]?\s*([A-Z0-9.-]{5,24})/,
    /(?:DOCUMENTO|IDENTIFICACION)\s*[:#-]?\s*([A-Z0-9.-]{5,24})/,
  ];

  for (const pattern of labeledPatterns) {
    const match = normalizedText.match(pattern);
    const candidate = match?.[1]
      ? cleanDocumentNumber(match[1])
      : "";

    if (candidate.length >= 5) {
      return candidate;
    }
  }

  const numericCandidates =
    normalizedText.match(/\b\d(?:[.\s-]?\d){5,11}\b/g) ?? [];

  for (const rawCandidate of numericCandidates) {
    const candidate = cleanDocumentNumber(rawCandidate);

    if (/^\d{6,12}$/.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function parseColombianIdentityDocument(
  text: string,
): ParsedIdentityDocument {
  const originalLines = text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
  const normalizedLines = originalLines.map(normalizeForSearch);
  const normalizedText = normalizeForSearch(text);

  return {
    tipoDocumento: detectDocumentType(normalizedText),
    numeroDocumento: detectDocumentNumber(normalizedText),
    nombres: nextMeaningfulLine(
      originalLines,
      normalizedLines,
      "NOMBRES",
    ),
    apellidos: nextMeaningfulLine(
      originalLines,
      normalizedLines,
      "APELLIDOS",
    ),
  };
}

export function decideIdentityVerification(
  parsed: ParsedIdentityDocument,
  confidence: number,
): VerificationDecision {
  if (!parsed.tipoDocumento || !parsed.numeroDocumento) {
    return {
      estado: "RECHAZADA",
      motivoRevision: null,
      motivoFallo:
        "No fue posible identificar con suficiente claridad el tipo y número de documento.",
    };
  }

  const hasCompleteName = Boolean(
    parsed.nombres && parsed.apellidos,
  );

  if (confidence >= 0.9 && hasCompleteName) {
    return {
      estado: "APROBADA",
      motivoRevision: null,
      motivoFallo: null,
    };
  }

  const reasons: string[] = [];

  if (confidence < 0.9) {
    reasons.push(
      `Confianza OCR insuficiente para aprobación automática (${Math.round(
        confidence * 100,
      )}%).`,
    );
  }

  if (!hasCompleteName) {
    reasons.push(
      "No fue posible extraer nombres y apellidos completos.",
    );
  }

  return {
    estado: "REVISION",
    motivoRevision: reasons.join(" "),
    motivoFallo: null,
  };
}
