import { handleExchangeTokenRequest } from "@/lib/oauthTokenHandlers";

export async function POST(request: Request) {
  return handleExchangeTokenRequest(request, "auth0");
}
