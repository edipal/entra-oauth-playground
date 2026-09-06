"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputTextarea } from "primereact/inputtextarea";
import LabelWithHelp from "@/components/LabelWithHelp";
import { useActiveProvider } from "@/hooks/useActiveProvider";
import { decodeJwt, type DecodedTokenFormat } from "@/lib/jwtDecode";
import {
  ACCESS_CLAIMS_DOC,
  AUTH0_TOKENS_DOC,
  IANA_JWT_CLAIMS_DOC,
  ID_CLAIMS_DOC,
  JWT_REGISTERED_CLAIMS_DOC,
  OPTIONAL_CLAIMS_DOC,
  parsePayloadToClaims,
  resolveClaimDescriptions,
  type ClaimDescriptionGroups,
} from "@/lib/jwtClaims";

export default function JwtDecoderToolPage() {
  const t = useTranslations("ToolsJwtDecoder");
  const tDecode = useTranslations("StepDecode");
  const { activeProviderId } = useActiveProvider();

  const [jwt, setJwt] = useState("");
  const [decodedHeader, setDecodedHeader] = useState("");
  const [decodedPayload, setDecodedPayload] = useState("");
  const [decodedFormat, setDecodedFormat] =
    useState<DecodedTokenFormat>("invalid");
  const [showClaimsDialog, setShowClaimsDialog] = useState(false);

  const claimDescriptions = useMemo(
    () =>
      resolveClaimDescriptions(
        (tDecode.raw("claimDescriptions") as ClaimDescriptionGroups) ?? {},
        activeProviderId,
      ),
    [tDecode, activeProviderId],
  );
  const unknownClaimDescription = tDecode(
    "claimsDialog.unknownClaimDescription",
  );
  const namespacedClaimDescription = tDecode(
    "claimsDialog.namespacedClaimDescription",
  );

  const claims = useMemo(
    () =>
      parsePayloadToClaims(
        decodedPayload,
        claimDescriptions,
        unknownClaimDescription,
        namespacedClaimDescription,
      ),
    [
      decodedPayload,
      claimDescriptions,
      unknownClaimDescription,
      namespacedClaimDescription,
    ],
  );

  const calcRows = (value: string, minRows: number) => {
    try {
      const lines = (value ?? "").split("\n").length;
      return Math.max(minRows, lines + 1 || 1);
    } catch {
      return minRows;
    }
  };

  const rowsHeader = useMemo(() => calcRows(decodedHeader, 6), [decodedHeader]);
  const payloadValue = useMemo(
    () =>
      decodedFormat === "jwe"
        ? tDecode("notes.encryptedPayloadPlaceholder")
        : decodedPayload,
    [decodedFormat, decodedPayload, tDecode],
  );
  const rowsPayload = useMemo(() => calcRows(payloadValue, 10), [payloadValue]);
  const claimReferences =
    activeProviderId === "auth0"
      ? [
          {
            href: AUTH0_TOKENS_DOC,
            label: tDecode("claimsDialog.references.auth0"),
          },
          {
            href: JWT_REGISTERED_CLAIMS_DOC,
            label: tDecode("claimsDialog.references.registered"),
          },
          {
            href: IANA_JWT_CLAIMS_DOC,
            label: tDecode("claimsDialog.references.iana"),
          },
        ]
      : [
          {
            href: ACCESS_CLAIMS_DOC,
            label: tDecode("claimsDialog.references.access"),
          },
          {
            href: ID_CLAIMS_DOC,
            label: tDecode("claimsDialog.references.id"),
          },
          {
            href: OPTIONAL_CLAIMS_DOC,
            label: tDecode("claimsDialog.references.optional"),
          },
        ];

  const handleDecode = () => {
    const token = jwt.trim().replace(/^Bearer\s+/i, "");
    const decoded = decodeJwt(token);
    setDecodedHeader(decoded.header);
    setDecodedPayload(decoded.payload);
    setDecodedFormat(decoded.format);
  };

  return (
    <div className="grid">
      <div className="col-12">
        <div>
          <h4>{t("title")}</h4>
          <p className="mb-3">{t("description")}</p>

          <div className="grid formgrid p-fluid gap-3">
            <div className="col-12">
              <LabelWithHelp
                id="jwtInput"
                text={t("labels.jwt")}
                help={t("help.jwt")}
              />
              <InputTextarea
                id="jwtInput"
                rows={5}
                autoResize
                value={jwt}
                onChange={(e) => setJwt(e.target.value)}
                style={{
                  width: "100%",
                  whiteSpace: "pre-wrap",
                  resize: "vertical",
                }}
              />
            </div>

            <div className="col-12 flex gap-2 mt-1 mb-1">
              <Button
                type="button"
                label={t("buttons.decode")}
                icon="pi pi-code"
                onClick={handleDecode}
                disabled={!jwt.trim()}
              />
            </div>

            <div className="col-12">
              <LabelWithHelp
                id="jwtHeaderClaims"
                text={t("labels.headerClaims")}
                help={t("help.headerClaims")}
              />
              <InputTextarea
                id="jwtHeaderClaims"
                rows={rowsHeader}
                autoResize
                value={decodedHeader}
                readOnly
                style={{
                  width: "100%",
                  whiteSpace: "pre-wrap",
                  resize: "vertical",
                }}
              />
            </div>

            <div className="col-12">
              <div className="flex align-items-center gap-2 mb-2">
                <LabelWithHelp
                  id="jwtPayloadClaims"
                  text={t("labels.payloadClaims")}
                  help={t("help.payloadClaims")}
                />
                <button
                  type="button"
                  className="p-link"
                  aria-label={t("buttons.openClaims")}
                  title={t("buttons.openClaims")}
                  onClick={() => setShowClaimsDialog(true)}
                  disabled={!claims.length}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: claims.length ? "pointer" : "not-allowed",
                    opacity: claims.length ? 1 : 0.45,
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
                id="jwtPayloadClaims"
                rows={rowsPayload}
                autoResize
                value={payloadValue}
                readOnly
                style={{
                  width: "100%",
                  whiteSpace: "pre-wrap",
                  resize: "vertical",
                }}
              />
              {decodedFormat === "jwe" && (
                <div className="mt-2 flex gap-3 align-items-start pl-2">
                  <i
                    className="pi pi-lock mr-2"
                    style={{
                      color: "var(--primary-color)",
                      fontSize: "1.1rem",
                      marginTop: "0.2rem",
                    }}
                    aria-hidden="true"
                  />
                  <p className="m-0 text-sm">
                    {tDecode("notes.encryptedToken")}
                  </p>
                </div>
              )}
            </div>
          </div>

          <Dialog
            visible={showClaimsDialog}
            header={t("claimsDialog.title")}
            style={{ width: "min(62rem, 95vw)" }}
            onHide={() => setShowClaimsDialog(false)}
          >
            {claims.length === 0 ? (
              <p className="m-0">{tDecode("claimsDialog.noClaims")}</p>
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
                        {tDecode("claimsDialog.columns.name")}
                      </th>
                      <th className="text-left p-2">
                        {tDecode("claimsDialog.columns.value")}
                      </th>
                      <th className="text-left p-2">
                        {tDecode("claimsDialog.columns.description")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map((claim) => (
                      <tr
                        key={claim.name}
                        className="surface-border border-bottom-1"
                      >
                        <td
                          className="p-2"
                          style={{
                            verticalAlign: "top",
                            wordBreak: "break-word",
                          }}
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
                          style={{
                            verticalAlign: "top",
                            wordBreak: "break-word",
                          }}
                        >
                          {claim.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-3">
                  <p className="m-0 mb-2 font-semibold">
                    {tDecode("claimsDialog.references.title")}
                  </p>
                  <ul className="m-0 pl-3">
                    {claimReferences.map((reference) => (
                      <li key={reference.href}>
                        <a
                          href={reference.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {reference.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Dialog>
        </div>
      </div>
    </div>
  );
}
