"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputTextarea } from "primereact/inputtextarea";
import LabelWithHelp from "@/components/LabelWithHelp";
import { decodeJwt } from "@/lib/jwtDecode";
import {
  ACCESS_CLAIMS_DOC,
  ID_CLAIMS_DOC,
  OPTIONAL_CLAIMS_DOC,
  parsePayloadToClaims,
} from "@/lib/jwtClaims";

export default function JwtDecoderToolPage() {
  const t = useTranslations("ToolsJwtDecoder");
  const tDecode = useTranslations("StepDecode");

  const [jwt, setJwt] = useState("");
  const [decodedHeader, setDecodedHeader] = useState("");
  const [decodedPayload, setDecodedPayload] = useState("");
  const [showClaimsDialog, setShowClaimsDialog] = useState(false);

  const claimDescriptions = useMemo(
    () => (tDecode.raw("claimDescriptions") as Record<string, string>) ?? {},
    [tDecode],
  );
  const unknownClaimDescription = tDecode("claimsDialog.unknownClaimDescription");

  const claims = useMemo(
    () =>
      parsePayloadToClaims(
        decodedPayload,
        claimDescriptions,
        unknownClaimDescription,
      ),
    [decodedPayload, claimDescriptions, unknownClaimDescription],
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
  const rowsPayload = useMemo(() => calcRows(decodedPayload, 10), [decodedPayload]);

  const handleDecode = () => {
    const token = jwt.trim().replace(/^Bearer\s+/i, "");
    const decoded = decodeJwt(token);
    setDecodedHeader(decoded.header);
    setDecodedPayload(decoded.payload);
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
                style={{ width: "100%", whiteSpace: "pre-wrap", resize: "vertical" }}
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
                style={{ width: "100%", whiteSpace: "pre-wrap", resize: "vertical" }}
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
                value={decodedPayload}
                readOnly
                style={{ width: "100%", whiteSpace: "pre-wrap", resize: "vertical" }}
              />
            </div>
          </div>

          <Dialog
            visible={showClaimsDialog}
            header={t("claimsDialog.title")}
            style={{ width: "min(62rem, 95vw)" }}
            onHide={() => setShowClaimsDialog(false)}
          >
            {!claims.length ? (
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
                      <tr key={claim.name} className="surface-border border-bottom-1">
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
                    {tDecode("claimsDialog.references.title")}
                  </p>
                  <ul className="m-0 pl-3">
                    <li>
                      <a href={ACCESS_CLAIMS_DOC} target="_blank" rel="noopener noreferrer">
                        {tDecode("claimsDialog.references.access")}
                      </a>
                    </li>
                    <li>
                      <a href={ID_CLAIMS_DOC} target="_blank" rel="noopener noreferrer">
                        {tDecode("claimsDialog.references.id")}
                      </a>
                    </li>
                    <li>
                      <a href={OPTIONAL_CLAIMS_DOC} target="_blank" rel="noopener noreferrer">
                        {tDecode("claimsDialog.references.optional")}
                      </a>
                    </li>
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
