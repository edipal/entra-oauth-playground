"use client";
import { InputTextarea } from "primereact/inputtextarea";
import { Button } from "primereact/button";
import { useTranslations } from "next-intl";
import { Dialog } from "primereact/dialog";
import { useMemo, useState } from "react";
import LabelWithHelp from "@/components/LabelWithHelp";

type Props = {
  accessToken: string;
  idToken: string;
  decodedAccessHeader: string;
  decodedAccessPayload: string;
  decodedIdHeader: string;
  decodedIdPayload: string;
  onDecodeTokens: () => void;
};

type TokenType = "access" | "id";

type ClaimRow = {
  name: string;
  value: string;
  description: string;
};

const ACCESS_CLAIMS_DOC =
  "https://learn.microsoft.com/en-us/entra/identity-platform/access-token-claims-reference";
const ID_CLAIMS_DOC =
  "https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference";
const OPTIONAL_CLAIMS_DOC =
  "https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims-reference";

function formatClaimValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parsePayloadToClaims(
  payload: string,
  localizedDescriptions: Record<string, string>,
  fallbackDescription: string,
): ClaimRow[] {
  if (!payload?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(payload);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [];
    }

    return Object.entries(parsed as Record<string, unknown>).map(
      ([name, value]) => ({
        name,
        value: formatClaimValue(value),
        description: localizedDescriptions[name] || fallbackDescription,
      }),
    );
  } catch {
    return [];
  }
}

export default function StepDecode({
  accessToken,
  idToken,
  decodedAccessHeader,
  decodedAccessPayload,
  decodedIdHeader,
  decodedIdPayload,
  onDecodeTokens,
}: Props) {
  const t = useTranslations("StepDecode");
  const [activeDialogToken, setActiveDialogToken] = useState<TokenType | null>(
    null,
  );
  const claimDescriptions =
    (t.raw("claimDescriptions") as Record<string, string>) ?? {};
  const unknownClaimDescription = t("claimsDialog.unknownClaimDescription");
  // Compute rows from content lines so areas grow to show all content
  const calcRows = (value: string, minRows: number) => {
    try {
      const lines = (value ?? "").split("\n").length;
      return Math.max(minRows, lines + 1 || 1);
    } catch {
      return minRows;
    }
  };
  const rowsAccessHeader = useMemo(
    () => calcRows(decodedAccessHeader, 6),
    [decodedAccessHeader],
  );
  const rowsIdHeader = useMemo(
    () => calcRows(decodedIdHeader, 6),
    [decodedIdHeader],
  );
  const rowsAccessPayload = useMemo(
    () => calcRows(decodedAccessPayload, 10),
    [decodedAccessPayload],
  );
  const rowsIdPayload = useMemo(
    () => calcRows(decodedIdPayload, 10),
    [decodedIdPayload],
  );
  const accessClaims = useMemo(
    () =>
      parsePayloadToClaims(
        decodedAccessPayload,
        claimDescriptions,
        unknownClaimDescription,
      ),
    [decodedAccessPayload, claimDescriptions, unknownClaimDescription],
  );
  const idClaims = useMemo(
    () =>
      parsePayloadToClaims(
        decodedIdPayload,
        claimDescriptions,
        unknownClaimDescription,
      ),
    [decodedIdPayload, claimDescriptions, unknownClaimDescription],
  );
  const activeClaims = activeDialogToken === "access" ? accessClaims : idClaims;
  const activeDialogTitle =
    activeDialogToken === "access"
      ? t("claimsDialog.accessTitle")
      : t("claimsDialog.idTitle");
  const primaryDocUrl =
    activeDialogToken === "access" ? ACCESS_CLAIMS_DOC : ID_CLAIMS_DOC;
  const primaryDocLabel =
    activeDialogToken === "access"
      ? t("claimsDialog.references.access")
      : t("claimsDialog.references.id");

  return (
    <section>
      <p className="mb-3">{t("sections.decode.description")}</p>
      <div className="mb-4 surface-0 py-3 px-0 border-round">
        <div className="grid formgrid p-fluid gap-3">
          <div className="col-12">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(12rem, 14rem) 1fr",
                alignItems: "start",
                columnGap: "0.75rem",
                width: "100%",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <LabelWithHelp
                  id="accessToken"
                  text={t("labels.accessToken")}
                  help={t("help.accessToken")}
                />
              </div>
              <div>
                <InputTextarea
                  id="accessToken"
                  rows={3}
                  autoResize
                  value={accessToken}
                  readOnly
                  wrap="soft"
                  style={{
                    width: "100%",
                    whiteSpace: "pre-wrap",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>
          </div>
          <div className="col-12">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(12rem, 14rem) 1fr",
                alignItems: "start",
                columnGap: "0.75rem",
                width: "100%",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <LabelWithHelp
                  id="idToken"
                  text={t("labels.idToken")}
                  help={t("help.idToken")}
                />
              </div>
              <div>
                <InputTextarea
                  id="idToken"
                  rows={3}
                  autoResize
                  value={idToken}
                  readOnly
                  wrap="soft"
                  style={{
                    width: "100%",
                    whiteSpace: "pre-wrap",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>
          </div>
          <div className="col-12 flex gap-2 mt-3 mb-3">
            <Button
              type="button"
              label={t("buttons.decode")}
              icon="pi pi-code"
              onClick={onDecodeTokens}
              disabled={!accessToken && !idToken}
            />
          </div>
          {/* Two columns: row 1 = both headers, row 2 = both payloads (keeps payloads aligned) */}
          <div className="col-12">
            <div
              className="w-full"
              style={{
                display: "grid",
                gap: "1rem",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                alignItems: "start",
              }}
            >
              {/* Row 1: headers — keep order consistent with tokens (Access, then ID) */}
              <div>
                <LabelWithHelp
                  id="accessHeader"
                  text={t("labels.accessHeader")}
                  help={t("help.accessHeader")}
                />
                <InputTextarea
                  id="accessHeader"
                  rows={rowsAccessHeader}
                  autoResize
                  value={decodedAccessHeader}
                  style={{
                    width: "100%",
                    whiteSpace: "pre-wrap",
                    resize: "vertical",
                  }}
                />
                {/* Hint: Some providers include a JOSE 'nonce' header in access tokens; not used for OIDC nonce validation */}
                {useMemo(() => {
                  try {
                    const obj = JSON.parse(decodedAccessHeader || "{}");
                    return obj && typeof obj === "object" && "nonce" in obj;
                  } catch {
                    return (decodedAccessHeader || "").includes('"nonce"');
                  }
                }, [decodedAccessHeader]) && (
                  <div className="mt-2 flex gap-3 align-items-start pl-2">
                    <i
                      className="pi pi-exclamation-circle mr-2"
                      style={{
                        color: "var(--yellow-500)",
                        fontSize: "1.1rem",
                        marginTop: "0.2rem",
                      }}
                      aria-hidden="true"
                    />
                    <p className="m-0 text-sm">
                      {(t as any).rich("notes.accessHeaderNonce", {
                        code: (chunks: any) => <code>{chunks}</code>,
                      })}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <LabelWithHelp
                  id="idHeader"
                  text={t("labels.idHeader")}
                  help={t("help.idHeader")}
                />
                <InputTextarea
                  id="idHeader"
                  rows={rowsIdHeader}
                  autoResize
                  value={decodedIdHeader}
                  style={{
                    width: "100%",
                    whiteSpace: "pre-wrap",
                    resize: "vertical",
                  }}
                />
              </div>
              {/* Row 2: payloads (aligned with headers) */}
              <div>
                <div className="flex align-items-center gap-2 mb-2">
                  <LabelWithHelp
                    id="accessPayload"
                    text={t("labels.accessPayload")}
                    help={t("help.accessPayload")}
                  />
                  <button
                    type="button"
                    className="p-link"
                    aria-label={t("claimsDialog.openAccess")}
                    title={t("claimsDialog.openAccess")}
                    onClick={() => setActiveDialogToken("access")}
                    disabled={!accessClaims.length}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: accessClaims.length ? "pointer" : "not-allowed",
                      opacity: accessClaims.length ? 1 : 0.45,
                      color: "#0ea5e9",
                    }}
                  >
                    <i
                      className="pi pi-file"
                      style={{ fontSize: "1rem" }}
                      aria-hidden="true"
                    />
                  </button>
                </div>
                <InputTextarea
                  id="accessPayload"
                  rows={rowsAccessPayload}
                  autoResize
                  value={decodedAccessPayload}
                  style={{
                    width: "100%",
                    whiteSpace: "pre-wrap",
                    resize: "vertical",
                  }}
                />
              </div>
              <div>
                <div className="flex align-items-center gap-2 mb-2">
                  <LabelWithHelp
                    id="idPayload"
                    text={t("labels.idPayload")}
                    help={t("help.idPayload")}
                  />
                  <button
                    type="button"
                    className="p-link"
                    aria-label={t("claimsDialog.openId")}
                    title={t("claimsDialog.openId")}
                    onClick={() => setActiveDialogToken("id")}
                    disabled={!idClaims.length}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: idClaims.length ? "pointer" : "not-allowed",
                      opacity: idClaims.length ? 1 : 0.45,
                      color: "#0ea5e9",
                    }}
                  >
                    <i
                      className="pi pi-file"
                      style={{ fontSize: "1rem" }}
                      aria-hidden="true"
                    />
                  </button>
                </div>
                <InputTextarea
                  id="idPayload"
                  rows={rowsIdPayload}
                  autoResize
                  value={decodedIdPayload}
                  style={{
                    width: "100%",
                    whiteSpace: "pre-wrap",
                    resize: "vertical",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        visible={!!activeDialogToken}
        header={activeDialogTitle}
        style={{ width: "min(62rem, 95vw)" }}
        onHide={() => setActiveDialogToken(null)}
      >
        {!activeClaims.length ? (
          <p className="m-0">{t("claimsDialog.noClaims")}</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "18%" }} />
                <col style={{ width: "32%" }} />
                <col style={{ width: "50%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="text-left p-2">
                    {t("claimsDialog.columns.name")}
                  </th>
                  <th className="text-left p-2">
                    {t("claimsDialog.columns.value")}
                  </th>
                  <th className="text-left p-2">
                    {t("claimsDialog.columns.description")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeClaims.map((claim) => (
                  <tr
                    key={claim.name}
                    className="surface-border border-bottom-1"
                  >
                    <td
                      className="p-2"
                      style={{ verticalAlign: "top", wordBreak: "break-word" }}
                    >
                      {claim.name}
                    </td>
                    <td
                      className="p-2"
                      style={{
                        verticalAlign: "top",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {claim.value}
                    </td>
                    <td
                      className="p-2"
                      style={{ verticalAlign: "top", wordBreak: "break-word" }}
                    >
                      {claim.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3">
              <p className="m-0 mb-2 font-semibold">
                {t("claimsDialog.references.title")}
              </p>
              <ul className="m-0 pl-3">
                <li>
                  <a
                    href={primaryDocUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {primaryDocLabel}
                  </a>
                </li>
                <li>
                  <a
                    href={OPTIONAL_CLAIMS_DOC}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("claimsDialog.references.optional")}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
}
