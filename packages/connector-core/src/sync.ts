import type {
  AnulacionCredencial,
  CorreccionCredencial,
  RevocacionCredencial,
} from "@raes/contracts";

import {
  requestId,
  stableKey,
} from "./idempotency";
import { RaesClient } from "./raes-client";
import type {
  InstitutionalSnapshot,
  CredentialRow,
} from "./source";
import {
  normalizeCredentialState,
  toCampus,
  toCredential,
  toInstitution,
  toPerson,
  toProgram,
  toProgramCampus,
} from "./transform";

export type SyncMode = "all" | "base" | "credentials";

export type SyncOptions = {
  mode: SyncMode;
  credentialCode: string | null;
};

export type SyncSummary = {
  institution: number;
  campuses: number;
  programs: number;
  programCampuses: number;
  persons: number;
  credentialsCreatedOrReplayed: number;
  credentialsUnchanged: number;
  credentialsCorrected: number;
  credentialsRevoked: number;
  credentialsAnnulled: number;
  existingCredentialsNotAdopted: string[];
  terminalStateConflicts: string[];
};

export async function synchronize(
  snapshot: InstitutionalSnapshot,
  raes: RaesClient,
  options: SyncOptions,
): Promise<SyncSummary> {
  validateSnapshot(snapshot);
  const summary: SyncSummary = {
    institution: 0,
    campuses: 0,
    programs: 0,
    programCampuses: 0,
    persons: 0,
    credentialsCreatedOrReplayed: 0,
    credentialsUnchanged: 0,
    credentialsCorrected: 0,
    credentialsRevoked: 0,
    credentialsAnnulled: 0,
    existingCredentialsNotAdopted: [],
    terminalStateConflicts: [],
  };

  if (options.mode !== "credentials") {
    await raes.syncInstitution(toInstitution(snapshot.institution));
    summary.institution += 1;

    for (const campus of snapshot.campuses) {
      await raes.syncCampus(toCampus(campus));
      summary.campuses += 1;
    }

    for (const program of snapshot.programs) {
      await raes.syncProgram(toProgram(program));
      summary.programs += 1;
    }

    const programsById = new Map(
      snapshot.programs.map((item) => [item.id, item]),
    );
    const campusesById = new Map(
      snapshot.campuses.map((item) => [item.id, item]),
    );

    for (const relation of snapshot.programCampuses) {
      const program = programsById.get(relation.programa_id);
      const campus = campusesById.get(relation.sede_id);

      if (!program || !campus) {
        throw new Error(
          `programa_sede ${relation.id} referencia programa o sede inexistente`,
        );
      }

      await raes.syncProgramCampus(
        toProgramCampus(relation, program, campus),
      );
      summary.programCampuses += 1;
    }

    for (const student of snapshot.students) {
      await raes.syncPerson(toPerson(student));
      summary.persons += 1;
    }
  }

  if (options.mode !== "base") {
    await syncCredentials(snapshot, raes, options, summary);
  }

  return summary;
}

async function syncCredentials(
  snapshot: InstitutionalSnapshot,
  raes: RaesClient,
  options: SyncOptions,
  summary: SyncSummary,
): Promise<void> {
  const studentsById = new Map(
    snapshot.students.map((item) => [item.id, item]),
  );
  const enrollmentsById = new Map(
    snapshot.enrollments.map((item) => [item.id, item]),
  );
  const relationsById = new Map(
    snapshot.programCampuses.map((item) => [item.id, item]),
  );
  const programsById = new Map(
    snapshot.programs.map((item) => [item.id, item]),
  );
  const campusesById = new Map(
    snapshot.campuses.map((item) => [item.id, item]),
  );

  const credentials = options.credentialCode
    ? snapshot.credentials.filter(
        (item) => item.codigo === options.credentialCode,
      )
    : snapshot.credentials;

  if (options.credentialCode && credentials.length === 0) {
    throw new Error(
      `No existe la credencial institucional ${options.credentialCode}`,
    );
  }

  for (const source of credentials) {
    const student = studentsById.get(source.estudiante_id);
    const enrollment = enrollmentsById.get(source.matricula_id);

    if (!student || !enrollment || enrollment.estudiante_id !== student.id) {
      throw new Error(
        `La credencial ${source.codigo} tiene referencias académicas incompletas`,
      );
    }

    const relation = relationsById.get(
      enrollment.programa_sede_id,
    );

    if (!relation) {
      throw new Error(
        `La matrícula de ${source.codigo} no tiene programa_sede válido`,
      );
    }

    const program = programsById.get(relation.programa_id);
    const campus = campusesById.get(relation.sede_id);

    if (!program || !campus) {
      throw new Error(
        `La credencial ${source.codigo} no puede resolver programa/sede`,
      );
    }

    const payload = toCredential(
      source,
      student,
      program,
      campus,
    );

    const registrationOutcome = await ensureRegistered(
      raes,
      source,
      payload,
      summary,
    );

    if (registrationOutcome === "existing-unmanaged") {
      continue;
    }

    const state = normalizeCredentialState(source.estado);

    if (state === "REVOCADA") {
      const command: RevocacionCredencial = {
        codigoOrigen: source.codigo,
        motivo:
          "Revocación reportada por el sistema académico institucional",
        ocurridoAt: normalizeTimestamp(source.updated_at),
      };

      await raes.revokeCredential(command, {
        requestId: requestId(),
        idempotencyKey: stableKey(raes.namespace, 
          "revoke",
          source.id,
          command,
        ),
      });
      summary.credentialsRevoked += 1;
    } else if (state === "ANULADA") {
      const command: AnulacionCredencial = {
        codigoOrigen: source.codigo,
        motivo:
          "Anulación reportada por el sistema académico institucional",
        ocurridoAt: normalizeTimestamp(source.updated_at),
      };

      await raes.annulCredential(command, {
        requestId: requestId(),
        idempotencyKey: stableKey(raes.namespace, 
          "annul",
          source.id,
          command,
        ),
      });
      summary.credentialsAnnulled += 1;
    }
  }
}

async function ensureRegistered(
  raes: RaesClient,
  source: CredentialRow,
  payload: Parameters<RaesClient["createCredential"]>[0],
  summary: SyncSummary,
): Promise<"managed" | "existing-unmanaged"> {
  const creationKey = stableKey(raes.namespace, "create", source.id);
  const current = await raes.getCredentialState(source.codigo);
  if (!current) {
    await raes.createCredential(payload, { requestId: requestId(), idempotencyKey: creationKey });
    summary.credentialsCreatedOrReplayed += 1;
    return "managed";
  }
  if (current.creationKey !== creationKey) {
    summary.existingCredentialsNotAdopted.push(source.codigo);
    return "existing-unmanaged";
  }
  if (!current.personSourceIds.includes(payload.personaIdentificadorOrigen)) {
    throw new Error("La identidad de una credencial existente no puede reasignarse");
  }
  const { personaIdentificadorOrigen: _, ...academicPayload } = payload;
  const sameContent = canonical(academicPayload) === canonical(current.payload);
  const desiredState = normalizeCredentialState(source.estado);
  if (current.state !== "VIGENTE") {
    if (current.state !== desiredState || !sameContent) summary.terminalStateConflicts.push(source.codigo);
    else summary.credentialsUnchanged += 1;
    // A matching terminal record needs no new transition and cannot be corrected.
    return "existing-unmanaged";
  }
  if (sameContent) {
    summary.credentialsUnchanged += 1;
    return "managed";
  }
  const correction: CorreccionCredencial = {
    codigoOrigen: source.codigo,
    motivo: "Cambio detectado por sincronización del sistema académico institucional",
    ocurridoAt: normalizeTimestamp(source.updated_at),
    datosActualizados: {
      programaCodigoOrigen: payload.programaCodigoOrigen ?? null,
      sedeCodigoOrigen: payload.sedeCodigoOrigen ?? null,
      tipo: payload.tipo, categoria: payload.categoria, titulo: payload.titulo,
      descripcion: payload.descripcion ?? null,
      fechaEmision: payload.fechaEmision, fechaGrado: payload.fechaGrado ?? null,
      numeroActa: payload.numeroActa ?? null, numeroFolio: payload.numeroFolio ?? null,
      numeroLibro: payload.numeroLibro ?? null,
      documentoHashSha256: payload.documentoHashSha256 ?? null,
    },
  };
  await raes.correctCredential(correction, {
    requestId: requestId(),
    // Include the current version: an A -> B -> A -> B sequence is new work,
    // while retries against the same version retain the same key.
    idempotencyKey: stableKey(raes.namespace, "correct", source.id, { version: current.version, correction }),
  });
  summary.credentialsCorrected += 1;
  return "managed";
}

function normalizeTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Timestamp institucional inválido: ${value}`);
  }

  return date.toISOString();
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}

function validateSnapshot(snapshot: InstitutionalSnapshot): void {
  toInstitution(snapshot.institution);
  snapshot.students.forEach(toPerson);
  snapshot.campuses.forEach(toCampus);
  snapshot.programs.forEach(toProgram);
  const programs = new Map(snapshot.programs.map(p => [p.id, p]));
  const campuses = new Map(snapshot.campuses.map(p => [p.id, p]));
  const students = new Map(snapshot.students.map(p => [p.id, p]));
  const enrollments = new Map(snapshot.enrollments.map(p => [p.id, p]));
  const relations = new Map(snapshot.programCampuses.map(p => [p.id, p]));
  for (const relation of snapshot.programCampuses) {
    const program = programs.get(relation.programa_id);
    const campus = campuses.get(relation.sede_id);
    if (!program || !campus) throw new Error("Relación programa-sede incompleta en la fuente");
    toProgramCampus(relation, program, campus);
  }
  for (const credential of snapshot.credentials) {
    const student = students.get(credential.estudiante_id);
    const enrollment = enrollments.get(credential.matricula_id);
    const relation = enrollment && relations.get(enrollment.programa_sede_id);
    const program = relation && programs.get(relation.programa_id);
    const campus = relation && campuses.get(relation.sede_id);
    if (!student || !enrollment || enrollment.estudiante_id !== student.id || !program || !campus) {
      throw new Error("Referencias de credencial inconsistentes en la fuente institucional");
    }
    toCredential(credential, student, program, campus);
    normalizeCredentialState(credential.estado);
    normalizeTimestamp(credential.updated_at);
  }
}
